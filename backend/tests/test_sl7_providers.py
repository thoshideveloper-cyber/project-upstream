"""SL-7 — provider seam: registry selection, mock round-trip, data-source config."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.data_source_config import DataSourceConfig
from app.models.enums import DataSourceKind
from app.services.providers import (
    CandidateFacts,
    MandateThesis,
    ProfileFacts,
    get_enrichment_provider,
    get_ranking_provider,
)
from app.services.providers.registry import seed_firm_data_sources

PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}


async def _login(client: AsyncClient, creds: dict) -> None:
    resp = await client.post("/auth/login", json=creds)
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_mock_ranking_deterministic(db_session, firm):
    await seed_firm_data_sources(db_session, firm.id)
    await db_session.commit()
    provider = await get_ranking_provider(db_session, firm.id)
    assert provider.key == "mock_ranking"

    thesis = MandateThesis(mandate_type="SELL_SIDE", side="SELL_SIDE", sector="Tech", geography="Mumbai")
    cands = [
        CandidateFacts(profile_id=1, company_name="Rich Co", category="Tech", hq="Mumbai",
                       revenue_band="200", headcount=500, has_website=True),
        CandidateFacts(profile_id=2, company_name="Sparse Co"),
    ]
    a = await provider.score(thesis, cands)
    b = await provider.score(thesis, cands)
    assert [s.fit_score for s in a] == [s.fit_score for s in b]  # deterministic
    assert a[0].fit_score > a[1].fit_score  # richer facts score higher
    assert a[1].insufficient_data is True   # sparse → flagged


@pytest.mark.asyncio
async def test_mock_enrichment_roundtrip(db_session, firm):
    await seed_firm_data_sources(db_session, firm.id)
    await db_session.commit()
    provider = await get_enrichment_provider(db_session, firm.id)
    result = await provider.fetch(ProfileFacts(company_name="X"))
    assert result.source == "mock_enrichment"
    assert "hq" in result.fields  # filled a missing field


@pytest.mark.asyncio
async def test_registry_falls_back_to_mock_when_disabled(db_session, firm):
    """Disabling all ranking providers still returns the mock (degrades, never breaks)."""
    await seed_firm_data_sources(db_session, firm.id)
    rows = (
        await db_session.execute(
            select(DataSourceConfig).where(
                DataSourceConfig.firm_id == firm.id,
                DataSourceConfig.kind == DataSourceKind.RANKING,
            )
        )
    ).scalars().all()
    for r in rows:
        r.enabled = False
    await db_session.commit()
    provider = await get_ranking_provider(db_session, firm.id)
    assert provider.key == "mock_ranking"


@pytest.mark.asyncio
async def test_data_sources_endpoint_and_toggle(client: AsyncClient, partner):
    await _login(client, PARTNER)
    resp = await client.get("/data-sources")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert any(i["provider_key"] == "mock_ranking" for i in items)

    groq = next(i for i in items if i["provider_key"] == "groq_ranking")
    assert groq["enabled"] is False
    resp = await client.patch(f"/data-sources/{groq['id']}", json={"enabled": True})
    assert resp.status_code == 200
    assert resp.json()["enabled"] is True


@pytest.mark.asyncio
async def test_data_source_toggle_partner_only(client: AsyncClient, analyst, partner, db_session):
    await _login(client, ANALYST)
    # Seed + fetch a config id via partner-independent seeding.
    await seed_firm_data_sources(db_session, analyst.firm_id)
    await db_session.commit()
    cfg = (
        await db_session.execute(
            select(DataSourceConfig).where(DataSourceConfig.firm_id == analyst.firm_id)
        )
    ).scalars().first()
    resp = await client.patch(f"/data-sources/{cfg.id}", json={"enabled": False})
    assert resp.status_code == 403
