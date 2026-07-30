"""Provider DTOs + Protocols (SOURCING_LAYER_PLAN §5.1).

DTOs are plain dataclasses so any provider (mock, Groq, a future vendor) speaks the same
shapes. ``CandidateFacts`` is the *only* thing sent to a ranking provider — assembled by
the egress allow-list (§5.7), never raw ORM rows.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


@dataclass
class MandateThesis:
    mandate_type: str
    side: str
    sector: str | None = None
    geography: str | None = None
    size_band: str | None = None


@dataclass
class CandidateFacts:
    profile_id: int
    company_name: str
    category: str | None = None
    hq: str | None = None
    revenue_band: str | None = None
    headcount: int | None = None
    has_website: bool = False
    relevant_investments: str | None = None


@dataclass
class FitScore:
    profile_id: int
    fit_score: int
    band: str
    subscores: dict
    rationale: str
    insufficient_data: bool
    evidence: list[str] = field(default_factory=list)


@dataclass
class ProfileFacts:
    company_name: str
    website: str | None = None
    hq: str | None = None
    linkedin: str | None = None
    headcount: int | None = None


@dataclass
class EnrichmentResult:
    fields: dict
    source: str


@runtime_checkable
class RankingProvider(Protocol):
    key: str

    async def score(
        self, thesis: MandateThesis, candidates: list[CandidateFacts]
    ) -> list[FitScore]:
        ...


@runtime_checkable
class EnrichmentProvider(Protocol):
    key: str

    async def fetch(self, profile: ProfileFacts) -> EnrichmentResult:
        ...


# Score → band anchors (shared by mock + Groq post-processing).
def band_for_score(score: int) -> str:
    if score >= 80:
        return "STRONG"
    if score >= 60:
        return "GOOD"
    if score >= 40:
        return "PARTIAL"
    if score >= 20:
        return "WEAK"
    return "POOR"
