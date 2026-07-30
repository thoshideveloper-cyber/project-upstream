"""Per-firm provider registry (SOURCING_LAYER_PLAN §5.1).

Providers register once at import; a firm's choice comes from ``data_source_configs``.
Selection always falls back to the deterministic mock so the feature degrades, never
breaks, when a provider is missing or disabled.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_source_config import DataSourceConfig
from app.models.enums import DataSourceKind
from app.services.providers.base import EnrichmentProvider, RankingProvider
from app.services.providers.mock import MockEnrichmentProvider, MockRankingProvider

_RANKING: dict[str, RankingProvider] = {}
_ENRICHMENT: dict[str, EnrichmentProvider] = {}

MOCK_RANKING_KEY = "mock_ranking"
MOCK_ENRICHMENT_KEY = "mock_enrichment"


def register_provider(provider) -> None:
    """Register a provider under its ``key`` in the matching seam."""
    if hasattr(provider, "score"):
        _RANKING[provider.key] = provider
    if hasattr(provider, "fetch"):
        _ENRICHMENT[provider.key] = provider


# Always-available offline defaults.
register_provider(MockRankingProvider())
register_provider(MockEnrichmentProvider())


async def _selected_key(
    db: AsyncSession, firm_id: int, kind: DataSourceKind, fallback: str
) -> str:
    cfg = (
        await db.execute(
            select(DataSourceConfig)
            .where(
                DataSourceConfig.firm_id == firm_id,
                DataSourceConfig.kind == kind,
                DataSourceConfig.enabled.is_(True),
            )
            .order_by(DataSourceConfig.id)
        )
    ).scalars().first()
    if cfg and cfg.provider_key in (_RANKING if kind == DataSourceKind.RANKING else _ENRICHMENT):
        return cfg.provider_key
    return fallback


async def get_ranking_provider(db: AsyncSession, firm_id: int) -> RankingProvider:
    key = await _selected_key(db, firm_id, DataSourceKind.RANKING, MOCK_RANKING_KEY)
    return _RANKING.get(key, _RANKING[MOCK_RANKING_KEY])


async def get_enrichment_provider(db: AsyncSession, firm_id: int) -> EnrichmentProvider:
    key = await _selected_key(db, firm_id, DataSourceKind.ENRICHMENT, MOCK_ENRICHMENT_KEY)
    return _ENRICHMENT.get(key, _ENRICHMENT[MOCK_ENRICHMENT_KEY])


# Default per-firm provider rows so the seam is provable out of the box:
# (provider_key, kind, enabled). Real vendors (e.g. Groq) are added disabled-by-default.
DEFAULT_DATA_SOURCES: list[tuple[str, DataSourceKind, bool]] = [
    (MOCK_RANKING_KEY, DataSourceKind.RANKING, True),
    (MOCK_ENRICHMENT_KEY, DataSourceKind.ENRICHMENT, True),
    ("groq_ranking", DataSourceKind.RANKING, False),
]


async def seed_firm_data_sources(db: AsyncSession, firm_id: int) -> None:
    """Idempotently seed the default provider config rows for a firm."""
    existing = {
        r[0]
        for r in (
            await db.execute(
                select(DataSourceConfig.provider_key).where(
                    DataSourceConfig.firm_id == firm_id
                )
            )
        ).all()
    }
    for provider_key, kind, enabled in DEFAULT_DATA_SOURCES:
        if provider_key in existing:
            continue
        db.add(
            DataSourceConfig(
                firm_id=firm_id,
                provider_key=provider_key,
                kind=kind,
                enabled=enabled,
                config={},
            )
        )
    await db.flush()
