"""Slice-5 acceptance tests — GET /analytics/projects (partner overview).

Covers:
- Partner → 200 with items list
- Analyst → 403
- Numbers match: total_companies, responded, overdue_count, cold_count, needs_initial_count
- Response rate computed correctly
- Projects without mandates appear with zeroed headline
"""

from __future__ import annotations

from datetime import date

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.company import Company
from app.models.enums import (
    CompanyCategory,
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
from app.models.outreach_schedule import OutreachSchedule
from app.models.project import Project
from app.models.user import User

_PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
_ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _login(client: AsyncClient, creds: dict = _PARTNER) -> None:
    r = await client.post("/auth/login", json=creds)
    assert r.status_code == 200, r.text


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
    p = Project(firm_id=firm.id, name="Test Project", client_name="Test Client")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


@pytest_asyncio.fixture
async def mandate_in_project(db_session: AsyncSession, firm: Firm, partner: User, project: Project) -> Mandate:
    m = Mandate(
        firm_id=firm.id,
        project_id=project.id,
        client_name="Test Client",
        name="Sell-Side Mandate",
        type=MandateType.SELL_SIDE,
        status=MandateStatus.ACTIVE,
        lead_owner_id=partner.id,
    )
    db_session.add(m)
    await db_session.commit()
    await db_session.refresh(m)
    return m


# ── Tests ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_analytics_projects_partner_200(
    client: AsyncClient,
    firm: Firm,
    partner: User,
    project: Project,
):
    """Partner gets 200 with items list."""
    await _login(client)
    r = await client.get("/analytics/projects")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "items" in data
    assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_analytics_projects_analyst_403(
    client: AsyncClient,
    firm: Firm,
    partner: User,
    analyst: User,
    project: Project,
):
    """Analyst is denied — partner-only endpoint."""
    await _login(client, _ANALYST)
    r = await client.get("/analytics/projects")
    assert r.status_code == 403, r.text


@pytest.mark.asyncio
async def test_analytics_projects_project_in_list(
    client: AsyncClient,
    firm: Firm,
    partner: User,
    project: Project,
    mandate_in_project: Mandate,
):
    """The created project appears in the list."""
    await _login(client)
    r = await client.get("/analytics/projects")
    data = r.json()
    ids = [p["id"] for p in data["items"]]
    assert project.id in ids


@pytest.mark.asyncio
async def test_analytics_projects_headline_structure(
    client: AsyncClient,
    firm: Firm,
    partner: User,
    project: Project,
    mandate_in_project: Mandate,
):
    """Each project item has a headline and engagements list."""
    await _login(client)
    r = await client.get("/analytics/projects")
    item = next(p for p in r.json()["items"] if p["id"] == project.id)

    assert "headline" in item
    assert "engagements" in item
    h = item["headline"]
    assert "total_companies" in h
    assert "responded" in h
    assert "response_rate" in h
    assert "overdue_count" in h
    assert "cold_count" in h
    assert "needs_initial_count" in h


@pytest.mark.asyncio
async def test_analytics_projects_company_counts(
    client: AsyncClient,
    firm: Firm,
    partner: User,
    project: Project,
    mandate_in_project: Mandate,
):
    """total_companies and needs_initial_count match created companies."""
    await _login(client)

    await _make_company(client, mandate_in_project.id, "Alpha")
    await _make_company(client, mandate_in_project.id, "Beta")

    r = await client.get("/analytics/projects")
    item = next(p for p in r.json()["items"] if p["id"] == project.id)
    h = item["headline"]

    assert h["total_companies"] == 2
    assert h["needs_initial_count"] == 2  # both AWAITING_INITIAL


@pytest.mark.asyncio
async def test_analytics_projects_responded_count(
    client: AsyncClient,
    firm: Firm,
    partner: User,
    project: Project,
    mandate_in_project: Mandate,
):
    """responded and response_rate reflect actual RESPONSE events."""
    await _login(client)

    c1 = await _make_company(client, mandate_in_project.id, "Responded Co")
    await _make_company(client, mandate_in_project.id, "Silent Co")

    await _log_event(client, c1["id"], "INITIAL_EMAIL", "2024-01-01")
    await _log_event(client, c1["id"], "RESPONSE", "2024-01-10")

    r = await client.get("/analytics/projects")
    item = next(p for p in r.json()["items"] if p["id"] == project.id)
    h = item["headline"]

    assert h["responded"] == 1
    assert h["total_companies"] == 2
    assert round(h["response_rate"], 4) == 0.5


@pytest.mark.asyncio
async def test_analytics_projects_cold_count(
    client: AsyncClient,
    db_session: AsyncSession,
    firm: Firm,
    partner: User,
    project: Project,
    mandate_in_project: Mandate,
):
    """cold_count increments when a company's schedule is EXHAUSTED."""
    await _login(client)

    # Set cap to 1 so one follow-up exhausts the cadence
    firm.follow_up_cap = 1
    await db_session.commit()

    co = await _make_company(client, mandate_in_project.id, "Cold Co")
    await _log_event(client, co["id"], "INITIAL_EMAIL", "2024-01-01")
    await _log_event(client, co["id"], "FOLLOW_UP", "2024-01-15")

    r = await client.get("/analytics/projects")
    item = next(p for p in r.json()["items"] if p["id"] == project.id)
    assert item["headline"]["cold_count"] == 1


@pytest.mark.asyncio
async def test_analytics_projects_engagement_per_mandate(
    client: AsyncClient,
    firm: Firm,
    partner: User,
    project: Project,
    mandate_in_project: Mandate,
):
    """Each mandate appears as a separate entry in the engagements list."""
    await _login(client)

    r = await client.get("/analytics/projects")
    item = next(p for p in r.json()["items"] if p["id"] == project.id)

    assert len(item["engagements"]) == 1
    eng = item["engagements"][0]
    assert eng["id"] == mandate_in_project.id
    assert eng["name"] == mandate_in_project.name
    assert eng["type"] == "SELL_SIDE"


@pytest.mark.asyncio
async def test_analytics_projects_empty_project(
    client: AsyncClient,
    firm: Firm,
    partner: User,
    project: Project,
):
    """Project with no mandates appears with zero-headline (no crash)."""
    await _login(client)

    r = await client.get("/analytics/projects")
    assert r.status_code == 200
    item = next((p for p in r.json()["items"] if p["id"] == project.id), None)
    assert item is not None
    assert item["headline"]["total_companies"] == 0
    assert item["engagements"] == []
