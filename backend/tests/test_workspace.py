"""Workspace — the firm-as-tenant contract: shipped pool on signup, book reset.

Two guarantees are load-bearing for a deployed Upstream and are asserted here rather
than left to a deploy checklist:

1. A firm that signs up gets the real company database and *nothing else*. If the demo
   seeder ever creeps back into that path, `test_signup_*` fails.
2. Resetting a workspace removes only the book the firm imported. Configuration, users
   and the company database survive, so the same workbooks can be re-imported into a
   clean firm — and one firm can never reset another's data.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data import company_pool
from app.models.company import Company
from app.models.company_profile import CompanyProfile
from app.models.contact import Contact
from app.models.enums import CompanyType, Source
from app.models.firm import Firm
from app.models.mandate import Mandate
from app.models.user import User

PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}

SIGNUP = {
    "firm_name": "Northgate Partners",
    "full_name": "Rhea Kapoor",
    "email": "rhea@northgatepartners.com",
    "password": "Passw0rd!",
}


async def _login(client: AsyncClient, creds: dict) -> None:
    resp = await client.post("/auth/login", json=creds)
    assert resp.status_code == 200, resp.text


# ── Signup plants the database and only the database ──────────────────────────


@pytest.mark.asyncio
async def test_signup_plants_the_shipped_company_database(client: AsyncClient):
    resp = await client.post("/auth/signup", json=SIGNUP)
    assert resp.status_code == 201, resp.text

    facets = (await client.get("/sourcing/facets")).json()
    assert facets["total"] == len(company_pool.rows())
    # Segment and sector arrive with it — the lens has something to read on day one.
    assert {s["segment"] for s in facets["by_segment"]} == {"TARGET", "INVESTOR"}
    assert any(s["sector"] == "Private equity" for s in facets["by_sector"])
    # …and no revenue is invented for it.
    assert facets["coverage"]["revenue"] == 0


@pytest.mark.asyncio
async def test_signup_leaves_the_book_empty(client: AsyncClient):
    await client.post("/auth/signup", json=SIGNUP)
    ws = (await client.get("/workspace")).json()
    assert ws["firm"]["name"] == SIGNUP["firm_name"]
    assert ws["book_total"] == 0, ws["book"]
    assert ws["database"]["companies"] == len(company_pool.rows())
    # Configuration is not "data" — a firm without categories or stages cannot work.
    assert ws["config"]["categories"] > 0
    assert ws["config"]["stages"] > 0


@pytest.mark.asyncio
async def test_two_firms_do_not_share_a_book(client: AsyncClient, db_session, partner):
    """The tenant boundary: one firm's imported companies are invisible to another."""
    await client.post("/auth/signup", json=SIGNUP)
    new_firm_pool = (await client.get("/sourcing/facets")).json()["total"]

    # A company placed in the fixture firm's book…
    profile = CompanyProfile(
        firm_id=partner.firm_id,
        company_name="Fixture Only Ltd",
        name_key="fixture only ltd",
    )
    db_session.add(profile)
    await db_session.commit()

    # …does not appear in the firm that just signed up.
    after = (await client.get("/sourcing/facets")).json()["total"]
    assert after == new_firm_pool
    hits = (await client.get("/sourcing/candidates?q=Fixture Only")).json()
    assert hits["total"] == 0


# ── Reset keeps the database, drops the book ─────────────────────────────────


@pytest.mark.asyncio
async def test_reset_drops_the_book_and_keeps_the_database(
    client: AsyncClient, partner, mandate, db_session: AsyncSession
):
    profile = CompanyProfile(
        firm_id=partner.firm_id, company_name="Imported Co", name_key="imported co"
    )
    db_session.add(profile)
    await db_session.flush()
    company = Company(
        firm_id=partner.firm_id,
        mandate_id=mandate.id,
        profile_id=profile.id,
        company_name="Imported Co",
        type=CompanyType.TARGET,
        source=Source.IMPORTED,
    )
    db_session.add(company)
    await db_session.flush()
    db_session.add(
        Contact(
            firm_id=partner.firm_id,
            company_id=company.id,
            contact_person="Asha Rao",
            email="asha@imported.test",
        )
    )
    await db_session.commit()

    await _login(client, PARTNER)
    before = (await client.get("/workspace")).json()
    assert before["book"]["companies"] == 1
    assert before["book"]["contacts"] == 1
    assert before["book"]["mandates"] == 1

    resp = await client.post(
        "/workspace/reset", json={"confirm_firm_name": before["firm"]["name"]}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["deleted"]["companies"] == 1
    assert body["deleted"]["contacts"] == 1
    assert body["kept"]["database_companies"] == before["database"]["companies"]

    after = (await client.get("/workspace")).json()
    assert after["book_total"] == 0
    # The profile survives: it is research, not an import artefact.
    assert (
        await db_session.execute(
            select(CompanyProfile).where(CompanyProfile.id == profile.id)
        )
    ).scalar_one_or_none() is not None
    # And the firm is still usable — configuration untouched.
    assert after["config"]["categories"] == before["config"]["categories"]
    assert after["config"]["users"] == before["config"]["users"]


@pytest.mark.asyncio
async def test_reset_requires_the_firm_name(client: AsyncClient, partner, mandate):
    await _login(client, PARTNER)
    resp = await client.post("/workspace/reset", json={"confirm_firm_name": "wrong"})
    assert resp.status_code == 422
    assert (await client.get("/workspace")).json()["book"]["mandates"] == 1


@pytest.mark.asyncio
async def test_reset_is_partner_only(client: AsyncClient, analyst, mandate):
    await _login(client, ANALYST)
    ws = (await client.get("/workspace")).json()  # readable by anyone in the firm
    resp = await client.post(
        "/workspace/reset", json={"confirm_firm_name": ws["firm"]["name"]}
    )
    assert resp.status_code == 403
    assert (await client.get("/workspace")).json()["book"]["mandates"] == 1


@pytest.mark.asyncio
async def test_workspace_requires_auth(client: AsyncClient):
    assert (await client.get("/workspace")).status_code == 401
    assert (
        await client.post("/workspace/reset", json={"confirm_firm_name": "x"})
    ).status_code == 401


@pytest.mark.asyncio
async def test_reset_clears_tasks_activity_and_project_assignments(
    client: AsyncClient, db_session: AsyncSession, firm: Firm, partner: User
):
    """The three newer book tables reset with the rest of the book.

    This is what catches a missing ``_firm_scope`` branch: ``project_assignments`` has no
    ``firm_id``, so without its own branch the reset would raise on PostgreSQL while
    passing silently on SQLite.
    """
    from app.models.activity_event import ActivityEvent
    from app.models.project import Project
    from app.models.project_assignment import ProjectAssignment
    from app.models.task import Task

    project = Project(firm_id=firm.id, name="Doomed", client_name="Doomed Ltd")
    db_session.add(project)
    await db_session.flush()
    db_session.add_all(
        [
            Task(
                firm_id=firm.id,
                project_id=project.id,
                scope="PROJECT",
                title="A task",
                status="BACKLOG",
                priority="MEDIUM",
                created_by_id=partner.id,
            ),
            ActivityEvent(
                firm_id=firm.id,
                project_id=project.id,
                actor_id=partner.id,
                actor_name=partner.full_name,
                verb="PROJECT_CREATED",
                object_type="PROJECT",
                object_id=project.id,
                object_label="Doomed",
            ),
            ProjectAssignment(project_id=project.id, user_id=partner.id),
        ]
    )
    await db_session.commit()

    r = await client.post("/auth/login", json={"email": "partner@test.com", "password": "Passw0rd!"})
    assert r.status_code == 200

    before = (await client.get("/workspace")).json()["book"]
    assert before["tasks"] == 1
    assert before["activity_events"] == 1
    assert before["project_assignments"] == 1

    r = await client.post("/workspace/reset", json={"confirm_firm_name": firm.name})
    assert r.status_code == 200, r.text
    assert r.json()["deleted"]["tasks"] == 1
    assert r.json()["deleted"]["project_assignments"] == 1

    assert (await client.get("/workspace")).json()["book_total"] == 0
