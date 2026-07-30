"""SL-9 — funnel analytics + formal AI eval (κ / Spearman)."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.company_profile import CompanyProfile
from app.models.enums import (
    CandidateScoreStatus,
    CompanyStatus,
    CompanyType,
    SourcingStageKind,
)
from app.services.eval import cohen_kappa, spearman
from app.services.sourcing import first_stage_of_kind, get_firm_stages, get_or_create_candidate

PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}


async def _login(client: AsyncClient, creds: dict) -> None:
    resp = await client.post("/auth/login", json=creds)
    assert resp.status_code == 200, resp.text


# ── Pure stats ────────────────────────────────────────────────────────────────


def test_cohen_kappa():
    assert cohen_kappa([]) is None
    # Perfect agreement.
    assert cohen_kappa([(True, True), (False, False)]) == 1.0
    # Total disagreement → negative.
    assert cohen_kappa([(True, False), (False, True)]) < 0


def test_spearman():
    assert spearman([1, 2, 3], [1, 2, 3]) == 1.0
    assert spearman([1, 2, 3], [3, 2, 1]) == -1.0
    assert spearman([1], [1]) is None


# ── Endpoints ─────────────────────────────────────────────────────────────────


async def _scored_candidate(
    db: AsyncSession, firm_id, mandate_id, *, fit, feedback, responded
):
    profile = CompanyProfile(
        firm_id=firm_id, company_name=f"C{fit}", name_key=f"c{fit}", domain_key=f"c{fit}.com",
    )
    db.add(profile)
    await db.flush()
    company = Company(
        firm_id=firm_id, mandate_id=mandate_id, profile_id=profile.id, company_name=f"C{fit}",
        type=CompanyType.BUYER,
        status=CompanyStatus.RESPONDED if responded else CompanyStatus.CONTACTED,
        category="OTHER",
    )
    db.add(company)
    await db.flush()
    stages = await get_firm_stages(db, firm_id)
    active = first_stage_of_kind(stages, SourcingStageKind.ACTIVE)
    cand, _ = await get_or_create_candidate(
        db, firm_id=firm_id, mandate_id=mandate_id, profile_id=profile.id, stage=active, actor_id=None,
    )
    cand.company_id = company.id
    cand.fit_score = fit
    cand.band = "GOOD" if fit >= 60 else "WEAK"
    cand.score_status = CandidateScoreStatus.OK
    cand.score_feedback = feedback
    await db.commit()
    return cand


@pytest.mark.asyncio
async def test_funnel_analytics(client: AsyncClient, partner, mandate, db_session):
    await _login(client, PARTNER)
    await _scored_candidate(db_session, mandate.firm_id, mandate.id, fit=90, feedback="UP", responded=True)
    await _scored_candidate(db_session, mandate.firm_id, mandate.id, fit=15, feedback="DOWN", responded=False)

    resp = await client.get(f"/sourcing/funnel-analytics?mandate_id={mandate.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert "by_stage" in data
    assert data["pool_coverage"]["scored"] == 2
    # High-fit responded, low-fit didn't.
    assert data["fit_vs_outcome"]["high_fit"]["response_rate"] == 1.0
    assert data["fit_vs_outcome"]["low_fit"]["response_rate"] == 0.0


@pytest.mark.asyncio
async def test_score_eval_partner(client: AsyncClient, partner, mandate, db_session):
    await _login(client, PARTNER)
    # Two agreeing pairs (AI good+thumbs up, AI weak+thumbs down) → κ high.
    await _scored_candidate(db_session, mandate.firm_id, mandate.id, fit=90, feedback="UP", responded=True)
    await _scored_candidate(db_session, mandate.firm_id, mandate.id, fit=10, feedback="DOWN", responded=False)

    resp = await client.post(f"/sourcing/score/eval?mandate_id={mandate.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["n"] == 2
    assert data["cohen_kappa"] == 1.0


@pytest.mark.asyncio
async def test_score_eval_partner_only(client: AsyncClient, analyst):
    await _login(client, ANALYST)
    resp = await client.post("/sourcing/score/eval")
    assert resp.status_code == 403
