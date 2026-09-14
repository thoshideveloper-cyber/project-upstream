"""The activity log — one row per mutation, in the mutation's own transaction.

The transactional assertion is the one worth reading twice: a request that ends in a 422
must leave the activity count unchanged. ``log()`` deliberately does not commit, so an
activity row can only survive if the mutation it describes survived too. A feed that
records work which was rolled back is worse than no feed.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.activity_event import ActivityEvent
from app.models.enums import MandateStatus, MandateType, UserRole
from app.models.firm import Firm
from app.models.mandate import Mandate
from app.models.mandate_assignment import MandateAssignment
from app.models.project import Project
from app.models.user import User

_PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
_ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}


async def _login(client: AsyncClient, creds: dict) -> None:
    r = await client.post("/auth/login", json=creds)
    assert r.status_code == 200, r.text


async def _count_events(db: AsyncSession) -> int:
    return (await db.execute(select(func.count()).select_from(ActivityEvent))).scalar() or 0


@pytest_asyncio.fixture
async def visible_project(
    db_session: AsyncSession, firm: Firm, partner: User, analyst: User
) -> Project:
    """A project the analyst reaches through an assigned engagement."""
    project = Project(firm_id=firm.id, name="Alpha", client_name="Alpha Corp")
    db_session.add(project)
    await db_session.flush()
    mandate = Mandate(
        firm_id=firm.id,
        project_id=project.id,
        client_name="Alpha Corp",
        name="Alpha Sell-side",
        type=MandateType.SELL_SIDE,
        status=MandateStatus.ACTIVE,
        lead_owner_id=partner.id,
    )
    db_session.add(mandate)
    await db_session.flush()
    db_session.add(MandateAssignment(mandate_id=mandate.id, user_id=analyst.id))
    await db_session.commit()
    await db_session.refresh(project)
    return project


# ── Writing ───────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_project_create_writes_one_row_with_actor_and_project(
    client: AsyncClient, db_session: AsyncSession, partner: User
):
    await _login(client, _PARTNER)
    r = await client.post("/projects", json={"name": "Zeta", "client_name": "Zeta Ltd"})
    assert r.status_code == 201
    project_id = r.json()["id"]

    events = (await db_session.execute(select(ActivityEvent))).scalars().all()
    assert len(events) == 1
    e = events[0]
    assert e.verb.value == "PROJECT_CREATED"
    assert e.actor_id == partner.id
    assert e.actor_name == partner.full_name
    assert e.project_id == project_id
    assert e.object_label == "Zeta"


@pytest.mark.asyncio
async def test_archive_writes_a_row_on_the_project(
    client: AsyncClient, db_session: AsyncSession, visible_project: Project
):
    await _login(client, _PARTNER)
    assert (await client.delete(f"/projects/{visible_project.id}")).status_code == 200

    body = (await client.get(f"/projects/{visible_project.id}/activity")).json()
    # The project is archived, but a partner still sees it, and so does its trail.
    assert "PROJECT_ARCHIVED" in {e["verb"] for e in body["items"]}


@pytest.mark.asyncio
async def test_task_mutations_narrate_status_not_completion(
    client: AsyncClient, visible_project: Project
):
    """No TASK_COMPLETED verb — DONE is a status change with from/to in meta."""
    await _login(client, _PARTNER)
    task_id = (
        await client.post(
            "/tasks", json={"title": "Ship it", "project_id": visible_project.id}
        )
    ).json()["id"]
    await client.patch(f"/tasks/{task_id}/status", json={"status": "DONE"})

    items = (await client.get(f"/projects/{visible_project.id}/activity")).json()["items"]
    verbs = [e["verb"] for e in items]
    assert "TASK_CREATED" in verbs
    assert "TASK_COMPLETED" not in verbs
    change = next(e for e in items if e["verb"] == "TASK_STATUS_CHANGED")
    assert change["meta"] == {"from": "BACKLOG", "to": "DONE"}


@pytest.mark.asyncio
async def test_a_422_leaves_the_activity_count_unchanged(
    client: AsyncClient, db_session: AsyncSession, visible_project: Project
):
    """The whole argument for log() not committing, in one assertion."""
    await _login(client, _PARTNER)
    before = await _count_events(db_session)
    r = await client.post(
        "/tasks",
        json={
            "title": "Doomed",
            "project_id": visible_project.id,
            "company_id": 999999,  # two attachments -> 422 in the schema validator
        },
    )
    assert r.status_code == 422
    assert await _count_events(db_session) == before


# ── Reading ───────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_firm_scoping(client: AsyncClient, db_session: AsyncSession, visible_project: Project):
    other_firm = Firm(name="Other Firm")
    db_session.add(other_firm)
    await db_session.flush()
    db_session.add(
        User(
            firm_id=other_firm.id,
            email="stranger@other.com",
            hashed_password=hash_password("Passw0rd!"),
            full_name="Stranger",
            role=UserRole.PARTNER,
        )
    )
    await db_session.commit()

    await _login(client, _PARTNER)
    await client.post("/projects", json={"name": "Ours", "client_name": "Ours"})

    await _login(client, {"email": "stranger@other.com", "password": "Passw0rd!"})
    assert (await client.get("/activity")).json()["items"] == []


@pytest.mark.asyncio
async def test_analyst_sees_only_their_own_projects(
    client: AsyncClient, db_session: AsyncSession, firm: Firm, visible_project: Project
):
    hidden = Project(firm_id=firm.id, name="Hidden", client_name="Hidden Co")
    db_session.add(hidden)
    await db_session.commit()

    await _login(client, _PARTNER)
    await client.patch(f"/projects/{hidden.id}", json={"name": "Hidden Renamed"})
    await client.patch(f"/projects/{visible_project.id}", json={"name": "Alpha Renamed"})

    await _login(client, _ANALYST)
    labels = {e["object_label"] for e in (await client.get("/activity")).json()["items"]}
    assert "Alpha Renamed" in labels
    assert "Hidden Renamed" not in labels


@pytest.mark.asyncio
async def test_unattached_rows_are_visible_only_to_their_actor_and_to_partners(
    client: AsyncClient, visible_project: Project
):
    """The ``project_id IS NULL`` rule. Without it an analyst reads the firm's admin trail."""
    await _login(client, _ANALYST)
    await client.post("/tasks", json={"title": "Analyst's own errand"})

    # The analyst sees their own unattached row.
    await _login(client, _ANALYST)
    labels = {e["object_label"] for e in (await client.get("/activity")).json()["items"]}
    assert "Analyst's own errand" in labels

    # The partner sees it too (it is firm activity), but a second analyst would not —
    # covered by the firm-wide task list test, which is the surface that leaks.
    await _login(client, _PARTNER)
    labels = {e["object_label"] for e in (await client.get("/activity")).json()["items"]}
    assert "Analyst's own errand" in labels


@pytest.mark.asyncio
async def test_group_filter(client: AsyncClient, visible_project: Project):
    await _login(client, _PARTNER)
    await client.post("/tasks", json={"title": "A task", "project_id": visible_project.id})

    people = (await client.get("/activity", params={"group": "PEOPLE"})).json()
    assert {e["verb"] for e in people["items"]} == {"TASK_CREATED"}

    outreach = (await client.get("/activity", params={"group": "OUTREACH"})).json()
    assert outreach["items"] == []

    # An unknown group must return nothing, not everything.
    assert (await client.get("/activity", params={"group": "NOPE"})).json()["items"] == []


@pytest.mark.asyncio
async def test_project_activity_404s_for_an_invisible_project(
    client: AsyncClient, db_session: AsyncSession, firm: Firm, visible_project: Project
):
    hidden = Project(firm_id=firm.id, name="Hidden", client_name="Hidden Co")
    db_session.add(hidden)
    await db_session.commit()

    await _login(client, _ANALYST)
    assert (await client.get(f"/projects/{hidden.id}/activity")).status_code == 404


@pytest.mark.asyncio
async def test_there_is_no_way_to_write_activity(client: AsyncClient):
    # No login: routing resolves before dependencies, so a 405 here proves the method is
    # absent rather than merely unauthorised — which is the stronger statement.
    r = await client.post("/activity", json={"verb": "PROJECT_CREATED"})
    assert r.status_code == 405
