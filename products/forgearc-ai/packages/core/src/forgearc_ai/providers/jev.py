from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from forgearc_ai.errors import ConfigError, ProviderError

Transport = Callable[[str, str, str, dict], dict]


@dataclass
class DecisionAnswer:
    id: str
    kind: str
    value: str | float | bool
    probability: float
    confidence: float
    review_required: bool


class JevProvider:
    """TypeSafe AI Jev. State goes in; typed Choice, Score, and Boolean answers come out."""

    def __init__(self, api_key: str, model: str, base_url: str, review_confidence: float, transport: Transport | None = None):
        if model.endswith("-latest") or model.endswith("-preview"):
            raise ConfigError("Pin a Jev model version. Aliases can change results without a code change.")
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.review_confidence = review_confidence
        self.transport = transport or _http_transport

    def evaluate(self, state: str, questions: list[dict]) -> tuple[list[DecisionAnswer], int]:
        if not self.api_key:
            raise ProviderError("JEV_API_KEY is not configured.")
        for question in questions:
            if question.get("kind") not in {"choice", "score", "boolean"}:
                raise ProviderError("Jev questions must be choice, score, or boolean.")
            if question["kind"] == "choice" and not question.get("options"):
                raise ProviderError("Choice questions require options.")
        body = self.transport(
            "POST",
            f"{self.base_url}/v1/evaluate",
            self.api_key,
            {
                "model": self.model,
                "state": state,
                "questions": questions,
                "zero_data_retention": True,
                "no_training": True,
            },
        )
        if body.get("model") != self.model:
            raise ProviderError("Jev returned a different model than the pinned version.")
        answers = [
            DecisionAnswer(
                id=item["id"],
                kind=item["kind"],
                value=item["value"],
                probability=float(item.get("probability", 0)),
                confidence=float(item.get("confidence", 0)),
                review_required=float(item.get("confidence", 0)) < self.review_confidence,
            )
            for item in body.get("answers", [])
        ]
        tokens = int((body.get("usage") or {}).get("input_tokens", max(1, len(state) // 4)))
        return answers, tokens


def calibrate(samples: list[tuple[float, bool]], bins: int = 5) -> dict:
    """Confidence calibration. Each sample is (confidence, correct)."""
    if not samples:
        return {"bins": [], "expectedCalibrationError": 0.0}
    width = 1 / bins
    rows = []
    error = 0.0
    for index in range(bins):
        low = index * width
        high = low + width
        group = [item for item in samples if low <= item[0] < high or (index == bins - 1 and item[0] == 1)]
        if not group:
            continue
        confidence = sum(item[0] for item in group) / len(group)
        accuracy = sum(1 for item in group if item[1]) / len(group)
        error += abs(accuracy - confidence) * (len(group) / len(samples))
        rows.append({"low": low, "high": high, "count": len(group), "confidence": confidence, "accuracy": accuracy})
    return {"bins": rows, "expectedCalibrationError": error}


def _http_transport(method: str, url: str, api_key: str, payload: dict) -> dict:
    import httpx

    response = httpx.request(method, url, headers={"Authorization": f"Bearer {api_key}"}, json=payload, timeout=30)
    response.raise_for_status()
    return response.json()
