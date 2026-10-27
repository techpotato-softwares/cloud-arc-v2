from __future__ import annotations

from forgearc_ai.auth import Principal
from forgearc_ai.config import Settings
from forgearc_ai.cost import token_cost
from forgearc_ai.policy import PolicyGate
from forgearc_ai.providers.jev import DecisionAnswer, JevProvider
from forgearc_ai.repositories import AuditRecord, Repository, UsageRecord


class DecisionService:
    def __init__(
        self,
        settings: Settings,
        provider: JevProvider,
        gate: PolicyGate,
        repository: Repository,
    ):
        self.settings = settings
        self.provider = provider
        self.gate = gate
        self.repository = repository

    def evaluate(self, principal: Principal, body: dict) -> dict:
        state = body.get("state") or ""
        self.gate.check_prompt(principal, state, [])
        answers, tokens = self.provider.evaluate(
            state,
            list(body.get("questions") or []),
        )
        cost = token_cost(self.settings, self.settings.jev.model, tokens, 0)
        self.gate.record_cost(principal.tenant_id, cost)
        self.repository.add_usage(
            UsageRecord(
                principal.tenant_id,
                self.settings.jev.model,
                tokens,
                0,
                cost,
                "decision",
            )
        )
        review = any(answer.review_required for answer in answers)
        self.repository.add_audit(
            AuditRecord(
                principal.tenant_id,
                principal.email,
                "decision",
                self.settings.jev.model,
                {"review": review},
            )
        )
        return {
            "model": self.settings.jev.model,
            "reviewRequired": review,
            "usage": {
                "model": self.settings.jev.model,
                "inputTokens": tokens,
                "outputTokens": 0,
                "costUsd": cost,
            },
            "answers": [_answer(item) for item in answers],
        }


def _answer(item: DecisionAnswer) -> dict:
    return {
        "id": item.id,
        "kind": item.kind,
        "value": item.value,
        "probability": item.probability,
        "confidence": item.confidence,
        "reviewRequired": item.review_required,
    }
