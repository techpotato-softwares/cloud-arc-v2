from __future__ import annotations

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
        def process(self, _job_id):
            raise RuntimeError("failed")

    class Graph:
        def get(self, _name):
            return Broken()

    class Application:
        state = type("State", (), {"container": Graph()})()

    monkeypatch.setattr("forgearc_ai_api.worker.create_app", lambda: Application())
    assert handler({"Records": [{"body": "job-1", "messageId": "abc"}]}, None) == {"batchItemFailures": [{"itemIdentifier": "abc"}]}


def load_settings_from(text: str):
    from pathlib import Path
    import tempfile

    handle = tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False)
    handle.write(text)
    handle.close()
    return load_settings(Path(handle.name), {})
