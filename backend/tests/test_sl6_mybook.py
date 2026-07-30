"""SL-6 — My-book worklist (project grouping + attention sort) & partner group-by-analyst."""

from __future__ import annotations

from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import today_ist
from app.models.company import Company
from app.models.company_profile import CompanyProfile
from app.models.enums import (
    CompanyStatus,
    CompanyType,
    MandateStatus,
    MandateType,
    ScheduleStatus,
)
from app.models.mandate import Mandate
from app.models.outreach_schedule import OutreachSchedule
from app.models.project import Project

PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}
ANALYST = {"email": "analyst@test.com", "password": "Passw0rd!"}


async def _login(client: AsyncClient, creds: dict) -> None:
    resp = await client.post("/auth/login", json=creds)
    assert resp.status_code == 200, resp.text


async def _placement(
    db: AsyncSession, firm_id, mandate_id, name, *, status, sched_kwargs, created_by=None
) -> Company:
    c = Company(
        firm_id=firm_id, mandate_id=mandate_id, company_name=name, type=CompanyType.BUYER,
        status=status, category="OTHER", created_by_id=created_by,
    )
    db.add(c)
    await db.flush()
    db.add(OutreachSchedule(firm_id=firm_id, company_id=c.id, is_current=True, **sched_kwargs))
    await db.commit()
    await db.refresh(c)
    return c


@pytest.mark.asyncio
async def test_my_book_grouping_and_attention_sort(
    client: AsyncClient, partner, firm, db_session
):
    await _login(client, PARTNER)
    proj = Project(firm_id=firm.id, name="ProjA", client_name="ClientA")
    db_session.add(proj)
    await db_session.flush()
    m = Mandate(
        firm_id=firm.id, project_id=proj.id, client_name="ClientA", name="M-A",
        type=MandateType.SELL_SIDE, status=MandateStatus.ACTIVE,
    )
    db_session.add(m)
    await db_session.commit()
    await db_session.refresh(m)

    today = today_ist()
    # Overdue (active, next_due in the past).
    await _placement(
        db_session, firm.id, m.id, "Overdue Co", status=CompanyStatus.CONTACTED,
        sched_kwargs={
            "status": ScheduleStatus.ACTIVE,
            "initial_date": today - timedelta(days=60),
            "cadence_interval_days": 14,
        },
    )
    # Awaiting initial.
    await _placement(
        db_session, firm.id, m.id, "Await Co", status=CompanyStatus.NOT_CONTACTED,
        sched_kwargs={"status": ScheduleStatus.AWAITING_INITIAL},
    )
    # Active, due in the future (due-soon).
    await _placement(
        db_session, firm.id, m.id, "Active Co", status=CompanyStatus.CONTACTED,
        sched_kwargs={
            "status": ScheduleStatus.ACTIVE,
            "initial_date": today - timedelta(days=1),
            "cadence_interval_days": 14,
        },
    )

    resp = await client.get("/my-book")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    group = next(g for g in data["groups"] if g["project_name"] == "ProjA")
    order = [c["company_name"] for c in group["companies"]]
    # overdue → due-soon(active) → awaiting-initial
    assert order == ["Overdue Co", "Active Co", "Await Co"]


@pytest.mark.asyncio
async def test_my_book_visibility(client: AsyncClient, analyst, mandate, db_session):
    """Analyst sees only placements in assigned mandates."""
    await _login(client, ANALYST)
    await _placement(
        db_session, mandate.firm_id, mandate.id, "Hidden Co", status=CompanyStatus.CONTACTED,
        sched_kwargs={"status": ScheduleStatus.AWAITING_INITIAL},
    )
    resp = await client.get("/my-book")
    assert resp.json()["total"] == 0  # analyst not assigned to `mandate`


@pytest.mark.asyncio
async def test_company_profiles_group_by_analyst(
    client: AsyncClient, partner, analyst, firm, db_session
):
    await _login(client, PARTNER)
    m = Mandate(
        firm_id=firm.id, client_name="C", name="M", type=MandateType.SELL_SIDE, status=MandateStatus.ACTIVE,
    )
    db_session.add(m)
    await db_session.flush()
    profile = CompanyProfile(
        firm_id=firm.id, company_name="Shared Co", name_key="shared", domain_key="s.com",
    )
    db_session.add(profile)
    await db_session.flush()
    # Same profile placed by two different analysts → overlap.
    for uid in (partner.id, analyst.id):
        c = Company(
            firm_id=firm.id, mandate_id=m.id, profile_id=profile.id, company_name="Shared Co",
            type=CompanyType.BUYER, status=CompanyStatus.CONTACTED, category="OTHER",
            created_by_id=uid,
        )
        db_session.add(c)
    await db_session.commit()

    resp = await client.get("/company-profiles?scope=firm&group_by=analyst")
    assert resp.status_code == 200
    data = resp.json()
    assert "by_analyst" in data
    shared = next(i for i in data["items"] if i["company_name"] == "Shared Co")
    assert shared["overlap"] is True
    assert len(data["by_analyst"]) == 2
