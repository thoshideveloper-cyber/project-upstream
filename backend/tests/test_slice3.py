"""Slice-3 acceptance tests — Project API: scoping, CRUD, engagement stats.

Covers:
- GET /projects partner sees all (firm-scoped); analyst sees only projects with assigned mandate
- GET /projects?include_archived=true shows archived projects
- POST /projects (any role — analysts can open their own client projects)
- GET /projects/{id} returns engagements grouped by type + headline stats
- PATCH /projects/{id} updates name/client_name (partner only)
- DELETE /projects/{id} soft-archives; GET /projects excludes it by default
- POST /projects/{id}/unarchive restores
- Project detail headline stats: total_companies, response_rate, overdue_count, cold_count
- Analyst cannot see a project none of their mandates belong to
"""

from __future__ import annotations

from datetime import date

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.company import Company
from app.models.enums import (
    CompanyCategory,
    CompanyStatus,
    CompanyType,
    MandateStatus,
    MandateType,
    OutreachEventType,
    ScheduleStatus,
    Source,
    SourceQuality,
    StoppedReason,
    UserRole,
)
from app.models.firm import Firm
from app.models.mandate import Mandate
from app.models.mandate_assignment import MandateAssignment
from app.models.outreach_schedule import OutreachSchedule
from app.models.project import Project
from app.models.user import User

_PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
_ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _login(client: AsyncClient, creds: dict) -> None:
    r = await client.post("/auth/login", json=creds)
    assert r.status_code == 200, r.text


async def _create_project(client: AsyncClient, name: str = "Project Alpha", client_name: str = "Client Alpha") -> dict:
    r = await client.post("/projects", json={"name": name, "client_name": client_name})
    assert r.status_code == 201, r.text
    return r.json()


async def _make_company(client: AsyncClient, mandate_id: int, name: str = "TestCo") -> dict:
    r = await client.post(
        "/companies",
        json={"company_name": name, "mandate_id": mandate_id, "type": "TARGET"},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _log_event(client: AsyncClient, company_id: int, event_type: str, on: str | None = None) -> dict:
    r = await client.post(
        f"/companies/{company_id}/events",
        json={"event_type": event_type, "occurred_on": on or date.today().isoformat()},
    )
    assert r.status_code == 201, r.text
    return r.json()


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def project(db_session: AsyncSession, firm: Firm) -> Project:
    p = Project(firm_id=firm.id, name="Medanta Project", client_name="Medanta Healthcare")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


@pytest_asyncio.fixture
async def mandate_in_project(db_session: AsyncSession, firm: Firm, partner: User, project: Project) -> Mandate:
    m = Mandate(
        firm_id=firm.id,
        project_id=project.id,
        client_name="Medanta Healthcare",
        name="Pharma Sell-Side",
        type=MandateType.SELL_SIDE,
        status=MandateStatus.ACTIVE,
        lead_owner_id=partner.id,
    )
    db_session.add(m)
    await db_session.commit()
    await db_session.refresh(m)
    return m


@pytest_asyncio.fixture
async def analyst_assigned_to_project_mandate(
    db_session: AsyncSession,
    analyst: User,
    mandate_in_project: Mandate,
) -> User:
    db_session.add(MandateAssignment(mandate_id=mandate_in_project.id, user_id=analyst.id))
    await db_session.commit()
    return analyst


# ── GET /projects — scoping ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_partner_sees_all_projects(
    client: AsyncClient,
    firm: Firm,
    partner: User,
    project: Project,
):
    await _login(client, _PARTNER)
    r = await client.get("/projects")
    assert r.status_code == 200, r.text
    ids = [p["id"] for p in r.json()["items"]]
    assert project.id in ids


@pytest.mark.asyncio
async def test_analyst_sees_project_with_assigned_mandate(
    client: AsyncClient,
    firm: Firm,
    partner: User,
    analyst: User,
    project: Project,
    analyst_assigned_to_project_mandate: User,
):
    await _login(client, _ANALYST)
    r = await client.get("/projects")
    assert r.status_code == 200, r.text
    ids = [p["id"] for p in r.json()["items"]]
    assert project.id in ids


@pytest.mark.asyncio
async def test_analyst_cannot_see_unassigned_project(
    client: AsyncClient,
    firm: Firm,
    partner: User,
    analyst: User,
    project: Project,
):
    """Analyst not assigned to any mandate in this project → project not visible."""
    await _login(client, _ANALYST)
    r = await client.get("/projects")
    assert r.status_code == 200, r.text
    ids = [p["id"] for p in r.json()["items"]]
    assert project.id not in ids


@pytest.mark.asyncio
async def test_projects_firm_scoped(
    client: AsyncClient,
    db_session: AsyncSession,
    firm: Firm,
    partner: User,
    project: Project,
):
    """Projects from another firm are never returned."""
    # Second firm
    other_firm = Firm(name="Other Firm")
    db_session.add(other_firm)
    await db_session.commit()
    await db_session.refresh(other_firm)

    other_project = Project(firm_id=other_firm.id, name="Other Project", client_name="Other Client")
    db_session.add(other_project)
    await db_session.commit()

    await _login(client, _PARTNER)
    r = await client.get("/projects")
    ids = [p["id"] for p in r.json()["items"]]
    assert other_project.id not in ids
    assert project.id in ids


# ── POST /projects ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_project_partner(
    client: AsyncClient,
    firm: Firm,
    partner: User,
):
    await _login(client, _PARTNER)
    r = await client.post("/projects", json={"name": "New Project", "client_name": "New Client"})
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["name"] == "New Project"
    assert data["client_name"] == "New Client"
    assert data["firm_id"] == firm.id
    assert data["archived_at"] is None


@pytest.mark.asyncio
async def test_create_project_analyst_allowed(
    client: AsyncClient,
    firm: Firm,
    partner: User,
    analyst: User,
):
    """Analysts can open their own client projects and immediately see them —
    even before any engagement exists (creator ownership, not mandate visibility)."""
    await _login(client, _ANALYST)
    r = await client.post("/projects", json={"name": "New Project", "client_name": "New Client"})
    assert r.status_code == 201, r.text
    created = r.json()
    assert created["firm_id"] == firm.id
    new_id = created["id"]

    # The fresh, engagement-less project is visible to its creator in the list…
    listing = await client.get("/projects")
    assert listing.status_code == 200
    assert new_id in [p["id"] for p in listing.json()["items"]]

    # …and its detail loads (would 404 under mandate-only visibility).
    detail = await client.get(f"/projects/{new_id}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["headline"]["total_companies"] == 0


# ── GET /projects/{id} — detail + stats ──────────────────────────────────────


@pytest.mark.asyncio
async def test_project_detail_engagements_grouped(
    client: AsyncClient,
    db_session: AsyncSession,
    firm: Firm,
    partner: User,
    project: Project,
    mandate_in_project: Mandate,
):
    """GET /projects/{id} groups mandates by type under engagements."""
    # Add a buy-side mandate too
    buy_mandate = Mandate(
        firm_id=firm.id,
        project_id=project.id,
        client_name="Medanta Healthcare",
        name="Medanta Buy-Side",
        type=MandateType.BUY_SIDE,
        status=MandateStatus.ACTIVE,
        lead_owner_id=partner.id,
    )
    db_session.add(buy_mandate)
    await db_session.commit()

    await _login(client, _PARTNER)
    r = await client.get(f"/projects/{project.id}")
    assert r.status_code == 200, r.text
    data = r.json()

    assert "engagements" in data
    assert "headline" in data

    # sell-side mandate appears under SELL_SIDE
    sell_ids = [m["id"] for m in data["engagements"]["SELL_SIDE"]]
    assert mandate_in_project.id in sell_ids

    # buy-side mandate appears under BUY_SIDE
    buy_ids = [m["id"] for m in data["engagements"]["BUY_SIDE"]]
    assert buy_mandate.id in buy_ids


@pytest.mark.asyncio
async def test_project_detail_headline_stats(
    client: AsyncClient,
    db_session: AsyncSession,
    firm: Firm,
    partner: User,
    project: Project,
    mandate_in_project: Mandate,
):
    """Headline stats aggregate company counts correctly."""
    await _login(client, _PARTNER)

    # Add 2 companies to the mandate
    co1 = await _make_company(client, mandate_in_project.id, "Alpha Corp")
    co2 = await _make_company(client, mandate_in_project.id, "Beta Corp")

    # co1 → RESPONDED
    await _log_event(client, co1["id"], OutreachEventType.INITIAL_EMAIL.value, "2024-01-01")
    await _log_event(client, co1["id"], OutreachEventType.RESPONSE.value, "2024-01-15")

    r = await client.get(f"/projects/{project.id}")
    data = r.json()
    headline = data["headline"]

    assert headline["total_companies"] == 2
    assert headline["responded"] == 1
    assert headline["response_rate"] == 0.5


@pytest.mark.asyncio
async def test_project_detail_cold_count(
    client: AsyncClient,
    db_session: AsyncSession,
    firm: Firm,
    partner: User,
    project: Project,
    mandate_in_project: Mandate,
):
    """cold_count in headline counts EXHAUSTED current-cycle companies."""
    await _login(client, _PARTNER)

    # Set firm cap to 1 to exhaust quickly
    firm.follow_up_cap = 1
    await db_session.commit()

    co = await _make_company(client, mandate_in_project.id, "Cold Corp")
    await _log_event(client, co["id"], OutreachEventType.INITIAL_EMAIL.value, "2024-01-01")
    await _log_event(client, co["id"], OutreachEventType.FOLLOW_UP.value, "2024-01-15")

    # Confirm EXHAUSTED
    sched_r = await client.get(f"/companies/{co['id']}/schedule")
    assert sched_r.json()["stopped_reason"] == StoppedReason.EXHAUSTED.value

    r = await client.get(f"/projects/{project.id}")
    headline = r.json()["headline"]
    assert headline["cold_count"] == 1


@pytest.mark.asyncio
async def test_analyst_cannot_get_unassigned_project(
    client: AsyncClient,
    firm: Firm,
    partner: User,
    analyst: User,
    project: Project,
):
    """GET /projects/{id} returns 404 for analyst with no mandate in that project."""
    await _login(client, _ANALYST)
    r = await client.get(f"/projects/{project.id}")
    assert r.status_code == 404, r.text


# ── PATCH /projects/{id} ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_project(
    client: AsyncClient,
    firm: Firm,
    partner: User,
    project: Project,
):
    await _login(client, _PARTNER)
    r = await client.patch(f"/projects/{project.id}", json={"name": "Renamed Project"})
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Renamed Project"
    assert r.json()["client_name"] == project.client_name  # unchanged


@pytest.mark.asyncio
async def test_update_project_analyst_forbidden(
    client: AsyncClient,
    firm: Firm,
    partner: User,
    analyst: User,
    project: Project,
    analyst_assigned_to_project_mandate: User,
):
    await _login(client, _ANALYST)
    r = await client.patch(f"/projects/{project.id}", json={"name": "Forbidden"})
    assert r.status_code == 403, r.text


# ── Archive / unarchive ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_archive_and_unarchive_project(
    client: AsyncClient,
    firm: Firm,
    partner: User,
    project: Project,
):
    await _login(client, _PARTNER)

    # Archive
    r = await client.delete(f"/projects/{project.id}")
    assert r.status_code == 200, r.text

    # Default list excludes archived
    r_list = await client.get("/projects")
    ids = [p["id"] for p in r_list.json()["items"]]
    assert project.id not in ids

    # include_archived shows it
    r_list2 = await client.get("/projects?include_archived=true")
    ids2 = [p["id"] for p in r_list2.json()["items"]]
    assert project.id in ids2

    # Unarchive
    r_unarchive = await client.post(f"/projects/{project.id}/unarchive")
    assert r_unarchive.status_code == 200, r_unarchive.text
    assert r_unarchive.json()["archived_at"] is None

    # Now back in default list
    r_list3 = await client.get("/projects")
    ids3 = [p["id"] for p in r_list3.json()["items"]]
    assert project.id in ids3


@pytest.mark.asyncio
async def test_archive_project_analyst_forbidden(
    client: AsyncClient,
    firm: Firm,
    partner: User,
    analyst: User,
    project: Project,
    analyst_assigned_to_project_mandate: User,
):
    await _login(client, _ANALYST)
    r = await client.delete(f"/projects/{project.id}")
    assert r.status_code == 403, r.text
