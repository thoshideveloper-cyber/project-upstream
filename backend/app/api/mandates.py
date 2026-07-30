"""Mandates router — list/detail/create/edit + assignments + archive/unarchive (§6.1).

Role model (plan §6.1): list/detail/companies are visibility-scoped (analyst → assigned
only, partner → all). Mandate lifecycle — create, edit, archive/unarchive, and assignment —
is a PARTNER-only management function.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, PartnerDep, SessionDep, visible_mandate_ids
from app.models.company import Company
from app.models.enums import CompanyStatus, ScheduleStatus
from app.models.mandate import Mandate
from app.models.mandate_assignment import MandateAssignment
from app.models.outreach_schedule import OutreachSchedule
from app.models.project import Project
from app.models.user import User
from app.schemas.mandate import MandateBase, MandateRead, MandateUpdate

router = APIRouter(prefix="/mandates", tags=["mandates"])

RESPONDED = CompanyStatus.RESPONDED


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _mandate_stats(db, mandate_ids: list[int]) -> dict[int, dict]:
    """Aggregate company stats per mandate (non-archived companies)."""
    if not mandate_ids:
        return {}

    # Portable across SQLite + Postgres: pull rows and tally in Python for clarity.
    result = await db.execute(
        select(Company.mandate_id, Company.id, Company.status).where(
            Company.mandate_id.in_(mandate_ids),
            Company.archived_at.is_(None),
        )
    )
    stats: dict[int, dict] = {mid: {"total": 0, "responded": 0} for mid in mandate_ids}
    company_ids_by_mandate: dict[int, list[int]] = {mid: [] for mid in mandate_ids}
    for mandate_id, company_id, status_val in result.all():
        s = stats[mandate_id]
        s["total"] += 1
        company_ids_by_mandate[mandate_id].append(company_id)
        if status_val == RESPONDED:
            s["responded"] += 1

    # needs_initial per mandate (schedules AWAITING_INITIAL)
    all_company_ids = [cid for ids in company_ids_by_mandate.values() for cid in ids]
    if all_company_ids:
        sched_rows = await db.execute(
            select(OutreachSchedule.company_id, OutreachSchedule.status).where(
                OutreachSchedule.company_id.in_(all_company_ids)
            )
        )
        company_to_mandate = {
            cid: mid for mid, ids in company_ids_by_mandate.items() for cid in ids
        }
        for company_id, sched_status in sched_rows.all():
            mid = company_to_mandate.get(company_id)
            if mid is None:
                continue
            stats[mid].setdefault("needs_initial", 0)
            if sched_status == ScheduleStatus.AWAITING_INITIAL:
                stats[mid]["needs_initial"] = stats[mid].get("needs_initial", 0) + 1

    for s in stats.values():
        s.setdefault("needs_initial", 0)
        s["responded_pct"] = round(s["responded"] / s["total"], 4) if s["total"] else 0.0
    return stats


async def _assignment_users(db, mandate_id: int) -> list[dict]:
    rows = await db.execute(
        select(User)
        .join(MandateAssignment, MandateAssignment.user_id == User.id)
        .where(MandateAssignment.mandate_id == mandate_id)
        .order_by(User.full_name)
    )
    return [
        {"id": u.id, "full_name": u.full_name, "email": u.email, "role": u.role.value}
        for u in rows.scalars().all()
    ]


async def _get_visible_mandate(mandate_id: int, db, current_user, include_archived=False) -> Mandate:
    visible = await visible_mandate_ids(current_user, db)
    q = select(Mandate).where(
        Mandate.id == mandate_id,
        Mandate.firm_id == current_user.firm_id,
    )
    if not include_archived:
        q = q.where(Mandate.archived_at.is_(None))
    if visible is not None:
        q = q.where(Mandate.id.in_(visible))
    result = await db.execute(q)
    mandate = result.scalar_one_or_none()
    if not mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")
    return mandate


# ── List / Create ─────────────────────────────────────────────────────────────


@router.get("")
async def list_mandates(
    db: SessionDep,
    current_user: CurrentUser,
    include_archived: bool = Query(default=False),
):
    visible = await visible_mandate_ids(current_user, db)
    q = select(Mandate).where(Mandate.firm_id == current_user.firm_id)
    if not include_archived:
        q = q.where(Mandate.archived_at.is_(None))
    if visible is not None:
        q = q.where(Mandate.id.in_(visible))
    q = q.order_by(Mandate.created_at.desc())

    mandates = (await db.execute(q)).scalars().all()
    stats = await _mandate_stats(db, [m.id for m in mandates])

    items = []
    for m in mandates:
        base = MandateRead.model_validate(m).model_dump()
        base.update(stats.get(m.id, {"total": 0, "responded": 0, "needs_initial": 0, "responded_pct": 0.0}))
        items.append(base)
    return {"items": items, "total": len(items)}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_mandate(body: MandateBase, db: SessionDep, current_user: CurrentUser):
    """Create an engagement. Analysts may open engagements on their own projects;
    the creator is auto-assigned so the new engagement is visible to them.

    An engagement must belong to a Project (the client). If ``project_id`` is given it
    is validated to be a live project in the user's firm.
    """
    if body.project_id is not None:
        project = (
            await db.execute(
                select(Project).where(
                    Project.id == body.project_id,
                    Project.firm_id == current_user.firm_id,
                    Project.archived_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")

    mandate = Mandate(firm_id=current_user.firm_id, **body.model_dump())
    db.add(mandate)
    await db.commit()
    await db.refresh(mandate)

    # Seed a sensible default set of sourcing layers for this engagement (§7.3).
    from app.services.classification import seed_mandate_layers

    await seed_mandate_layers(db, current_user.firm_id, mandate.id, mandate.type)

    # Auto-assign the lead owner and the creator so the mandate is visible to both.
    assignee_ids = {current_user.id}
    if mandate.lead_owner_id:
        assignee_ids.add(mandate.lead_owner_id)
    for user_id in assignee_ids:
        db.add(MandateAssignment(mandate_id=mandate.id, user_id=user_id))
    await db.commit()

    return MandateRead.model_validate(mandate).model_dump()


# ── Detail / Edit ─────────────────────────────────────────────────────────────


@router.get("/{mandate_id}")
async def get_mandate(mandate_id: int, db: SessionDep, current_user: CurrentUser):
    mandate = await _get_visible_mandate(mandate_id, db, current_user, include_archived=True)
    data = MandateRead.model_validate(mandate).model_dump()
    stats = await _mandate_stats(db, [mandate.id])
    data["stats"] = stats.get(mandate.id, {"total": 0, "responded": 0, "needs_initial": 0, "responded_pct": 0.0})
    data["assignments"] = await _assignment_users(db, mandate.id)
    if mandate.lead_owner_id:
        owner = (await db.execute(select(User).where(User.id == mandate.lead_owner_id))).scalar_one_or_none()
        data["lead_owner"] = (
            {"id": owner.id, "full_name": owner.full_name, "email": owner.email}
            if owner else None
        )
    else:
        data["lead_owner"] = None
    return data


@router.patch("/{mandate_id}")
async def update_mandate(
    mandate_id: int, body: MandateUpdate, db: SessionDep, current_user: PartnerDep
):
    mandate = await _get_visible_mandate(mandate_id, db, current_user, include_archived=True)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(mandate, field, val)
    await db.commit()
    await db.refresh(mandate)
    return MandateRead.model_validate(mandate).model_dump()


# ── Archive / Unarchive (partner) ─────────────────────────────────────────────


@router.post("/{mandate_id}/archive")
async def archive_mandate(mandate_id: int, db: SessionDep, current_user: PartnerDep):
    mandate = await _get_visible_mandate(mandate_id, db, current_user, include_archived=True)
    mandate.archived_at = datetime.now(timezone.utc)
    await db.commit()
    return {"detail": "Mandate archived"}


@router.post("/{mandate_id}/unarchive")
async def unarchive_mandate(mandate_id: int, db: SessionDep, current_user: PartnerDep):
    mandate = await _get_visible_mandate(mandate_id, db, current_user, include_archived=True)
    mandate.archived_at = None
    await db.commit()
    return {"detail": "Mandate restored"}


# ── Companies under a mandate ─────────────────────────────────────────────────


@router.get("/{mandate_id}/companies")
async def mandate_companies(
    mandate_id: int,
    db: SessionDep,
    current_user: CurrentUser,
    include_archived: bool = Query(default=False),
):
    await _get_visible_mandate(mandate_id, db, current_user, include_archived=True)
    q = select(Company).where(Company.mandate_id == mandate_id)
    if not include_archived:
        q = q.where(Company.archived_at.is_(None))
    q = q.order_by(Company.company_name)
    companies = (await db.execute(q)).scalars().all()
    from app.schemas.company import CompanyRead
    return {
        "items": [CompanyRead.model_validate(c).model_dump() for c in companies],
        "total": len(companies),
    }


# ── Assignments (partner only) ────────────────────────────────────────────────


class AssignmentBody(BaseModel):
    user_id: int


@router.post("/{mandate_id}/assignments", status_code=status.HTTP_201_CREATED)
async def assign_user(
    mandate_id: int, body: AssignmentBody, db: SessionDep, current_user: PartnerDep
):
    mandate = await _get_visible_mandate(mandate_id, db, current_user, include_archived=True)

    # User must belong to the same firm
    user = (await db.execute(
        select(User).where(User.id == body.user_id, User.firm_id == current_user.firm_id)
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Idempotent: skip if already assigned
    existing = (await db.execute(
        select(MandateAssignment).where(
            MandateAssignment.mandate_id == mandate_id,
            MandateAssignment.user_id == body.user_id,
        )
    )).scalar_one_or_none()
    if existing:
        return {"detail": "Already assigned"}

    db.add(MandateAssignment(mandate_id=mandate_id, user_id=body.user_id))
    await db.commit()
    return {"detail": "User assigned"}


@router.delete("/{mandate_id}/assignments/{user_id}")
async def unassign_user(
    mandate_id: int, user_id: int, db: SessionDep, current_user: PartnerDep
):
    await _get_visible_mandate(mandate_id, db, current_user, include_archived=True)
    assignment = (await db.execute(
        select(MandateAssignment).where(
            MandateAssignment.mandate_id == mandate_id,
            MandateAssignment.user_id == user_id,
        )
    )).scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    await db.delete(assignment)
    await db.commit()
    return {"detail": "User unassigned"}
