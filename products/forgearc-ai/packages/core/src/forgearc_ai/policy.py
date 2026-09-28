from __future__ import annotations

import time
from collections import defaultdict

from forgearc_ai.auth import Principal
from forgearc_ai.config import Settings
from forgearc_ai.errors import BudgetExceeded, PolicyError, RateLimited


class PolicyGate:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.calls: dict[str, list[float]] = defaultdict(list)
        self.spent: dict[str, float] = defaultdict(float)

    def check_prompt(self, principal: Principal, prompt: str, tools: list[str] | None) -> None:
        if len(prompt) > self.settings.limits.prompt_chars:
            raise PolicyError("The prompt is longer than the configured limit.")
        lowered = prompt.lower()
        blocked = next((term for term in self.settings.moderation_terms if term.lower() in lowered), None)
        if blocked:
            raise PolicyError("The prompt was rejected by the moderation list.")
        for tool in tools or []:
            if tool not in self.settings.tool_allowlist:
                raise PolicyError(f"Tool {tool} is not on the allowlist.")
        self._rate_limit(principal.tenant_id)
        if self.settings.budget.monthly_usd <= 0 or self.spent[principal.tenant_id] >= self.settings.budget.monthly_usd:
            raise BudgetExceeded("The tenant budget is exhausted.")

    def record_cost(self, tenant_id: str, cost: float) -> None:
        self.spent[tenant_id] += cost

    def _rate_limit(self, tenant_id: str) -> None:
        now = time.monotonic()
        window = [stamp for stamp in self.calls[tenant_id] if now - stamp < 60]
        if len(window) >= self.settings.limits.requests_per_minute:
            raise RateLimited("Too many requests for this tenant.")
        window.append(now)
        self.calls[tenant_id] = window
