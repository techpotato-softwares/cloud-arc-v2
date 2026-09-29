from __future__ import annotations

import base64
import json

import pytest
from fastapi.testclient import TestClient
from forgearc_ai.auth import Principal, issue_token
from forgearc_ai.config import Settings, load_settings, validate_settings
from forgearc_ai.errors import ConfigError
from forgearc_ai.models import Base
from forgearc_ai.providers.jev import calibrate
from forgearc_ai.rag import postgres_search_sql
from forgearc_ai.routing import route_registry
from forgearc_ai.stores import sign_webhook
from forgearc_ai_api.app import create_app
from forgearc_ai_api.wiring import build_container
from forgearc_ai_aws.aws import api_statements
from forgearc_ai_aws.bedrock import BedrockProvider
from forgearc_ai.providers.openai import OpenAIProvider
from sqlalchemy import create_engine


def settings(**overrides) -> Settings:
    payload = {
        "environment": "test",
        "auth": {"jwt_secret": "test-secret-test-secret-test-secret"},
        "local_users": [
            {
                "email": "ada@example.com",
                "password": "secret",
                "tenant_id": "tenant-a",
                "permissions": ["ai:chat", "ai:ingest", "ai:read", "ai:delete", "ai:decide"],
                "modules": ["ai"],
            }
        ],
        "chat": {"provider": "fake", "model": "fake-chat", "allowlist": ["fake-chat"]},
        "embeddings": {"provider": "fake", "model": "fake-embed", "allowlist": ["fake-embed"]},
        "pricing": {
            "fake-chat": {"input_per_million": 1, "output_per_million": 1},
            "jev-1.13.0": {"input_per_million": 0.042, "output_per_million": 0},
        },
        "budget": {"monthly_usd": 25},
        "webhook": {"url": "https://example.test/hook", "secret": "hook-secret"},
        "jev": {"enabled": True, "model": "jev-1.13.0", "api_key": "jev-test-key", "review_confidence": 0.8},
        "jobs_provider": "inline",
        "moderation_terms": ["blocked-phrase"],
    }
    payload.update(overrides)
    return validate_settings(Settings.model_validate(payload))


def jev_transport(_method, _url, _key, payload):
    assert payload["model"] == "jev-1.13.0"
    assert payload["zero_data_retention"] is True
    assert payload["no_training"] is True
    return {
        "model": "jev-1.13.0",
        "usage": {"input_tokens": 20},
        "answers": [
            {"id": "queue", "kind": "choice", "value": "billing", "probability": 0.91, "confidence": 0.9},
            {"id": "priority", "kind": "score", "value": 0.4, "probability": 0.4, "confidence": 0.42},
            {"id": "refund", "kind": "boolean", "value": False, "probability": 0.2, "confidence": 0.7},
        ],
    }


def api(config: Settings | None = None):
    config = config or settings()
    container = build_container(config, jev_transport=jev_transport)
    return TestClient(create_app(config, container)), container


def login(client: TestClient) -> dict:
    response = client.post("/api/auth/login", json={"email": "ada@example.com", "password": "secret"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_checkout_flow_ingests_streams_and_reports_cost():
    client, container = api()
    assert client.get("/health").json()["product"] == "forgearc-ai"
    headers = login(client)
    uploaded = client.post(
        "/api/documents",
        headers=headers,
        files={"file": ("notes.md", b"ForgeArc ships source code to the buyer.\n\nCitations stay with the answer.", "text/markdown")},
        data={"corpusId": "corpus-1", "idempotencyKey": "upload-1"},
    )
    assert uploaded.status_code == 200
    body = uploaded.json()
    assert body["status"] == "completed"
    again = client.post(
        "/api/documents",
        headers=headers,
        files={"file": ("notes.md", b"ignored", "text/markdown")},
        data={"corpusId": "corpus-1", "idempotencyKey": "upload-1"},
    )
    assert again.json()["jobId"] == body["jobId"]
    job = client.get(f"/api/jobs/{body['jobId']}", headers=headers)
    assert job.json()["status"] == "completed"
    streamed = client.post("/api/ai/chat/stream", headers=headers, json={"message": "What does ForgeArc ship?"})
    assert streamed.status_code == 200
    assert "citations" in streamed.text
    assert "costUsd" in streamed.text
    usage = client.get("/api/usage", headers=headers).json()
    assert usage["calls"] == 1
    assert usage["costUsd"] > 0
    store = container.get("Store")
    assert "hidden.person@example.com" not in json.dumps([row.metadata for row in store.audit])
    signature = store.webhooks[0]["signature"]
    assert signature == sign_webhook("hook-secret", store.webhooks[0]["body"])
    other = issue_token(settings(), Principal("bea@example.com", "tenant-b", ["ai:read"], ["ai"]))
    isolated = client.post("/api/retrieval", headers={"Authorization": f"Bearer {other}"}, json={"query": "ForgeArc ships source code"})
    assert isolated.json()["matches"] == []
    removed = client.delete("/api/corpora/corpus-1", headers=headers)
    assert removed.json()["removedChunks"] >= 1


def test_budget_moderation_and_tool_policy():
    client, _container = api(settings(budget={"monthly_usd": 0}))
    headers = login(client)
    rejected = client.post("/api/ai/chat", headers=headers, json={"message": "hello"})
    assert rejected.status_code == 429
    client, _container = api()
    headers = login(client)
    moderated = client.post("/api/ai/chat", headers=headers, json={"message": "this has a blocked-phrase inside"})
    assert moderated.status_code == 422
    tools = client.post("/api/ai/chat", headers=headers, json={"message": "hello", "tools": ["shell"]})
    assert tools.status_code == 422


def test_prompt_is_not_copied_into_the_audit_log():
    client, container = api()
    headers = login(client)
    message = "reach me at hidden.person@example.com"
    response = client.post("/api/ai/chat", headers=headers, json={"message": message})
    assert response.status_code == 200
    dumped = json.dumps([row.metadata for row in container.get("Store").audit])
    assert "hidden.person@example.com" not in dumped


def test_jev_pins_version_and_requests_review():
    client, _container = api()
    headers = login(client)
    response = client.post(
        "/api/decisions/evaluate",
        headers=headers,
        json={
            "state": "A customer asks for a refund.",
            "questions": [
                {"id": "queue", "kind": "choice", "options": ["billing", "technical"]},
                {"id": "priority", "kind": "score"},
                {"id": "refund", "kind": "boolean"},
            ],
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["model"] == "jev-1.13.0"
    assert payload["reviewRequired"] is True
    assert payload["usage"]["costUsd"] > 0
    assert {item["kind"] for item in payload["answers"]} == {"choice", "score", "boolean"}
    report = calibrate([(0.9, False), (0.9, False), (0.2, False)])
    assert report["expectedCalibrationError"] > 0.5


def test_production_credentials_and_aliases_fail():
    with pytest.raises(ConfigError):
        load_settings_from(
            """
environment: prod
chat: {provider: openai, model: gpt-4o-mini, allowlist: [gpt-4o-mini]}
embeddings: {provider: openai, model: text-embedding-3-small, allowlist: [text-embedding-3-small]}
"""
        )
    with pytest.raises(ConfigError, match="Pin a Jev"):
        settings(
            environment="prod",
            local_users=[],
            auth={"jwt_secret": "prod-secret-prod-secret-prod-secret"},
            chat={"provider": "bedrock", "model": "amazon.titan", "allowlist": ["amazon.titan"]},
            embeddings={"provider": "bedrock", "model": "amazon.embed", "allowlist": ["amazon.embed"]},
            aws_region="us-east-1",
            jev={"enabled": True, "model": "jev-latest", "api_key": "jev-live"},
        )


def test_manifest_matches_the_chat_route():
    import forgearc_ai_api.controllers  # noqa: F401

    paths = [route["path"] for route in route_registry.manifest()["lambdas"]["api"]["routes"]]
    assert "/api/ai/chat" in paths
    assert "/api/ai/chat/stream" in paths
    assert "/api/decisions/evaluate" in paths


def test_schema_and_pgvector_query_are_tenant_scoped():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    assert "chunks" in Base.metadata.tables
    sql = postgres_search_sql()
    assert "tenant_id = :tenant_id" in sql
    assert "<=>" in sql


def test_provider_adapters_and_least_privilege():
    seen = {}

    def transport(method, url, api_key, payload):
        seen["url"] = url
        seen["model"] = payload["model"]
        if url.endswith("/embeddings"):
            return {"data": [{"index": 0, "embedding": [0.2, 0.8]}]}
        if method == "STREAM":
            return ["data: {\"choices\":[{\"delta\":{\"content\":\"Hi\"}}]}", "data: {\"usage\":{\"prompt_tokens\":4,\"completion_tokens\":1}}"]
        return {"choices": [{"message": {"content": "{\"answer\":\"ok\"}"}}], "usage": {"prompt_tokens": 4, "completion_tokens": 2}}

    provider = OpenAIProvider("sk-test", "gpt-4o-mini", "text-embedding-3-small", ["gpt-4o-mini", "text-embedding-3-small"], transport)
    result = provider.complete("hello", {"required": ["answer"], "properties": {"answer": {"type": "string"}}})
    assert result.structured["answer"] == "ok"
    assert provider.embed(["hello"]) == [[0.2, 0.8]]
    deltas = list(provider.stream("hello"))
    assert deltas[0][0] == "Hi"

    class Body:
        def read(self):
            return b'{"embedding": [0.1, 0.2]}'

    class Client:
        def converse(self, **_kwargs):
            return {"output": {"message": {"content": [{"text": "bedrock"}]}}, "usage": {"inputTokens": 2, "outputTokens": 1}}

        def converse_stream(self, **_kwargs):
            return {"stream": [{"contentBlockDelta": {"delta": {"text": "bed"}}}, {"metadata": {"usage": {"inputTokens": 2, "outputTokens": 1}}}]}

        def invoke_model(self, **_kwargs):
            return {"body": Body()}

    bedrock = BedrockProvider("amazon.titan", "amazon.embed", ["amazon.titan", "amazon.embed"], "us-east-1", Client())
    assert bedrock.complete("hello").text == "bedrock"
    assert list(bedrock.stream("hello"))[-1][1].output_tokens == 1
    statements = api_statements("arn:aws:s3:::docs", "arn:aws:sqs:us-east-1:1:jobs", "arn:aws:secretsmanager:us-east-1:1:secret:ai", "us-east-1")
    assert all("*" not in action for statement in statements for action in statement["actions"])
    assert ["s3:GetObject", "s3:PutObject"] in [statement["actions"] for statement in statements]


def test_worker_reports_failed_records(monkeypatch):
    from forgearc_ai_api.worker import handler

    class Broken:
        def process_message(self, _payload):
            raise RuntimeError("failed")

    class Graph:
        def get(self, _name):
            return Broken()

    class Application:
        state = type("State", (), {"container": Graph()})()

    monkeypatch.setattr("forgearc_ai_api.worker.create_app", lambda: Application())
    assert handler({"Records": [{"body": "job-1", "messageId": "abc"}]}, None) == {"batchItemFailures": [{"itemIdentifier": "abc"}]}


def test_vertex_documents_and_jobs_use_the_gcp_interfaces():
    from forgearc_ai.errors import PolicyError
    from forgearc_ai_gcp.gcp import FirestoreJobs, GcsDocuments, PubSubQueue, load_secret
    from forgearc_ai_gcp.vertex import VertexProvider

    class Storage:
        def __init__(self):
            self.objects = {}

        def upload(self, bucket, key, content):
            self.objects[(bucket, key)] = content

        def download(self, bucket, key):
            return self.objects[(bucket, key)]

    class Jobs:
        def __init__(self):
            self.rows = {}

        def put(self, job_id, fields):
            self.rows[job_id] = fields

        def get(self, job_id):
            return self.rows.get(job_id)

    class Publisher:
        def __init__(self):
            self.messages = []

        def publish(self, topic, data):
            self.messages.append((topic, data))

            class Done:
                def result(self):
                    return "published"

            return Done()

    class Vertex:
        def generate(self, model, prompt):
            assert model == "gemini-2.0-flash"
            return {"text": "cited", "input_tokens": 3, "output_tokens": 2}

        def stream(self, model, prompt):
            yield "cit"
            yield {"input_tokens": 3, "output_tokens": 1}

        def embed(self, model, texts):
            assert model == "text-embedding-004"
            return [[0.1, 0.2] for _ in texts]

    storage = Storage()
    documents = GcsDocuments(storage)
    documents.put("docs", "one", b"hello")
    assert documents.get("docs", "one") == b"hello"

    jobs = FirestoreJobs(Jobs())
    publisher = Publisher()
    queue = PubSubQueue(publisher, "projects/demo/topics/ingest", jobs)
    queue.send("job-1")
    assert publisher.messages == [("projects/demo/topics/ingest", b"job-1")]
    assert jobs.get("job-1") == {"status": "queued"}
    queue.record_status("job-1", "completed")
    assert jobs.get("job-1") == {"status": "completed", "error": ""}

    class Secrets:
        def access(self, _secret_id):
            return '{"openai":"hidden"}'

    assert load_secret(Secrets(), "projects/demo/secrets/forgearc/versions/latest")["openai"] == "hidden"

    provider = VertexProvider(
        "gemini-2.0-flash",
        "text-embedding-004",
        ["gemini-2.0-flash", "text-embedding-004"],
        "demo",
        "us-central1",
        Vertex(),
    )
    assert provider.complete("hello").text == "cited"
    assert list(provider.stream("hello"))[-1][1].output_tokens == 1
    assert provider.embed(["a"]) == [[0.1, 0.2]]
    blocked = VertexProvider("gemini-2.0-flash", "other", ["gemini-2.0-flash"], "demo", "us-central1", Vertex())
    with pytest.raises(PolicyError):
        blocked.embed(["a"])

    config = settings(
        chat={"provider": "vertex", "model": "gemini-2.0-flash", "allowlist": ["gemini-2.0-flash"]},
        embeddings={"provider": "vertex", "model": "text-embedding-004", "allowlist": ["text-embedding-004"]},
        documents_provider="gcs",
        jobs_provider="pubsub",
        gcp_project="demo",
        gcp_location="us-central1",
        queue_url="projects/demo/topics/ingest",
    )
    container = build_container(config, vertex_client=Vertex(), gcs_client=storage, pubsub_publisher=publisher, firestore_client=Jobs())
    assert container.get("ChatService").provider.complete("hello").text == "cited"


def test_cloud_presets_select_adapters_without_repeating_provider_yaml():
    from forgearc_ai_gcp.gcp import GcsDocuments, PubSubQueue
    from forgearc_ai_gcp.vertex import VertexProvider
    from forgearc_ai_aws.aws import S3Documents, SqsQueue
    from forgearc_ai_aws.bedrock import BedrockProvider

    aws = Settings.model_validate(
        {
            "environment": "test",
            "cloud": "aws",
            "jev": {"enabled": False},
        }
    )
    assert aws.chat.provider == "bedrock"
    assert aws.documents_provider == "s3"
    assert aws.jobs_provider == "sqs"
    aws_container = build_container(aws)
    assert isinstance(aws_container.get("ChatService").provider, BedrockProvider)
    assert isinstance(aws_container.get("IngestionService").documents, S3Documents)
    assert isinstance(aws_container.get("IngestionService").queue, SqsQueue)

    gcp = Settings.model_validate(
        {
            "environment": "test",
            "cloud": "gcp",
            "gcp_project": "demo",
            "gcp_location": "us-central1",
            "queue_url": "projects/demo/topics/ingest",
            "jev": {"enabled": False},
        }
    )
    assert gcp.chat.provider == "vertex"
    assert gcp.documents_provider == "gcs"
    assert gcp.jobs_provider == "pubsub"
    gcp_container = build_container(gcp)
    assert isinstance(gcp_container.get("ChatService").provider, VertexProvider)
    assert isinstance(gcp_container.get("IngestionService").documents, GcsDocuments)
    assert isinstance(gcp_container.get("IngestionService").queue, PubSubQueue)


def test_deployment_environment_selects_cloud_and_generated_resources():
    config = load_settings_from(
        "environment: local\ncloud: local\njev: {enabled: false}\n",
        {
            "FORGEARC_AI_ENVIRONMENT": "test",
            "FORGEARC_AI_CLOUD": "gcp",
            "FORGEARC_AI_BUCKET": "generated-documents",
            "FORGEARC_AI_QUEUE_URL": "projects/demo/topics/generated-ingest",
            "FORGEARC_AI_FIRESTORE_DATABASE": "forgearc-ai-dev",
            "GCP_PROJECT": "demo",
            "GCP_LOCATION": "us-central1",
        },
    )
    assert config.cloud == "gcp"
    assert config.chat.provider == "vertex"
    assert config.bucket == "generated-documents"
    assert config.queue_url == "projects/demo/topics/generated-ingest"
    assert config.firestore_database == "forgearc-ai-dev"


def test_pubsub_push_endpoint_decodes_job_id():
    config = settings()
    container = build_container(config, jev_transport=jev_transport)

    class Ingestion:
        def __init__(self):
            self.jobs = []

        def process_message(self, payload):
            self.jobs.append(payload)

    ingestion = Ingestion()
    container.bind_constant("IngestionService", ingestion)
    client = TestClient(create_app(config, container))
    encoded = base64.b64encode(b"job-gcp-1").decode()
    response = client.post(
        "/internal/pubsub",
        json={"message": {"data": encoded, "messageId": "message-1"}},
    )
    assert response.status_code == 200
    assert response.json() == {"ok": True, "jobId": "job-gcp-1"}
    assert ingestion.jobs == ["job-gcp-1"]
    assert client.post("/internal/pubsub", json={"message": {}}).status_code == 400


def test_queued_job_restores_in_a_fresh_worker_process():
    from forgearc_ai.providers.fake import FakeChatProvider
    from forgearc_ai.services import IngestionService
    from forgearc_ai.stores import MemoryGraph

    class Documents:
        def __init__(self):
            self.values = {}

        def put(self, bucket, key, content):
            self.values[(bucket, key)] = content

        def get(self, bucket, key):
            return self.values[(bucket, key)]

    class Queue:
        def __init__(self):
            self.payload = None

        def send(self, _job_id, payload=None):
            self.payload = payload

    config = settings(documents_provider="gcs", jobs_provider="pubsub")
    provider = FakeChatProvider("fake-chat", ["fake-chat", "fake-embed"])
    documents = Documents()
    queue = Queue()
    submitter = IngestionService(
        config,
        provider,
        MemoryGraph(),
        documents,
        queue,
    )
    submitted = submitter.submit(
        Principal(
            email="ada@example.com",
            tenant_id="tenant-a",
            permissions=["ai:ingest"],
            modules=["ai"],
        ),
        "policy.md",
        b"Cloud-independent worker payload.",
        "policies",
        "request-1",
    )
    assert queue.payload["jobId"] == submitted["jobId"]

    worker = IngestionService(
        config,
        provider,
        MemoryGraph(),
        documents,
    )
    completed = worker.process_message(queue.payload)
    assert completed.status == "completed"
    assert worker.store.chunks[0].tenant_id == "tenant-a"


def load_settings_from(text: str, environ: dict[str, str] | None = None):
    from pathlib import Path
    import tempfile

    handle = tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False)
    handle.write(text)
    handle.close()
    return load_settings(Path(handle.name), environ or {})
