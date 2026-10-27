from __future__ import annotations

import hashlib
import json
from collections.abc import Iterator

from forgearc_ai.auth import Principal
from forgearc_ai.config import Settings
from forgearc_ai.contracts import ModelProvider
from forgearc_ai.cost import token_cost
from forgearc_ai.policy import PolicyGate
from forgearc_ai.repositories import AuditRecord, Repository, UsageRecord


class ChatService:
    def __init__(
        self,
        settings: Settings,
        provider: ModelProvider,
        gate: PolicyGate,
        repository: Repository,
    ):
        self.settings = settings
        self.provider = provider
        self.gate = gate
        self.repository = repository

    def complete(self, principal: Principal, body: dict) -> dict:
        prompt, citations = self._prepare(principal, body)
        result = self.provider.complete(prompt, body.get("responseSchema"))
        self._account(
            principal,
            body,
            result.input_tokens,
            result.output_tokens,
            result.text,
        )
        return {
            "reply": result.text,
            "structured": result.structured,
            "citations": citations,
            "usage": self._usage(result.input_tokens, result.output_tokens),
        }

    def stream(self, principal: Principal, body: dict) -> Iterator[str]:
        prompt, citations = self._prepare(principal, body)
        input_tokens = 0
        output_tokens = 0
        text = ""
        for delta, result in self.provider.stream(prompt):
            if delta:
                text += delta
                yield _sse({"delta": delta})
            if result.text or result.input_tokens:
                text = result.text or text
                input_tokens = result.input_tokens
                output_tokens = result.output_tokens
        self._account(principal, body, input_tokens, output_tokens, text)
        yield _sse(
            {
                "citations": citations,
                "usage": self._usage(input_tokens, output_tokens),
                "done": True,
            }
        )

    def _prepare(
        self,
        principal: Principal,
        body: dict,
    ) -> tuple[str, list[dict]]:
        message = (body.get("message") or "").strip()
        tools = list(body.get("tools") or [])
        self.gate.check_prompt(principal, message, tools)
        conversation = body.get("conversationId") or "default"
        history = self.repository.history(principal.tenant_id, conversation)
        embedding = self.provider.embed([message])[0]
        matches = self.repository.search(
            principal.tenant_id,
            embedding,
            self.settings.top_k,
        )
        citations = [
            chunk.citation() | {"score": round(score, 4)}
            for score, chunk in matches
            if score > 0
        ]
        context = "\n".join(item["excerpt"] for item in citations)
        return f"History: {history}\nSources:\n{context}\nQuestion: {message}", citations

    def _account(
        self,
        principal: Principal,
        body: dict,
        input_tokens: int,
        output_tokens: int,
        text: str,
    ) -> None:
        usage = self._usage(input_tokens, output_tokens)
        self.gate.record_cost(principal.tenant_id, usage["costUsd"])
        self.repository.add_usage(
            UsageRecord(
                principal.tenant_id,
                self.settings.chat.model,
                input_tokens,
                output_tokens,
                usage["costUsd"],
                "chat",
            )
        )
        conversation = body.get("conversationId") or "default"
        self.repository.remember(
            principal.tenant_id,
            conversation,
            "user",
            body.get("message") or "",
        )
        self.repository.remember(
            principal.tenant_id,
            conversation,
            "assistant",
            text,
        )
        message = body.get("message") or ""
        self.repository.add_audit(
            AuditRecord(
                principal.tenant_id,
                principal.email,
                "chat",
                conversation,
                {
                    "promptSha256": hashlib.sha256(message.encode()).hexdigest(),
                    "promptChars": len(message),
                },
            )
        )

    def _usage(self, input_tokens: int, output_tokens: int) -> dict:
        cost = token_cost(
            self.settings,
            self.settings.chat.model,
            input_tokens,
            output_tokens,
        )
        return {
            "model": self.settings.chat.model,
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
            "costUsd": cost,
        }


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, separators=(',', ':'))}\n\n"
