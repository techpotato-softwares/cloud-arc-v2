"""ForgeArc AI GCP adapter. Licensed to the purchasing organization."""

from __future__ import annotations

import json

from forgearc_ai.errors import PolicyError, ProviderError
from forgearc_ai.providers.fake import ModelResult


class VertexProvider:
    def __init__(
        self,
        model: str,
        embed_model: str,
        allowlist: list[str],
        project: str,
        location: str,
        client=None,
    ):
        self.model = model
        self.embed_model = embed_model
        self.allowlist = allowlist
        self.project = project
        self.location = location
        self.client = client

    def complete(self, prompt: str, response_schema: dict | None = None) -> ModelResult:
        self._check()
        response = self._client().generate(self.model, prompt)
        text = response["text"]
        structured = json.loads(text) if response_schema else None
        return ModelResult(
            text,
            int(response.get("input_tokens", 0)),
            int(response.get("output_tokens", 0)),
            structured,
        )

    def stream(self, prompt: str):
        self._check()
        parts: list[str] = []
        input_tokens = 0
        output_tokens = 0
        for event in self._client().stream(self.model, prompt):
            if isinstance(event, str):
                parts.append(event)
                yield event, ModelResult("", 0, 0)
                continue
            input_tokens = int(event.get("input_tokens", input_tokens))
            output_tokens = int(event.get("output_tokens", output_tokens))
        text = "".join(parts)
        yield "", ModelResult(text, input_tokens, output_tokens)

    def embed(self, texts: list[str]) -> list[list[float]]:
        self._check()
        return self._client().embed(self.embed_model, texts)

    def _client(self):
        if self.client is not None:
            return self.client
        return _VertexSdk(self.project, self.location)

    def _check(self) -> None:
        if self.model not in self.allowlist or self.embed_model not in self.allowlist:
            raise PolicyError("A Vertex AI model is not allowlisted.")
        if not self.project or not self.location:
            raise ProviderError("GCP_PROJECT and GCP_LOCATION are not configured.")


class _VertexSdk:
    def __init__(self, project: str, location: str):
        import vertexai

        vertexai.init(project=project, location=location)
        self.project = project
        self.location = location

    def generate(self, model: str, prompt: str) -> dict:
        from vertexai.generative_models import GenerativeModel

        response = GenerativeModel(model).generate_content(prompt)
        usage = response.usage_metadata
        return {
            "text": response.text,
            "input_tokens": int(getattr(usage, "prompt_token_count", 0) or 0),
            "output_tokens": int(getattr(usage, "candidates_token_count", 0) or 0),
        }

    def stream(self, model: str, prompt: str):
        from vertexai.generative_models import GenerativeModel

        response = GenerativeModel(model).generate_content(prompt, stream=True)
        input_tokens = 0
        output_tokens = 0
        for chunk in response:
            text = getattr(chunk, "text", "") or ""
            usage = getattr(chunk, "usage_metadata", None)
            if usage is not None:
                input_tokens = int(getattr(usage, "prompt_token_count", input_tokens) or input_tokens)
                output_tokens = int(getattr(usage, "candidates_token_count", output_tokens) or output_tokens)
            if text:
                yield text
        yield {"input_tokens": input_tokens, "output_tokens": output_tokens}

    def embed(self, model: str, texts: list[str]) -> list[list[float]]:
        from vertexai.language_models import TextEmbeddingModel

        embeddings = TextEmbeddingModel.from_pretrained(model).get_embeddings(texts)
        return [list(item.values) for item in embeddings]
