"""RAG evaluation with RAGAS metric names.

The native engine is deterministic and offline: it scores support by term overlap and
relevancy with the configured embedding model. It is suited to CI regression gates.
The ragas engine sends the same samples to the RAGAS library, which uses an LLM judge.
"""

from __future__ import annotations

import re
import uuid
from collections.abc import Callable

from forgearc_ai.auth import Principal
from forgearc_ai.config import Settings
from forgearc_ai.contracts import ModelProvider
from forgearc_ai.cost import token_cost
from forgearc_ai.errors import ConfigError, PolicyError
from forgearc_ai.policy import PolicyGate
from forgearc_ai.rag import cosine
from forgearc_ai.repositories import (
    EvaluationRecord,
    Repository,
    UsageRecord,
)

METRICS = ("faithfulness", "answerRelevancy", "contextPrecision", "contextRecall")
RAGAS_NAMES = {
    "faithfulness": "faithfulness",
    "answer_relevancy": "answerRelevancy",
    "context_precision": "contextPrecision",
    "context_recall": "contextRecall",
}
STOPWORDS = frozenset(
    "the and for are but not you all any can had her was one our out has have this that with from they will "
    "what when your which their there been were into than then them these those its also only about does".split()
)
SUPPORT_RATIO = 0.5
RELEVANT_RATIO = 0.3

Embed = Callable[[list[str]], list[list[float]]]


def score_sample(question: str, answer: str, contexts: list[str], reference: str, embed: Embed) -> dict[str, float | None]:
    context_terms = set().union(*(_terms(context) for context in contexts)) if contexts else set()
    sentences = _sentences(answer)
    faithfulness = sum(_supported(sentence, context_terms) for sentence in sentences) / len(sentences) if sentences else 0.0
    question_vector, answer_vector = embed([question, answer or " "])
    target = _terms(reference or question)
    relevant = [_overlap(_terms(context), target) >= RELEVANT_RATIO for context in contexts]
    return {
        "faithfulness": round(faithfulness, 4),
        "answerRelevancy": round(max(0.0, cosine(question_vector, answer_vector)), 4),
        "contextPrecision": round(_ranked_precision(relevant), 4) if contexts else 0.0,
        "contextRecall": round(_recall(reference, context_terms), 4) if reference else None,
    }


def aggregate(results: list[dict[str, float | None]]) -> dict[str, float]:
    scores = {}
    for metric in METRICS:
        values = [row[metric] for row in results if row.get(metric) is not None]
        if values:
            scores[metric] = round(sum(values) / len(values), 4)
    return scores


def ragas_rows(samples: list[dict]) -> list[dict]:
    return [
        {
            "user_input": sample["question"],
            "response": sample["answer"],
            "retrieved_contexts": sample["contexts"],
            **({"reference": sample["reference"]} if sample["reference"] else {}),
        }
        for sample in samples
    ]


def run_ragas(samples: list[dict]) -> list[dict[str, float | None]]:
    try:
        from ragas import EvaluationDataset, evaluate
        from ragas.metrics import answer_relevancy, context_precision, context_recall, faithfulness
    except ImportError as exc:
        raise ConfigError("Install the ragas extra to use engine=ragas.") from exc
    metrics = [faithfulness, answer_relevancy]
    if all(sample["reference"] for sample in samples):
        metrics += [context_precision, context_recall]
    frame = evaluate(EvaluationDataset.from_list(ragas_rows(samples)), metrics=metrics).to_pandas()
    rows = []
    for record in frame.to_dict("records"):
        rows.append({ours: _number(record.get(theirs)) for theirs, ours in RAGAS_NAMES.items()})
    return rows


class EvaluationService:
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

    def evaluate(self, principal: Principal, body: dict) -> dict:
        raw = list(body.get("samples") or [])
        if not raw:
            raise PolicyError("At least one sample is required.")
        if len(raw) > self.settings.evaluation.max_samples:
            raise PolicyError(f"Evaluate at most {self.settings.evaluation.max_samples} samples per request.")
        engine = body.get("engine") or "native"
        if engine not in ("native", "ragas"):
            raise PolicyError("Engine must be native or ragas.")
        for item in raw:
            self.gate.check_text(str(item.get("question") or ""))
        self.gate.check_prompt(principal, "", [])
        samples = [self._prepare(principal, item) for item in raw]
        if engine == "ragas":
            results = run_ragas(samples)
        else:
            results = [
                score_sample(sample["question"], sample["answer"], sample["contexts"], sample["reference"], self.provider.embed)
                for sample in samples
            ]
        scores = aggregate(results)
        thresholds = {**self.settings.evaluation.thresholds, **(body.get("thresholds") or {})}
        failed = {metric: floor for metric, floor in thresholds.items() if metric in scores and scores[metric] < floor}
        record = EvaluationRecord(str(uuid.uuid4()), principal.tenant_id, engine, scores, not failed, len(samples))
        self.repository.add_evaluation(record)
        return record.public() | {
            "thresholds": thresholds,
            "failed": failed,
            "results": [{"question": sample["question"], "answer": sample["answer"], **result} for sample, result in zip(samples, results)],
            "ragasDataset": ragas_rows(samples),
        }

    def history(self, principal: Principal) -> dict:
        rows = [
            record.public()
            for record in self.repository.list_evaluations(
                principal.tenant_id
            )
        ]
        return {"evaluations": rows[::-1]}

    def _prepare(self, principal: Principal, item: dict) -> dict:
        question = str(item.get("question") or "").strip()
        if not question:
            raise PolicyError("Every sample needs a question.")
        contexts = item.get("contexts")
        if contexts is None:
            vector = self.provider.embed([question])[0]
            matches = self.repository.search(principal.tenant_id, vector, self.settings.top_k)
            contexts = [chunk.text for score, chunk in matches if score > 0]
        answer = item.get("answer")
        if answer is None:
            sources = "\n".join(contexts) or "No sources."
            result = self.provider.complete(f"Sources:\n{sources}\nQuestion: {question}\nAnswer from the sources only.")
            cost = token_cost(self.settings, self.settings.chat.model, result.input_tokens, result.output_tokens)
            self.gate.record_cost(principal.tenant_id, cost)
            self.repository.add_usage(
                UsageRecord(principal.tenant_id, self.settings.chat.model, result.input_tokens, result.output_tokens, cost, "evaluation")
            )
            answer = result.text
        return {
            "question": question,
            "answer": str(answer),
            "contexts": [str(context) for context in contexts],
            "reference": str(item.get("reference") or ""),
        }


def _terms(text: str) -> set[str]:
    return {word for word in re.findall(r"[a-z0-9]+", text.lower()) if len(word) > 2 and word not in STOPWORDS}


def _sentences(text: str) -> list[str]:
    return [part for part in re.split(r"(?<=[.!?])\s+|\n+", text.strip()) if _terms(part)]


def _overlap(terms: set[str], target: set[str]) -> float:
    return len(terms & target) / len(target) if target else 0.0


def _supported(sentence: str, context_terms: set[str]) -> bool:
    return _overlap(context_terms, _terms(sentence)) >= SUPPORT_RATIO


def _ranked_precision(relevant: list[bool]) -> float:
    hits = 0
    total = 0.0
    for rank, flag in enumerate(relevant, start=1):
        if flag:
            hits += 1
            total += hits / rank
    return total / hits if hits else 0.0


def _recall(reference: str, context_terms: set[str]) -> float:
    sentences = _sentences(reference)
    return sum(_supported(sentence, context_terms) for sentence in sentences) / len(sentences) if sentences else 0.0


def _number(value) -> float | None:
    if value is None or value != value:
        return None
    return round(float(value), 4)
