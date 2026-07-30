"""SL-1 — funnel stages + candidates + stage transitions + old-name deprecation."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import today_ist
from app.models.company import Company
from app.models.enums import ScheduleStatus, SourcingStageKind
from app.models.outreach_schedule import OutreachSchedule
from app.models.sourcing_candidate import SourcingCandidate
from app.models.sourcing_stage import SourcingStage
from app.services.sourcing import (
    first_stage_of_kind,
    get_firm_stages,
    get_or_create_candidate,
    seed_firm_stages,
)

PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}


async def _login(client: AsyncClient, creds: dict) -> None:
    resp = await client.post("/auth/login", json=creds)
    assert resp.status_code == 200, resp.text


# ── Stage vocabulary + invariants ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_stages_self_seed_on_list(client: AsyncClient, partner):
    await _login(client, PARTNER)
    resp = await client.get("/sourcing-stages")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 5
    kinds = [s["kind"] for s in data["items"]]
    assert kinds == ["RESEARCH", "SHORTLIST", "ACTIVE", "ENGAGED", "PASSED"]
    # Ordered by sort_order.
    orders = [s["sort_order"] for s in data["items"]]
    assert orders == sorted(orders)


@pytest.mark.asyncio
async def test_create_second_active_stage_rejected(client: AsyncClient, partner):
    await _login(client, PARTNER)
    await client.get("/sourcing-stages")  # seed
    resp = await client.post(
        "/sourcing-stages", json={"name": "Active 2", "kind": "ACTIVE"}
    )
    assert resp.status_code == 422
    assert "ACTIVE" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_delete_only_passed_rejected(client: AsyncClient, partner, db_session):
    await _login(client, PARTNER)
    await client.get("/sourcing-stages")
    passed = (
        await db_session.execute(
            select(SourcingStage).where(SourcingStage.kind == SourcingStageKind.PASSED)
        )
    ).scalar_one()
    resp = await client.delete(f"/sourcing-stages/{passed.id}")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_custom_stage_create_and_archive(client: AsyncClient, partner, db_session):
    await _login(client, PARTNER)
    await client.get("/sourcing-stages")
    resp = await client.post("/sourcing-stages", json={"name": "Nurture", "kind": "CUSTOM"})
    assert resp.status_code == 201
    sid = resp.json()["id"]
    resp = await client.delete(f"/sourcing-stages/{sid}")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_analyst_cannot_manage_stages(client: AsyncClient, analyst):
    await _login(client, ANALYST)
    resp = await client.post("/sourcing-stages", json={"name": "X", "kind": "CUSTOM"})
    assert resp.status_code == 403


# ── Stage transitions ─────────────────────────────────────────────────────────


async def _make_candidate(
    db: AsyncSession, firm_id: int, mandate_id: int, kind: SourcingStageKind
) -> SourcingCandidate:
    """Create a pool profile + a candidate at the given stage kind (no placement)."""
    from app.models.company_profile import CompanyProfile

    profile = CompanyProfile(
        firm_id=firm_id,
        company_name="Poolco Ltd",
        name_key="poolco",
        domain_key="poolco.com",
        website="poolco.com",
    )
    db.add(profile)
    await db.flush()
    stages = await get_firm_stages(db, firm_id)
    stage = first_stage_of_kind(stages, kind)
    cand, _ = await get_or_create_candidate(
        db,
        firm_id=firm_id,
        mandate_id=mandate_id,
        profile_id=profile.id,
        stage=stage,
        actor_id=None,
    )
    await db.commit()
    return cand


@pytest.mark.asyncio
async def test_research_to_shortlist_is_cheap(
    client: AsyncClient, partner, mandate, db_session
):
    await _login(client, PARTNER)
    cand = await _make_candidate(
        db_session, mandate.firm_id, mandate.id, SourcingStageKind.RESEARCH
    )
    stages = await get_firm_stages(db_session, mandate.firm_id)
    shortlist = first_stage_of_kind(stages, SourcingStageKind.SHORTLIST)
    resp = await client.patch(
        f"/sourcing-candidates/{cand.id}/stage", json={"stage_id": shortlist.id}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["stage_id"] == shortlist.id
    assert body["company_id"] is None  # no placement created
    assert body["prompt_log_initial"] is False


@pytest.mark.asyncio
async def test_drag_to_active_materialises_placement(
    client: AsyncClient, partner, mandate, db_session
):
    await _login(client, PARTNER)
    cand = await _make_candidate(
        db_session, mandate.firm_id, mandate.id, SourcingStageKind.RESEARCH
    )
    stages = await get_firm_stages(db_session, mandate.firm_id)
    active = first_stage_of_kind(stages, SourcingStageKind.ACTIVE)
    resp = await client.patch(
        f"/sourcing-candidates/{cand.id}/stage", json={"stage_id": active.id}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["company_id"] is not None
    assert body["prompt_log_initial"] is True

    # Placement + cycle-1 AWAITING_INITIAL schedule created; clock not ticking.
    company = (
        await db_session.execute(
            select(Company).where(Company.id == body["company_id"])
        )
    ).scalar_one()
    assert company.mandate_id == mandate.id
    sched = (
        await db_session.execute(
            select(OutreachSchedule).where(OutreachSchedule.company_id == company.id)
        )
    ).scalar_one()
    assert sched.status == ScheduleStatus.AWAITING_INITIAL
    assert sched.initial_date is None


@pytest.mark.asyncio
async def test_response_event_auto_advances_to_engaged(
    client: AsyncClient, partner, mandate, db_session
):
    await _login(client, PARTNER)
    cand = await _make_candidate(
        db_session, mandate.firm_id, mandate.id, SourcingStageKind.RESEARCH
    )
    stages = await get_firm_stages(db_session, mandate.firm_id)
    active = first_stage_of_kind(stages, SourcingStageKind.ACTIVE)
    engaged = first_stage_of_kind(stages, SourcingStageKind.ENGAGED)

    # Push to Active → placement.
    resp = await client.patch(
        f"/sourcing-candidates/{cand.id}/stage", json={"stage_id": active.id}
    )
    company_id = resp.json()["company_id"]

    today = today_ist().isoformat()
    await client.post(
        f"/companies/{company_id}/events",
        json={"event_type": "INITIAL_EMAIL", "occurred_on": today},
    )
    await client.post(
        f"/companies/{company_id}/events",
        json={"event_type": "RESPONSE", "occurred_on": today},
    )

    await db_session.refresh(cand)
    assert cand.stage_id == engaged.id


@pytest.mark.asyncio
async def test_passed_stops_cadence(client: AsyncClient, partner, mandate, db_session):
    await _login(client, PARTNER)
    cand = await _make_candidate(
        db_session, mandate.firm_id, mandate.id, SourcingStageKind.RESEARCH
    )
    stages = await get_firm_stages(db_session, mandate.firm_id)
    active = first_stage_of_kind(stages, SourcingStageKind.ACTIVE)
    passed = first_stage_of_kind(stages, SourcingStageKind.PASSED)

    resp = await client.patch(
        f"/sourcing-candidates/{cand.id}/stage", json={"stage_id": active.id}
    )
    company_id = resp.json()["company_id"]
    await client.post(
        f"/companies/{company_id}/events",
        json={"event_type": "INITIAL_EMAIL", "occurred_on": today_ist().isoformat()},
    )

    resp = await client.patch(
        f"/sourcing-candidates/{cand.id}/stage", json={"stage_id": passed.id}
    )
    assert resp.status_code == 200
    assert resp.json()["stopped_cadence"] is True
    sched = (
        await db_session.execute(
            select(OutreachSchedule).where(OutreachSchedule.company_id == company_id)
        )
    ).scalar_one()
    await db_session.refresh(sched)
    assert sched.status == ScheduleStatus.STOPPED


@pytest.mark.asyncio
async def test_candidate_visibility_scoping(
    client: AsyncClient, analyst, mandate, db_session
):
    """An analyst not assigned to the mandate cannot touch its candidate."""
    await _login(client, ANALYST)
    cand = await _make_candidate(
        db_session, mandate.firm_id, mandate.id, SourcingStageKind.RESEARCH
    )
    stages = await get_firm_stages(db_session, mandate.firm_id)
    shortlist = first_stage_of_kind(stages, SourcingStageKind.SHORTLIST)
    resp = await client.patch(
        f"/sourcing-candidates/{cand.id}/stage", json={"stage_id": shortlist.id}
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_deprecated_sourcing_layers_still_serves(
    client: AsyncClient, partner, mandate
):
    """§1.4 — /sourcing-layers is deprecated but kept serving for back-compat."""
    await _login(client, PARTNER)
    resp = await client.get(f"/sourcing-layers?mandate_id={mandate.id}")
    assert resp.status_code == 200
