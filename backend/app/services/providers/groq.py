"""Groq ranking provider (SOURCING_LAYER_PLAN §5.2).

⚠️ Verify-gate (review #2/#3): model IDs, strict-schema support and rate limits are a
July-2026 snapshot and change monthly — re-check Groq's live docs before trusting the
defaults in ``config.py``. This is a thin httpx client against the OpenAI-compatible
endpoint (key rotation, timeouts, fallback fully under our control), NOT the groq SDK.

Design: pointwise, evidence-anchored, CoT-before-score, strict JSON schema. Streaming and
tool-use are intentionally unused (incompatible with structured outputs, and unneeded).
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import asdict

import httpx

from app.core.config import settings
from app.services.providers.base import (
    CandidateFacts,
    FitScore,
    MandateThesis,
    band_for_score,
)
from app.services.scoring import PROMPT_VERSION, assert_egress_safe

logger = logging.getLogger("upstream.groq")

_SYSTEM_PROMPT = """You are an M&A sourcing analyst scoring how well a company fits a \
mandate thesis. Score each company INDEPENDENTLY (pointwise).

Rubric — anchor bands for fit_score (0-100):
- 80-100 (STRONG): strong on sector, size, geography AND type.
- 60-79  (GOOD): strong on most dimensions.
- 40-59  (PARTIAL): partial fit.
- 20-39  (WEAK): weak fit.
- 0-19   (POOR): poor / irrelevant.

Dimensions to sub-score (0-100 each): sector/category fit, size fit, geography fit, type fit.

CRITICAL — score ONLY from the facts provided. If a fact is missing, do NOT assume it —
note it and lower confidence, and set insufficient_data=true when facts are too sparse to
judge. Do NOT use outside knowledge about the company. Reason briefly, then emit the verdict."""

_JSON_SCHEMA = {
    "name": "fit_scores",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["scores"],
        "properties": {
            "scores": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "profile_id",
                        "fit_score",
                        "band",
                        "subscores",
                        "rationale",
                        "insufficient_data",
                        "evidence",
                    ],
                    "properties": {
                        "profile_id": {"type": "integer"},
                        "fit_score": {"type": "integer"},
                        "band": {
                            "type": "string",
                            "enum": ["STRONG", "GOOD", "PARTIAL", "WEAK", "POOR"],
                        },
                        "subscores": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["sector", "size", "geography", "type"],
                            "properties": {
                                "sector": {"type": "integer"},
                                "size": {"type": "integer"},
                                "geography": {"type": "integer"},
                                "type": {"type": "integer"},
                            },
                        },
                        "rationale": {"type": "string"},
                        "insufficient_data": {"type": "boolean"},
                        "evidence": {"type": "array", "items": {"type": "string"}},
                    },
                },
            }
        },
    },
}


class GroqNotConfigured(RuntimeError):
    """Raised when no Groq keys are set — the caller degrades to the mock provider."""


class GroqRateLimited(RuntimeError):
    """All keys exhausted / rate-limited — the caller marks candidates FAILED (degraded)."""


class GroqRankingProvider:
    key = "groq_ranking"

    def __init__(self) -> None:
        # Round-robin cursor + per-key cooldown timestamps (in-process).
        self._cursor = 0
        self._cooldown: dict[str, float] = {}

    def _next_key(self, keys: list[str]) -> tuple[int, str] | None:
        now = time.monotonic()
        n = len(keys)
        for _ in range(n):
            idx = self._cursor % n
            self._cursor += 1
            k = keys[idx]
            if self._cooldown.get(k, 0) <= now:
                return idx, k
        return None

    def _messages(self, thesis: MandateThesis, candidates: list[CandidateFacts]) -> list[dict]:
        payload = {
            "thesis": asdict(thesis),
            "candidates": [assert_egress_safe(c) for c in candidates],
        }
        return [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    "Score each candidate against the thesis. Return JSON matching the schema.\n\n"
                    + json.dumps(payload, default=str)
                ),
            },
        ]

    async def _call_model(
        self, client: httpx.AsyncClient, keys: list[str], model: str, messages: list[dict],
        *, strict: bool,
    ) -> str:
        body: dict = {"model": model, "messages": messages, "temperature": 0}
        if strict:
            body["response_format"] = {"type": "json_schema", "json_schema": _JSON_SCHEMA}
        else:
            body["response_format"] = {"type": "json_object"}

        last_exc: Exception | None = None
        for _ in range(len(keys)):
            chosen = self._next_key(keys)
            if chosen is None:
                raise GroqRateLimited("All Groq keys cooling down")
            idx, key = chosen
            started = time.monotonic()
            try:
                resp = await client.post(
                    f"{settings.groq_base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {key}"},
                    json=body,
                )
            except httpx.HTTPError as exc:  # network/timeout — try next key
                last_exc = exc
                continue
            latency = round((time.monotonic() - started) * 1000)
            if resp.status_code == 429:
                self._cooldown[key] = time.monotonic() + 60
                logger.warning("groq 429 model=%s key_index=%s — rotating", model, idx)
                continue
            if resp.status_code >= 500:
                last_exc = RuntimeError(f"groq {resp.status_code}")
                continue
            resp.raise_for_status()
            data = resp.json()
            usage = data.get("usage", {})
            logger.info(
                "groq ok model=%s key_index=%s latency_ms=%s prompt_v=%s tokens=%s",
                model, idx, latency, PROMPT_VERSION, usage.get("total_tokens"),
            )
            return data["choices"][0]["message"]["content"]
        raise GroqRateLimited(str(last_exc) if last_exc else "Groq request failed")

    @staticmethod
    def _parse(content: str) -> list[dict]:
        """Parse model JSON, repairing code-fenced / best-effort output."""
        text = content.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.lstrip().lower().startswith("json"):
                text = text.lstrip()[4:]
        obj = json.loads(text)
        return obj.get("scores", obj if isinstance(obj, list) else [])

    async def score(
        self, thesis: MandateThesis, candidates: list[CandidateFacts]
    ) -> list[FitScore]:
        keys = settings.groq_api_keys
        if not keys:
            raise GroqNotConfigured("No GROQ_API_KEY configured")
        if not candidates:
            return []

        messages = self._messages(thesis, candidates)
        models = [settings.groq_model, *settings.groq_fallback_list]

        content: str | None = None
        last_exc: Exception | None = None
        async with httpx.AsyncClient(timeout=settings.groq_timeout_s) as client:
            for i, model in enumerate(models):
                strict = i < 2  # gpt-oss-* strict; the last (llama) is best-effort + repair
                try:
                    content = await self._call_model(
                        client, keys, model, messages, strict=strict
                    )
                    break
                except (GroqRateLimited, RuntimeError, httpx.HTTPError) as exc:
                    last_exc = exc
                    continue
        if content is None:
            raise GroqRateLimited(str(last_exc) if last_exc else "All Groq models failed")

        rows = self._parse(content)
        by_id = {r["profile_id"]: r for r in rows if "profile_id" in r}
        results: list[FitScore] = []
        for c in candidates:
            r = by_id.get(c.profile_id)
            if r is None:
                continue
            fit = max(0, min(100, int(r.get("fit_score", 0))))
            results.append(
                FitScore(
                    profile_id=c.profile_id,
                    fit_score=fit,
                    band=r.get("band") or band_for_score(fit),
                    subscores=r.get("subscores", {}),
                    rationale=(r.get("rationale") or "")[:240],
                    insufficient_data=bool(r.get("insufficient_data", False)),
                    evidence=r.get("evidence", []),
                )
            )
        return results
