"""Container entrypoints and readiness behavior."""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path

from fastapi.testclient import TestClient

from forgearc_ai.config import Settings, validate_settings
from forgearc_ai_api.app import create_app
from forgearc_ai_api.sqs_worker import run_poll
from forgearc_ai_api.wiring import build_container


def settings(**overrides) -> Settings:
    payload = {
        "environment": "test",
        "auth": {"jwt_secret": "test-secret-test-secret-test-secret"},
        "chat": {"provider": "fake", "model": "fake-chat", "allowlist": ["fake-chat"]},
        "embeddings": {"provider": "fake", "model": "fake-embed", "allowlist": ["fake-embed"]},
        "jobs_provider": "inline",
        "jev": {"enabled": False},
    }
    payload.update(overrides)
    return validate_settings(Settings.model_validate(payload))


def test_ready_follows_repository_health():
    config = settings()
    container = build_container(config)
    client = TestClient(create_app(config, container))
    assert client.get("/health").status_code == 200
    assert client.get("/ready").json()["status"] == "ready"

    class Down:
        def healthcheck(self):
            raise RuntimeError("database unavailable")

    container.bind_constant("Repository", Down())
    assert client.get("/ready").status_code == 503


def test_database_url_is_built_from_the_proxy_secret(monkeypatch):
    previous = os.environ.pop("DATABASE_URL", None)
    monkeypatch.setenv("DB_SECRET_ARN", "arn:aws:secretsmanager:us-east-1:1:secret:db")
    monkeypatch.setenv("DB_HOST", "proxy.internal")
    monkeypatch.setenv("DB_NAME", "forgearc_ai")

    class Client:
        def get_secret_value(self, SecretId):
            assert SecretId.startswith("arn:aws:secretsmanager:")
            return {
                "SecretString": json.dumps(
                    {"username": "forgearc", "password": "p@ss word", "port": 5432, "host": "cluster"}
                )
            }

    import boto3

    monkeypatch.setattr(boto3, "client", lambda service: Client())
    from forgearc_ai_api.bootstrap import prepare_database_url

    try:
        prepare_database_url()
        url = os.environ["DATABASE_URL"]
        assert url.startswith(
            "postgresql+psycopg://forgearc:p%40ss%20word@proxy.internal:5432/forgearc_ai"
        )
        assert url.endswith("?sslmode=require")
        assert "cluster" not in url
    finally:
        if previous is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous


def test_worker_deletes_successful_messages_and_keeps_failures():
    class Queue:
        def __init__(self):
            self.deleted = []

        def receive_message(self, **_kwargs):
            return {
                "Messages": [
                    {"Body": json.dumps({"jobId": "ok"}), "ReceiptHandle": "keep", "MessageId": "1"},
                    {"Body": json.dumps({"jobId": "bad"}), "ReceiptHandle": "drop", "MessageId": "2"},
                ]
            }

        def delete_message(self, **kwargs):
            self.deleted.append(kwargs["ReceiptHandle"])

    def process(payload):
        if payload["jobId"] == "bad":
            raise RuntimeError("failed")

    queue = Queue()
    run_poll(
        queue,
        "https://sqs.example/jobs",
        process,
        stop=threading.Event(),
        concurrency=2,
        max_batches=1,
    )
    assert queue.deleted == ["keep"]


def test_api_handler_uses_mangum(monkeypatch):
    calls = {}

    class FakeMangum:
        def __init__(self, app, lifespan="auto"):
            calls["lifespan"] = lifespan
            calls["app"] = app

        def __call__(self, event, context):
            return {"statusCode": 204}

    import forgearc_ai_api.worker as worker

    monkeypatch.setattr("mangum.Mangum", FakeMangum)
    worker._mangum = None
    assert worker.api_handler({}, None)["statusCode"] == 204
    assert calls["lifespan"] == "off"


def test_container_files_declare_api_worker_and_migrate():
    product = Path(__file__).resolve().parents[3]
    dockerfile = (product / "Dockerfile").read_text(encoding="utf-8")
    compose = (product / "docker-compose.yml").read_text(encoding="utf-8")
    entry = (product / "scripts" / "entrypoint.sh").read_text(encoding="utf-8")
    assert "USER 1000" in dockerfile
    assert 'CMD ["api"]' in dockerfile
    assert "postgres:" in compose and "migrate:" in compose
    assert "api:" in compose and "worker:" in compose
    assert "read_only: true" in compose
    for command in ("api)", "worker)", "migrate)"):
        assert command in entry
