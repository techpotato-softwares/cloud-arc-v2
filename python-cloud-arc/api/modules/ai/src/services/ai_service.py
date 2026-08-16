from __future__ import annotations

from typing import Protocol

from core.di import injectable
from modules.ai.src.providers import get_provider


class IAiService(Protocol):
    def chat(self, message: str) -> dict: ...


@injectable
class AiService:
    def chat(self, message: str) -> dict:
        result = get_provider().chat(message or "")
        result["hint"] = "Set AI_PROVIDER=openai|bedrock and provider credentials for live calls."
        return result
