"""Project membership — and the deliberate asymmetry it does NOT grant.

A project assignment grants access to the project, not to its engagements. That is not an
oversight in the implementation; widening ``visible_mandate_ids`` from ``project_assignments``
would turn one partner click into a backdoor to every engagement's companies and break
CLAUDE.md rule 5. The consequence — an assigned analyst seeing the project shell with an
empty engagements list — is pinned here so nobody later "fixes" it.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.company import Company
from app.models.enums import (
    CompanyCategory,
    CompanyStatus,
    CompanyType,
    MandateStatus,
    MandateType,
    Source,
    SourceQuality,
    UserRole,
)
from app.models.firm import Firm
from app.models.mandate import Mandate
from app.models.mandate_assignment import MandateAssignment
from app.models.project import Project
from app.models.user import User

_PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
_ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}
_OUTSIDER = {"email": "outsider@test.com", "password": "Passw0rd!"}


async def _login(client: AsyncClient, creds: dict) -> None:
    r = await client.post("/auth/login", json=creds)
    assert r.status_code == 200, r.text


@pytest_asyncio.fixture
async def outsider(db_session: AsyncSession, firm: Firm) -> User:
    """An analyst in the firm with no mandate assignments anywhere."""
    u = User(
        firm_id=firm.id,
        email=_OUTSIDER["email"],
        hashed_password=hash_password(_OUTSIDER["password"]),
        full_name="Outside Analyst",
        role=UserRole.ANALYST,
    )
    db_session.add(u)
    await db_session.commit()
    await db_session.refresh(u)
    return u


@pytest_asyncio.fixture
async def world(
    db_session: AsyncSession, firm: Firm, partner: User, analyst: User
) -> dict:
    project = Project(
        firm_id=firm.id, name="Alpha", client_name="Alpha Corp", created_by_id=partner.id
    )
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

    db_session.add(
        Company(
            firm_id=firm.id,
            mandate_id=mandate.id,
            company_name="Acme Industries",
            type=CompanyType.BUYER,
            status=CompanyStatus.NOT_CONTACTED,
            category=CompanyCategory.STRATEGIC,
            source=Source.PROPRIETARY,
            source_quality=SourceQuality.MEDIUM,
        )
    )
    await db_session.commit()
    return {"project_id": project.id, "mandate_id": mandate.id}


# ── Assignment ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_partner_assigns_and_it_is_idempotent(
    client: AsyncClient, world: dict, outsider: User
):
    await _login(client, _PARTNER)
    pid = world["project_id"]

    r = await client.post(f"/projects/{pid}/assignments", json={"user_id": outsider.id})
    assert r.status_code == 201, r.text

    # Idempotent. The status stays 201 because the route declares it, exactly as the
    # mandate assignment route does — this mirrors that one beat for beat, and the body
    # is what distinguishes the second call.
    again = await client.post(f"/projects/{pid}/assignments", json={"user_id": outsider.id})
    assert again.json() == {"detail": "Already assigned"}

    members = (await client.get(f"/projects/{pid}/members")).json()["items"]
    assert sum(1 for m in members if m["id"] == outsider.id) == 1


@pytest.mark.asyncio
async def test_analyst_cannot_assign(client: AsyncClient, world: dict, outsider: User):
    """Task assignment allocates work; project assignment grants access. Only one of
    those is open to everyone, and this is the other one."""
    await _login(client, _ANALYST)
    r = await client.post(
        f"/projects/{world['project_id']}/assignments", json={"user_id": outsider.id}
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_unassign(client: AsyncClient, world: dict, outsider: User):
    await _login(client, _PARTNER)
    pid = world["project_id"]
    await client.post(f"/projects/{pid}/assignments", json={"user_id": outsider.id})

    r = await client.delete(f"/projects/{pid}/assignments/{outsider.id}")
    assert r.status_code == 200
    members = (await client.get(f"/projects/{pid}/members")).json()["items"]
    assert outsider.id not in {m["id"] for m in members}

    assert (await client.delete(f"/projects/{pid}/assignments/{outsider.id}")).status_code == 404


@pytest.mark.asyncio
async def test_assigning_an_unknown_user_is_404(client: AsyncClient, world: dict):
    await _login(client, _PARTNER)
    r = await client.post(
        f"/projects/{world['project_id']}/assignments", json={"user_id": 999999}
    )
    assert r.status_code == 404


# ── The members union ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_members_union_labels_each_source(
    client: AsyncClient, world: dict, outsider: User, partner: User, analyst: User
):
    """Returning only the new table would show every existing project an empty team on
    day one, and the feature would look broken rather than new."""
    await _login(client, _PARTNER)
    pid = world["project_id"]
    await client.post(f"/projects/{pid}/assignments", json={"user_id": outsider.id})

    by_id = {m["id"]: m for m in (await client.get(f"/projects/{pid}/members")).json()["items"]}
    assert by_id[outsider.id]["source"] == "assigned"
    assert by_id[analyst.id]["source"] == "mandate"
    assert by_id[partner.id]["source"] == "creator"


@pytest.mark.asyncio
async def test_members_appear_on_the_projects_list(
    client: AsyncClient, world: dict, outsider: User
):
    await _login(client, _PARTNER)
    pid = world["project_id"]
    await client.post(f"/projects/{pid}/assignments", json={"user_id": outsider.id})

    row = next(p for p in (await client.get("/projects")).json()["items"] if p["id"] == pid)
    assert outsider.id in {m["id"] for m in row["members"]}
    # The old key stays, because the frontend still reads it.
    assert isinstance(row["team"], list)


# ── A5: access to the project, NOT to its engagements ─────────────────────────


@pytest.mark.asyncio
async def test_assignment_grants_the_project_but_not_its_engagements(
    client: AsyncClient, world: dict, outsider: User
):
    """The A5 asymmetry, pinned.

    An assigned-but-unmandated analyst gets the project shell, its tasks and its activity,
    with an empty engagements list and no companies. That is the decision. Making the
    engagements appear means widening ``visible_mandate_ids``, which hands them every
    company in the book — CLAUDE.md rule 5.
    """
    await _login(client, _PARTNER)
    pid = world["project_id"]
    await client.post(f"/projects/{pid}/assignments", json={"user_id": outsider.id})

    await _login(client, _OUTSIDER)

    # The project itself: visible.
    listed = (await client.get("/projects")).json()["items"]
    assert pid in {p["id"] for p in listed}

    detail = await client.get(f"/projects/{pid}")
    assert detail.status_code == 200
    engagements = detail.json()["engagements"]
    assert all(v == [] for v in engagements.values()), engagements
    assert detail.json()["headline"]["total_companies"] == 0

    # Its companies: not visible.
    assert (await client.get("/companies")).json()["items"] == []

    # Its tasks and activity: reachable (an empty feed, but a real 200).
    assert (await client.get("/tasks", params={"project_id": pid})).status_code == 200
    assert (await client.get(f"/projects/{pid}/activity")).status_code == 200


@pytest.mark.asyncio
async def test_an_assigned_analyst_can_create_a_task_on_the_project(
    client: AsyncClient, world: dict, outsider: User
):
    """The point of granting project access: the analyst can actually work there."""
    await _login(client, _PARTNER)
    pid = world["project_id"]
    await client.post(f"/projects/{pid}/assignments", json={"user_id": outsider.id})

    await _login(client, _OUTSIDER)
    r = await client.post("/tasks", json={"title": "Prep the teaser", "project_id": pid})
    assert r.status_code == 201, r.text
    assert r.json()["project_id"] == pid


@pytest.mark.asyncio
async def test_an_unassigned_analyst_sees_nothing(client: AsyncClient, world: dict, outsider: User):
    await _login(client, _OUTSIDER)
    assert (await client.get("/projects")).json()["items"] == []
    assert (await client.get(f"/projects/{world['project_id']}")).status_code == 404
