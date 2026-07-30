"""SL-4 — Push to Project + Side: the resolution matrix, materialisation, no-dup."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import today_ist
from app.models.company import Company
from app.models.company_profile import CompanyProfile
from app.models.enums import (
    CompanyType,
    MandateStatus,
    MandateType,
    ScheduleStatus,
    SourcingStageKind,
)
from app.models.mandate import Mandate
from app.models.mandate_assignment import MandateAssignment
from app.models.outreach_schedule import OutreachSchedule
from app.models.project import Project
from app.models.sourcing_candidate import SourcingCandidate
from app.models.sourcing_stage import SourcingStage

PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}


async def _login(client: AsyncClient, creds: dict) -> None:
    resp = await client.post("/auth/login", json=creds)
    assert resp.status_code == 200, resp.text


async def _project(db: AsyncSession, firm_id: int) -> Project:
    p = Project(firm_id=firm_id, name="Proj", client_name="ClientCo")
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


async def _mandate(db, firm_id, project_id, mtype, name="M") -> Mandate:
    m = Mandate(
        firm_id=firm_id, project_id=project_id, client_name="ClientCo", name=name,
        type=mtype, status=MandateStatus.ACTIVE,
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return m


async def _profile(db, firm_id, name="Target Inc") -> CompanyProfile:
    p = CompanyProfile(
        firm_id=firm_id, company_name=name, name_key=name.lower(),
        domain_key="target.com", website="target.com",
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


@pytest.mark.asyncio
async def test_push_single_engagement(client: AsyncClient, partner, firm, db_session):
    await _login(client, PARTNER)
    proj = await _project(db_session, firm.id)
    mandate = await _mandate(db_session, firm.id, proj.id, MandateType.SELL_SIDE)
    profile = await _profile(db_session, firm.id)

    resp = await client.post(
        "/sourcing/push",
        json={"profile_id": profile.id, "project_id": proj.id, "side": "SELL_SIDE"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["pushed"] is True
    assert body["prompt_log_initial"] is True

    # Company placement: type derived (SELL_SIDE → BUYER), schedule AWAITING_INITIAL.
    company = (
        await db_session.execute(select(Company).where(Company.id == body["company_id"]))
    ).scalar_one()
    assert company.type == CompanyType.BUYER
    assert company.profile_id == profile.id
    sched = (
        await db_session.execute(
            select(OutreachSchedule).where(OutreachSchedule.company_id == company.id)
        )
    ).scalar_one()
    assert sched.status == ScheduleStatus.AWAITING_INITIAL
    assert sched.initial_date is None

    # Candidate materialised at ACTIVE.
    cand = (
        await db_session.execute(
            select(SourcingCandidate).where(SourcingCandidate.company_id == company.id)
        )
    ).scalar_one()
    stage = (
        await db_session.execute(select(SourcingStage).where(SourcingStage.id == cand.stage_id))
    ).scalar_one()
    assert stage.kind == SourcingStageKind.ACTIVE


@pytest.mark.asyncio
async def test_push_several_engagements_needs_choice(
    client: AsyncClient, partner, firm, db_session
):
    await _login(client, PARTNER)
    proj = await _project(db_session, firm.id)
    await _mandate(db_session, firm.id, proj.id, MandateType.SELL_SIDE, "A")
    await _mandate(db_session, firm.id, proj.id, MandateType.SELL_SIDE, "B")
    profile = await _profile(db_session, firm.id)

    resp = await client.post(
        "/sourcing/push",
        json={"profile_id": profile.id, "project_id": proj.id, "side": "SELL_SIDE"},
    )
    body = resp.json()
    assert "needs_choice" in body
    assert len(body["needs_choice"]) == 2

    # Disambiguate with mandate_id → pushes.
    chosen = body["needs_choice"][0]["mandate_id"]
    resp = await client.post(
        "/sourcing/push",
        json={
            "profile_id": profile.id,
            "project_id": proj.id,
            "side": "SELL_SIDE",
            "mandate_id": chosen,
        },
    )
    assert resp.json()["pushed"] is True


@pytest.mark.asyncio
async def test_push_none_partner_can_create(client: AsyncClient, partner, firm, db_session):
    await _login(client, PARTNER)
    proj = await _project(db_session, firm.id)
    await _mandate(db_session, firm.id, proj.id, MandateType.BUY_SIDE)  # different side
    profile = await _profile(db_session, firm.id)

    resp = await client.post(
        "/sourcing/push",
        json={"profile_id": profile.id, "project_id": proj.id, "side": "SELL_SIDE"},
    )
    body = resp.json()
    assert body["can_create"] is True
    assert "BUY_SIDE" in body["existing_sides"]


@pytest.mark.asyncio
async def test_push_none_analyst_cannot_create(
    client: AsyncClient, analyst, firm, db_session
):
    await _login(client, ANALYST)
    proj = await _project(db_session, firm.id)
    m = await _mandate(db_session, firm.id, proj.id, MandateType.BUY_SIDE)
    db_session.add(MandateAssignment(mandate_id=m.id, user_id=analyst.id))
    await db_session.commit()
    profile = await _profile(db_session, firm.id)

    resp = await client.post(
        "/sourcing/push",
        json={"profile_id": profile.id, "project_id": proj.id, "side": "SELL_SIDE"},
    )
    body = resp.json()
    assert body["can_create"] is False


@pytest.mark.asyncio
async def test_push_already_present_no_dup(client: AsyncClient, partner, firm, db_session):
    await _login(client, PARTNER)
    proj = await _project(db_session, firm.id)
    mandate = await _mandate(db_session, firm.id, proj.id, MandateType.SELL_SIDE)
    profile = await _profile(db_session, firm.id)

    r1 = await client.post(
        "/sourcing/push",
        json={"profile_id": profile.id, "project_id": proj.id, "side": "SELL_SIDE"},
    )
    assert r1.json()["pushed"] is True
    r2 = await client.post(
        "/sourcing/push",
        json={"profile_id": profile.id, "project_id": proj.id, "side": "SELL_SIDE"},
    )
    assert r2.json()["already_present"] is True

    # Exactly one candidate + one company for (mandate, profile).
    cand_count = (
        await db_session.execute(
            select(func.count()).select_from(SourcingCandidate).where(
                SourcingCandidate.mandate_id == mandate.id,
                SourcingCandidate.profile_id == profile.id,
            )
        )
    ).scalar()
    assert cand_count == 1
    comp_count = (
        await db_session.execute(
            select(func.count()).select_from(Company).where(
                Company.mandate_id == mandate.id, Company.profile_id == profile.id
            )
        )
    ).scalar()
    assert comp_count == 1


@pytest.mark.asyncio
async def test_push_then_log_initial_starts_clock(
    client: AsyncClient, partner, firm, db_session
):
    await _login(client, PARTNER)
    proj = await _project(db_session, firm.id)
    await _mandate(db_session, firm.id, proj.id, MandateType.CAPITAL_RAISE)
    profile = await _profile(db_session, firm.id)
    resp = await client.post(
        "/sourcing/push",
        json={"profile_id": profile.id, "project_id": proj.id, "side": "CAPITAL_RAISE"},
    )
    company_id = resp.json()["company_id"]

    # Type derived CAPITAL_RAISE → INVESTOR.
    company = (
        await db_session.execute(select(Company).where(Company.id == company_id))
    ).scalar_one()
    assert company.type == CompanyType.INVESTOR

    # Clock starts only on INITIAL_EMAIL.
    r = await client.post(
        f"/companies/{company_id}/events",
        json={"event_type": "INITIAL_EMAIL", "occurred_on": today_ist().isoformat()},
    )
    assert r.status_code == 201
    sched = (
        await db_session.execute(
            select(OutreachSchedule).where(OutreachSchedule.company_id == company_id)
        )
    ).scalar_one()
    await db_session.refresh(sched)
    assert sched.status == ScheduleStatus.ACTIVE
    assert sched.initial_date is not None


@pytest.mark.asyncio
async def test_create_engagement_partner_then_push(
    client: AsyncClient, partner, firm, db_session
):
    await _login(client, PARTNER)
    proj = await _project(db_session, firm.id)
    profile = await _profile(db_session, firm.id)

    resp = await client.post(
        "/sourcing/engagements", json={"project_id": proj.id, "side": "SELL_SIDE"}
    )
    assert resp.status_code == 201
    mandate_id = resp.json()["mandate_id"]

    resp = await client.post(
        "/sourcing/push",
        json={
            "profile_id": profile.id,
            "project_id": proj.id,
            "side": "SELL_SIDE",
            "mandate_id": mandate_id,
        },
    )
    assert resp.json()["pushed"] is True


@pytest.mark.asyncio
async def test_create_engagement_analyst_forbidden(
    client: AsyncClient, analyst, firm, db_session
):
    await _login(client, ANALYST)
    proj = await _project(db_session, firm.id)
    resp = await client.post(
        "/sourcing/engagements", json={"project_id": proj.id, "side": "SELL_SIDE"}
    )
    assert resp.status_code == 403
