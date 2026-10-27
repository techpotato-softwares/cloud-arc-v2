from __future__ import annotations

from forgearc_ai.config import Settings


def token_cost(
    settings: Settings,
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> float:
    pricing = settings.pricing.get(model)
    if pricing is None:
        return 0.0
    return (
        input_tokens * pricing.input_per_million
        + output_tokens * pricing.output_per_million
    ) / 1_000_000
