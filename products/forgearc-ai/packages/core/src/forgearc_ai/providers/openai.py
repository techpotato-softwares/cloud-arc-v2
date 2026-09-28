from __future__ import annotations

import json
from typing import Callable

from forgearc_ai.errors import PolicyError, ProviderError
from forgearc_ai.providers.fake import ModelResult

Transport = Callable[[str, str, str, dict], dict]


class OpenAIProvider:
    def __init__(self, api_key: str, chat_model: str, embed_model: str, allowlist: list[str], transport: Transport | None = None):
        self.api_key = api_key
        self.chat_model = chat_model
        self.embed_model = embed_model
        self.allowlist = allowlist
        self.transport = transport or _http_transport

    def complete(self, prompt: str, response_schema: dict | None = None) -> ModelResult:
        self._require_model(self.chat_model)
        payload: dict = {
            "model": self.chat_model,
            "messages": [{"role": "user", "content": prompt}],
        }
        if response_schema:
            payload["response_format"] = {"type": "json_schema", "json_schema": {"name": "answer", "schema": response_schema}}
        body = self.transport("POST", "https://api.openai.com/v1/chat/completions", self.api_key, payload)
        text = body["choices"][0]["message"]["content"]
        usage = body.get("usage") or {}
        structured = json.loads(text) if response_schema else None
        return ModelResult(text, int(usage.get("prompt_tokens", 0)), int(usage.get("completion_tokens", 0)), structured)

    def stream(self, prompt: str):
        self._require_model(self.chat_model)
        payload = {"model": self.chat_model, "messages": [{"role": "user", "content": prompt}], "stream": True, "stream_options": {"include_usage": True}}
        lines = self.transport("STREAM", "https://api.openai.com/v1/chat/completions", self.api_key, payload)
        input_tokens = 0
        output_tokens = 0
        parts: list[str] = []
        for line in lines:
            if not line.startswith("data: ") or line.strip() == "data: [DONE]":
                continue
            event = json.loads(line.removeprefix("data: "))
            usage = event.get("usage") or {}
            input_tokens = int(usage.get("prompt_tokens", input_tokens))
            output_tokens = int(usage.get("completion_tokens", output_tokens))
            delta = ((event.get("choices") or [{}])[0].get("delta") or {}).get("content") or ""
            if delta:
                parts.append(delta)
                yield delta, ModelResult("", 0, 0)
        text = "".join(parts)
        yield "", ModelResult(text, input_tokens or max(1, len(prompt) // 4), output_tokens or max(1, len(text) // 4))

    def embed(self, texts: list[str]) -> list[list[float]]:
        self._require_model(self.embed_model)
        body = self.transport(
            "POST",
            "https://api.openai.com/v1/embeddings",
            self.api_key,
            {"model": self.embed_model, "input": texts},
        )
        rows = sorted(body["data"], key=lambda item: item["index"])
        return [row["embedding"] for row in rows]

    def _require_model(self, model: str) -> None:
        if not self.api_key:
            raise ProviderError("OPENAI_API_KEY is not configured.")
        if model not in self.allowlist:
            raise PolicyError(f"Model {model} is not allowlisted.")


def _http_transport(method: str, url: str, api_key: str, payload: dict):
    import httpx

    headers = {"Authorization": f"Bearer {api_key}"}
    if method == "STREAM":
        lines: list[str] = []
        with httpx.stream("POST", url, headers=headers, json=payload, timeout=60) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if line:
                    lines.append(line)
        return lines
    response = httpx.post(url, headers=headers, json=payload, timeout=60)
    response.raise_for_status()
    return response.json()
