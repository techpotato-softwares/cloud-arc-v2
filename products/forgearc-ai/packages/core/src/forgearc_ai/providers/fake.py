from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass

from forgearc_ai.errors import PolicyError, ProviderError


@dataclass
class ModelResult:
    text: str
    input_tokens: int
    output_tokens: int
    structured: dict | None = None


class FakeChatProvider:
    def __init__(self, model: str, allowlist: list[str]):
        self.model = model
        self.allowlist = allowlist

    def complete(self, prompt: str, response_schema: dict | None = None) -> ModelResult:
        self._check()
        if response_schema:
            properties = response_schema.get("properties", {})
            payload = {key: "ok" for key in properties}
            text = json.dumps(payload)
            return ModelResult(text, _tokens(prompt), _tokens(text), payload)
        text = "Answer grounded in the supplied sources."
        return ModelResult(text, _tokens(prompt), _tokens(text))

    def stream(self, prompt: str):
        result = self.complete(prompt)
        for word in result.text.split():
            yield word + " ", ModelResult("", 0, 0)
        yield "", result

    def embed(self, texts: list[str]) -> list[list[float]]:
        self._check()
        return [_embed(text) for text in texts]

    def _check(self) -> None:
        if self.model not in self.allowlist:
            raise PolicyError(f"Model {self.model} is not allowlisted.")


def _tokens(text: str) -> int:
    return max(1, len(text) // 4)


def _embed(text: str, dimensions: int = 16) -> list[float]:
    vector = [0.0] * dimensions
    for token in text.lower().split():
        digest = hashlib.sha256(token.encode()).digest()
        vector[digest[0] % dimensions] += 1
    total = sum(vector) or 1
    return [value / total for value in vector]
