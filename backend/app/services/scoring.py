"""AI scoring glue — egress allow-list, thesis assembly, cache key (SOURCING_LAYER_PLAN §5).

``build_candidate_facts`` is the SINGLE place that assembles what leaves the firm for a
third-party LLM (§5.7). Only allow-listed fields may go: company name, category,
HQ/geography, revenue *band*, headcount, website presence, relevant_investments, and the
mandate thesis. NEVER contact PII, notes, analyst identities, or other clients' names.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict
from decimal import Decimal

from app.models.company_profile import CompanyProfile
from app.models.mandate import Mandate
from app.services.providers.base import CandidateFacts, MandateThesis

PROMPT_VERSION = "v1"

# The ONLY keys permitted to leave the firm for a candidate (audited in one spot).
ALLOWED_CANDIDATE_KEYS = frozenset(
    {
        "profile_id",
        "company_name",
        "category",
        "hq",
        "revenue_band",
        "headcount",
        "has_website",
        "relevant_investments",
    }
)


def revenue_band(revenue_inr_cr: Decimal | None) -> str | None:
    """Coarse revenue band (INR Cr) — we send the *band*, not the exact figure."""
    if revenue_inr_cr is None:
        return None
    v = float(revenue_inr_cr)
    if v < 50:
        return "<50"
    if v < 250:
        return "50-250"
    if v < 1000:
        return "250-1000"
    if v < 5000:
        return "1000-5000"
    return "5000+"


def build_candidate_facts(
    profile: CompanyProfile,
    *,
    category: str | None = None,
    relevant_investments: str | None = None,
) -> CandidateFacts:
    """Assemble the allow-listed facts for one candidate. ``category`` /
    ``relevant_investments`` are optional overlays from a placement (never PII)."""
    return CandidateFacts(
        profile_id=profile.id,
        company_name=profile.company_name,
        category=category,
        hq=profile.hq,
        revenue_band=revenue_band(profile.revenue_inr_cr),
        headcount=profile.headcount,
        has_website=bool(profile.website),
        relevant_investments=relevant_investments,
    )


def build_thesis(mandate: Mandate) -> MandateThesis:
    """Assemble the mandate thesis sent alongside candidates (no client PII beyond side)."""
    return MandateThesis(
        mandate_type=mandate.type.value,
        side=mandate.type.value,
        sector=None,
        geography=None,
        size_band=None,
    )


def assert_egress_safe(facts: CandidateFacts) -> dict:
    """Serialise CandidateFacts for the wire and hard-fail on any non-allow-listed key.

    The unit-tested guard that guarantees no PII leaves (§5.7).
    """
    payload = asdict(facts)
    extra = set(payload) - ALLOWED_CANDIDATE_KEYS
    if extra:
        raise ValueError(f"Egress allow-list violation — non-permitted keys: {sorted(extra)}")
    return payload


def compute_inputs_hash(
    thesis: MandateThesis, facts: CandidateFacts, model: str
) -> str:
    """Cache key = hash(thesis + candidate facts + prompt_version + model)."""
    blob = json.dumps(
        {
            "thesis": asdict(thesis),
            "facts": assert_egress_safe(facts),
            "prompt_version": PROMPT_VERSION,
            "model": model,
        },
        sort_keys=True,
        default=str,
    )
    return hashlib.sha256(blob.encode()).hexdigest()
