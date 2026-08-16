from __future__ import annotations

import os
from typing import Protocol


class AIProvider(Protocol):
    def chat(self, message: str) -> dict: ...


class StubProvider:
    def chat(self, message: str) -> dict:
        return {"provider": "stub", "reply": f"Echo: {message}"}


class OpenAIProvider:
    def chat(self, message: str) -> dict:
        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            return StubProvider().chat(message)
        return {
            "provider": "openai",
            "reply": f"[openai-stub] {message}",
            "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        }


class BedrockProvider:
    def chat(self, message: str) -> dict:
        if not os.environ.get("AWS_REGION"):
            return StubProvider().chat(message)
        return {
            "provider": "bedrock",
            "reply": f"[bedrock-stub] {message}",
            "model": os.environ.get("BEDROCK_MODEL", "anthropic.claude-3-haiku"),
        }


def get_provider() -> AIProvider:
    name = (os.environ.get("AI_PROVIDER") or "stub").lower()
    if name == "openai":
        return OpenAIProvider()
    if name == "bedrock":
        return BedrockProvider()
    return StubProvider()
