"""Deterministic, offline mock providers (SOURCING_LAYER_PLAN §5.1).

Used in tests and whenever AI is disabled — the app degrades to unscored/mock, never
broken. Scoring is a transparent rule over the facts present (no network, no randomness)
so results are reproducible in CI at zero cost.
"""

from __future__ import annotations

from app.services.providers.base import (
    CandidateFacts,
    EnrichmentResult,
    FitScore,
    MandateThesis,
    ProfileFacts,
    band_for_score,
)


def _dim_score(present: bool, matches: bool) -> int:
    if not present:
        return 0
    return 90 if matches else 55


class MockRankingProvider:
    """Rule-based fit: each dimension scores by fact presence + a cheap keyword match
    against the thesis. Deterministic — same inputs always give the same score."""

    key = "mock_ranking"

    async def score(
        self, thesis: MandateThesis, candidates: list[CandidateFacts]
    ) -> list[FitScore]:
        results: list[FitScore] = []
        for c in candidates:
            sector_match = bool(
                thesis.sector and c.category
                and thesis.sector.lower() in (c.category or "").lower()
            )
            geo_match = bool(
                thesis.geography and c.hq
                and thesis.geography.lower() in (c.hq or "").lower()
            )
            sector = _dim_score(c.category is not None, sector_match)
            size = _dim_score(c.revenue_band is not None or c.headcount is not None, True)
            geography = _dim_score(c.hq is not None, geo_match)
            type_fit = _dim_score(c.has_website or c.category is not None, True)
            subscores = {
                "sector": sector,
                "size": size,
                "geography": geography,
                "type": type_fit,
            }
            fit = round(sum(subscores.values()) / 4)
            present = sum(
                1 for v in (c.category, c.hq, c.revenue_band, c.headcount) if v is not None
            )
            insufficient = present < 2
            evidence = [f"{k}={v}" for k, v in subscores.items()]
            results.append(
                FitScore(
                    profile_id=c.profile_id,
                    fit_score=fit,
                    band=band_for_score(fit),
                    subscores=subscores,
                    rationale=(
                        f"Mock score for {c.company_name}: "
                        + ("sparse facts, low confidence." if insufficient else "based on provided facts.")
                    ),
                    insufficient_data=insufficient,
                    evidence=evidence,
                )
            )
        return results


class MockEnrichmentProvider:
    """Proves the enrichment seam end-to-end: fills a couple of missing fields with a
    deterministic stub value so a real vendor is a drop-in later."""

    key = "mock_enrichment"

    async def fetch(self, profile: ProfileFacts) -> EnrichmentResult:
        fields: dict = {}
        if not profile.hq:
            fields["hq"] = "Unknown (mock)"
        if profile.headcount is None:
            fields["headcount"] = 100
        return EnrichmentResult(fields=fields, source=self.key)
