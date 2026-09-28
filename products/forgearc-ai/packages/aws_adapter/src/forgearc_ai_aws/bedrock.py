"""ForgeArc AI AWS adapter. Licensed to the purchasing organization."""

from __future__ import annotations

import json

from forgearc_ai.errors import PolicyError, ProviderError
from forgearc_ai.providers.fake import ModelResult


class BedrockProvider:
    def __init__(self, model: str, embed_model: str, allowlist: list[str], region: str, client=None):
        self.model = model
        self.embed_model = embed_model
        self.allowlist = allowlist
        self.region = region
        self.client = client

    def complete(self, prompt: str, response_schema: dict | None = None) -> ModelResult:
        self._check()
        response = self._client().converse(
            modelId=self.model,
            messages=[{"role": "user", "content": [{"text": prompt}]}],
        )
        text = response["output"]["message"]["content"][0]["text"]
        usage = response.get("usage") or {}
        structured = json.loads(text) if response_schema else None
        return ModelResult(text, int(usage.get("inputTokens", 0)), int(usage.get("outputTokens", 0)), structured)

    def stream(self, prompt: str):
        self._check()
        response = self._client().converse_stream(
            modelId=self.model,
            messages=[{"role": "user", "content": [{"text": prompt}]}],
        )
        parts: list[str] = []
        input_tokens = 0
        output_tokens = 0
        for event in response["stream"]:
            delta = ((event.get("contentBlockDelta") or {}).get("delta") or {}).get("text") or ""
            metadata = event.get("metadata") or {}
            usage = metadata.get("usage") or {}
            input_tokens = int(usage.get("inputTokens", input_tokens))
            output_tokens = int(usage.get("outputTokens", output_tokens))
            if delta:
                parts.append(delta)
                yield delta, ModelResult("", 0, 0)
        text = "".join(parts)
        yield "", ModelResult(text, input_tokens, output_tokens)

    def embed(self, texts: list[str]) -> list[list[float]]:
        self._check()
        vectors = []
        client = self._client()
        for text in texts:
            response = client.invoke_model(modelId=self.embed_model, body=json.dumps({"inputText": text}))
            payload = json.loads(response["body"].read())
            vectors.append(payload["embedding"])
        return vectors

    def _client(self):
        if self.client is not None:
            return self.client
        import boto3

        return boto3.client("bedrock-runtime", region_name=self.region)

    def _check(self) -> None:
        if self.model not in self.allowlist or self.embed_model not in self.allowlist:
            raise PolicyError("A Bedrock model is not allowlisted.")
        if not self.region:
            raise ProviderError("AWS_REGION is not configured.")
