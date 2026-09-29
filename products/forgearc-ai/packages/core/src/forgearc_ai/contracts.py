from __future__ import annotations

from collections.abc import Iterator
from typing import Protocol

from forgearc_ai.providers.fake import ModelResult


class ModelProvider(Protocol):
    def complete(
        self, prompt: str, response_schema: dict | None = None
    ) -> ModelResult: ...

    def stream(self, prompt: str) -> Iterator[tuple[str, ModelResult]]: ...

    def embed(self, texts: list[str]) -> list[list[float]]: ...


class DocumentStore(Protocol):
    def put(self, bucket: str, key: str, content: bytes) -> None: ...

    def get(self, bucket: str, key: str) -> bytes: ...


class JobQueue(Protocol):
    def send(self, job_id: str, payload: dict | None = None) -> None: ...

    def record_status(
        self, job_id: str, status: str, error: str = ""
    ) -> None: ...
