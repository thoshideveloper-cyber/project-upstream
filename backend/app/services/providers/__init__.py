"""Pluggable data-source providers (SOURCING_LAYER_PLAN §5.1).

Two seams — ranking (AI fit scoring) and enrichment — behind Python Protocols and a
per-firm registry, so a real vendor slots in without reworking callers.
"""

from app.services.providers.base import (
    CandidateFacts,
    EnrichmentProvider,
    EnrichmentResult,
    FitScore,
    MandateThesis,
    ProfileFacts,
    RankingProvider,
)
from app.services.providers.groq import GroqRankingProvider
from app.services.providers.registry import (
    get_enrichment_provider,
    get_ranking_provider,
    register_provider,
)

# Register the Groq ranking provider (selected only when its data-source row is enabled
# AND keys + sourcing_ai_enabled are set; otherwise callers degrade to the mock).
register_provider(GroqRankingProvider())

__all__ = [
    "MandateThesis",
    "CandidateFacts",
    "FitScore",
    "ProfileFacts",
    "EnrichmentResult",
    "RankingProvider",
    "EnrichmentProvider",
    "get_ranking_provider",
    "get_enrichment_provider",
    "register_provider",
]
