"""Companies router — Master List CRUD + summary envelope + cadence fields (C-01..05, X-01)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, SessionDep, visible_mandate_ids
from app.core.time import today_ist
from app.models.company import Company
from app.models.company_category import CompanyCategoryVocab
from app.models.contact import Contact
from app.models.enums import (
    CompanyCategory,
    CompanyStatus,
    CompanyType,
    ContactMode,
    Engagement,
    OutreachEventType,
    ScheduleStatus,
    Sentiment,
    Source,
    SourceQuality,
    StoppedReason,
)
from app.models.mandate import Mandate
from app.models.outreach_event import OutreachEvent
from app.models.outreach_schedule import OutreachSchedule
from app.models.sourcing_layer import SourcingLayer
from app.schemas.company import CompanyCreate, CompanyRead, CompanyUpdate
from app.schemas.outreach_schedule import OutreachScheduleUpdate
from app.services.cadence import (
    EVENT_STOP_MAP,
    activate_schedule,
    compute_cadence,
    effective_cap,
    get_followups_done,
    pause_schedule,
    recompute_status,
    restart_cycle,
    resume_schedule,
    stop_schedule,
)
from app.services.classification import LEGACY_ENUM_TO_CODE, legacy_category_for_code
from app.services.cross_mandate import find_duplicates
from app.services.profiles import (
    STATIC_FACT_FIELDS,
    propagate_profile_to_companies,
    upsert_profile,
)
# Type derivation is single-sourced in the sourcing service so the /companies create
# path and the /sourcing push path never drift (BUG-7 / review guardrail).
from app.services.sourcing import _TYPE_BY_MANDATE_TYPE

router = APIRouter(prefix="/companies", tags=["companies"])

STOP_STATUSES = {CompanyStatus.RESPONDED, CompanyStatus.BOUNCED, CompanyStatus.DECLINED}


# ── Helpers ───────────────────────────────────────────────────────────────────


def _cadence_fields(sched: OutreachSchedule | None, followups_done: int) -> dict[str, Any]:
    """Compute cadence fields: next_due_date / days_remaining / is_overdue / is_cold / cycle_number."""
    if sched is None:
        return {
            "schedule_status": None,
            "cycle_number": None,
            "is_cold": False,
            "next_due_date": None,
            "days_remaining": None,
            "is_overdue": False,
        }
    is_cold = (
        sched.status == ScheduleStatus.STOPPED
        and sched.stopped_reason == StoppedReason.EXHAUSTED
    )
    if sched.status != ScheduleStatus.ACTIVE or sched.initial_date is None:
        return {
            "schedule_status": sched.status,
            "cycle_number": sched.cycle_number,
            "is_cold": is_cold,
            "next_due_date": None,
            "days_remaining": None,
            "is_overdue": False,
        }
    today = today_ist()
    n = followups_done + 1
    next_due = sched.initial_date + timedelta(days=n * sched.cadence_interval_days)
    days_remaining = (next_due - today).days
    return {
        "schedule_status": sched.status,
        "cycle_number": sched.cycle_number,
        "is_cold": is_cold,
        "next_due_date": next_due.isoformat(),
        "days_remaining": days_remaining,
        "is_overdue": days_remaining < 0,
    }


async def _followups_done(db, schedule_id: int | None) -> int:
    if schedule_id is None:
        return 0
    result = await db.execute(
        select(func.count()).select_from(OutreachEvent).where(
            OutreachEvent.schedule_id == schedule_id,
            OutreachEvent.event_type == OutreachEventType.FOLLOW_UP,
        )
    )
    return result.scalar() or 0


async def _primary_contact_summary(db, company_id: int) -> dict | None:
    result = await db.execute(
        select(Contact).where(
            Contact.company_id == company_id,
            Contact.is_primary.is_(True),
            Contact.archived_at.is_(None),
        )
    )
    c = result.scalar_one_or_none()
    if not c:
        return None
    return {
        "id": c.id,
        "contact_person": c.contact_person,
        "designation": c.designation,
        "email": c.email,
    }


def _classification_fields(
    company: Company,
    category_map: dict[int, CompanyCategoryVocab] | None,
    layer_map: dict[int, SourcingLayer] | None,
) -> dict[str, Any]:
    """Resolve category + sourcing-layer display fields (from pre-fetched maps if given)."""
    cat = category_map.get(company.category_id) if category_map else None
    layer = layer_map.get(company.sourcing_layer_id) if layer_map else None
    return {
        "category_name": cat.name if cat else None,
        "category_code": cat.code if cat else None,
        "sourcing_layer_name": layer.name if layer else None,
    }


async def _load_classification_maps(
    db, companies: list[Company]
) -> tuple[dict[int, CompanyCategoryVocab], dict[int, SourcingLayer]]:
    """Batch-load the vocab + layer rows referenced by a page of companies (no N+1)."""
    cat_ids = {c.category_id for c in companies if c.category_id is not None}
    layer_ids = {c.sourcing_layer_id for c in companies if c.sourcing_layer_id is not None}
    category_map: dict[int, CompanyCategoryVocab] = {}
    layer_map: dict[int, SourcingLayer] = {}
    if cat_ids:
        rows = await db.execute(
            select(CompanyCategoryVocab).where(CompanyCategoryVocab.id.in_(cat_ids))
        )
        category_map = {c.id: c for c in rows.scalars().all()}
    if layer_ids:
        rows = await db.execute(select(SourcingLayer).where(SourcingLayer.id.in_(layer_ids)))
        layer_map = {layer.id: layer for layer in rows.scalars().all()}
    return category_map, layer_map


async def _enrich_company(
    db,
    company: Company,
    category_map: dict[int, CompanyCategoryVocab] | None = None,
    layer_map: dict[int, SourcingLayer] | None = None,
) -> dict:
    """Return a company dict with cadence + primary-contact + classification fields added.

    When ``category_map``/``layer_map`` are omitted (single-company path) they are
    resolved on demand; the list path passes pre-fetched maps to avoid N+1.
    """
    sched_result = await db.execute(
        select(OutreachSchedule).where(
            OutreachSchedule.company_id == company.id,
            OutreachSchedule.is_current.is_(True),
        )
    )
    sched = sched_result.scalar_one_or_none()

    fu_done = await _followups_done(db, sched.id if sched else None)
    cadence = _cadence_fields(sched, fu_done)
    primary = await _primary_contact_summary(db, company.id)

    if category_map is None and layer_map is None:
        category_map, layer_map = await _load_classification_maps(db, [company])

    base = CompanyRead.model_validate(company).model_dump()
    base.update(cadence)
    base.update(_classification_fields(company, category_map, layer_map))
    base["primary_contact"] = primary
    base["initial_date"] = sched.initial_date.isoformat() if sched and sched.initial_date else None
    return base


async def _enrich_companies_batch(db, companies: list[Company]) -> list[dict]:
    """Enrich a page of companies with cadence + primary-contact + classification.

    All lookups (current schedules, follow-up counts, primary contacts, vocab/layer
    rows) are batched into one query each — fixes the per-row N+1 (BUG-9).
    """
    if not companies:
        return []
    company_ids = [c.id for c in companies]

    sched_rows = await db.execute(
        select(OutreachSchedule).where(
            OutreachSchedule.company_id.in_(company_ids),
            OutreachSchedule.is_current.is_(True),
        )
    )
    sched_by_company = {s.company_id: s for s in sched_rows.scalars().all()}

    sched_ids = [s.id for s in sched_by_company.values()]
    fu_by_sched: dict[int, int] = {}
    if sched_ids:
        fu_rows = await db.execute(
            select(OutreachEvent.schedule_id, func.count(OutreachEvent.id))
            .where(
                OutreachEvent.schedule_id.in_(sched_ids),
                OutreachEvent.event_type == OutreachEventType.FOLLOW_UP,
            )
            .group_by(OutreachEvent.schedule_id)
        )
        fu_by_sched = {sid: cnt for sid, cnt in fu_rows.all()}

    pc_rows = await db.execute(
        select(Contact).where(
            Contact.company_id.in_(company_ids),
            Contact.is_primary.is_(True),
            Contact.archived_at.is_(None),
        )
    )
    primary_by_company: dict[int, dict] = {}
    for c in pc_rows.scalars().all():
        primary_by_company.setdefault(
            c.company_id,
            {
                "id": c.id,
                "contact_person": c.contact_person,
                "designation": c.designation,
                "email": c.email,
            },
        )

    category_map, layer_map = await _load_classification_maps(db, companies)

    items: list[dict] = []
    for company in companies:
        sched = sched_by_company.get(company.id)
        fu_done = fu_by_sched.get(sched.id, 0) if sched else 0
        base = CompanyRead.model_validate(company).model_dump()
        base.update(_cadence_fields(sched, fu_done))
        base.update(_classification_fields(company, category_map, layer_map))
        base["primary_contact"] = primary_by_company.get(company.id)
        base["initial_date"] = (
            sched.initial_date.isoformat() if sched and sched.initial_date else None
        )
        items.append(base)
    return items


async def _resolve_category(
    db, firm_id: int, category_id: int | None, legacy_enum: CompanyCategory | None
) -> tuple[int | None, CompanyCategory]:
    """Resolve the (category_id, legacy-enum-cache) pair to persist on a company.

    Priority: an explicit ``category_id`` (validated against the firm vocab) wins and
    the legacy enum is derived from its code. Otherwise, best-effort resolve a
    ``category_id`` from the legacy enum's code so old-style clients still link up.
    """
    if category_id is not None:
        cat = (
            await db.execute(
                select(CompanyCategoryVocab).where(
                    CompanyCategoryVocab.id == category_id,
                    CompanyCategoryVocab.firm_id == firm_id,
                )
            )
        ).scalar_one_or_none()
        if cat is None:
            raise HTTPException(status_code=422, detail="Invalid category_id")
        return cat.id, legacy_category_for_code(cat.code)

    code = LEGACY_ENUM_TO_CODE.get(legacy_enum.value) if legacy_enum else None
    resolved_id: int | None = None
    if code:
        cat = (
            await db.execute(
                select(CompanyCategoryVocab).where(
                    CompanyCategoryVocab.firm_id == firm_id,
                    CompanyCategoryVocab.code == code,
                    CompanyCategoryVocab.archived_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        resolved_id = cat.id if cat else None
    return resolved_id, (legacy_enum or CompanyCategory.OTHER)


async def _validate_sourcing_layer(
    db, firm_id: int, mandate_id: int, layer_id: int | None
) -> None:
    """A sourcing layer must belong to this firm AND this engagement (§7.3)."""
    if layer_id is None:
        return
    layer = (
        await db.execute(
            select(SourcingLayer).where(
                SourcingLayer.id == layer_id,
                SourcingLayer.firm_id == firm_id,
                SourcingLayer.mandate_id == mandate_id,
                SourcingLayer.archived_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if layer is None:
        raise HTTPException(
            status_code=422, detail="Invalid sourcing_layer_id for this engagement"
        )


# ── Summary aggregate ─────────────────────────────────────────────────────────


async def _compute_summary(db, company_ids: list[int]) -> dict:
    """Compute summary stats over the entire filtered set (not just the page)."""
    if not company_ids:
        return {
            "responded_pct": 0.0,
            "overdue_count": 0,
            "needs_initial_count": 0,
            "by_status": {s.value: 0 for s in CompanyStatus},
        }

    # Status counts
    rows = await db.execute(
        select(Company.status, func.count()).where(
            Company.id.in_(company_ids)
        ).group_by(Company.status)
    )
    by_status: dict[str, int] = {s.value: 0 for s in CompanyStatus}
    total = 0
    for status_val, cnt in rows:
        by_status[status_val] = cnt
        total += cnt

    responded = by_status.get(CompanyStatus.RESPONDED.value, 0)
    responded_pct = round(responded / total, 4) if total else 0.0

    # Needs-initial count — current cycle only (A3)
    needs_initial = await db.execute(
        select(func.count()).select_from(OutreachSchedule).where(
            OutreachSchedule.company_id.in_(company_ids),
            OutreachSchedule.status == ScheduleStatus.AWAITING_INITIAL,
            OutreachSchedule.is_current.is_(True),
        )
    )
    needs_initial_count = needs_initial.scalar() or 0

    # Overdue count — current cycle only (A3). Follow-up counts are batched (no N+1).
    today = today_ist()
    active_scheds = list(
        (
            await db.execute(
                select(OutreachSchedule).where(
                    OutreachSchedule.company_id.in_(company_ids),
                    OutreachSchedule.status == ScheduleStatus.ACTIVE,
                    OutreachSchedule.initial_date.is_not(None),
                    OutreachSchedule.is_current.is_(True),
                )
            )
        ).scalars().all()
    )
    fu_by_sched: dict[int, int] = {}
    active_ids = [s.id for s in active_scheds]
    if active_ids:
        fu_rows = await db.execute(
            select(OutreachEvent.schedule_id, func.count(OutreachEvent.id))
            .where(
                OutreachEvent.schedule_id.in_(active_ids),
                OutreachEvent.event_type == OutreachEventType.FOLLOW_UP,
            )
            .group_by(OutreachEvent.schedule_id)
        )
        fu_by_sched = {sid: cnt for sid, cnt in fu_rows.all()}
    overdue_count = 0
    for sched in active_scheds:
        n = fu_by_sched.get(sched.id, 0) + 1
        next_due = sched.initial_date + timedelta(days=n * sched.cadence_interval_days)
        if next_due < today:
            overdue_count += 1

    return {
        "responded_pct": responded_pct,
        "overdue_count": overdue_count,
        "needs_initial_count": needs_initial_count,
        "by_status": by_status,
    }


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("")
async def list_companies(
    db: SessionDep,
    current_user: CurrentUser,
    q: str | None = Query(default=None),
    status: CompanyStatus | None = Query(default=None),
    type: CompanyType | None = Query(default=None),
    category: CompanyCategory | None = Query(default=None),
    category_id: int | None = Query(default=None),
    sourcing_layer_id: int | None = Query(default=None),
    unsorted: bool = Query(default=False, description="Only companies with no sourcing layer"),
    mandate_id: int | None = Query(default=None),
    source: Source | None = Query(default=None),
    sort: str | None = Query(default="company_name"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=500),
    include_archived: bool = Query(default=False),
):
    visible = await visible_mandate_ids(current_user, db)

    # One filter set reused for both the id/summary scan and the page (BUG-11 — never
    # rebuild from .whereclause, which silently drops joins).
    conditions = [Company.firm_id == current_user.firm_id]
    if visible is not None:
        conditions.append(Company.mandate_id.in_(visible))
    if not include_archived:
        conditions.append(Company.archived_at.is_(None))
    if q:
        conditions.append(Company.company_name.ilike(f"%{q}%"))
    if status:
        conditions.append(Company.status == status)
    if type:
        conditions.append(Company.type == type)
    if category:
        conditions.append(Company.category == category)
    if category_id:
        conditions.append(Company.category_id == category_id)
    if sourcing_layer_id:
        conditions.append(Company.sourcing_layer_id == sourcing_layer_id)
    if unsorted:
        conditions.append(Company.sourcing_layer_id.is_(None))
    if mandate_id:
        conditions.append(Company.mandate_id == mandate_id)
    if source:
        conditions.append(Company.source == source)

    # All IDs for the summary aggregate (whole filtered set, not just the page)
    id_result = await db.execute(select(Company.id).where(*conditions))
    all_ids = [r[0] for r in id_result.all()]

    # Sort
    sort_col = Company.company_name
    if sort == "status":
        sort_col = Company.status
    elif sort == "created_at":
        sort_col = Company.created_at
    elif sort == "-created_at":
        sort_col = Company.created_at.desc()

    total = len(all_ids)
    paged_result = await db.execute(
        select(Company)
        .where(*conditions)
        .order_by(sort_col)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    companies = list(paged_result.scalars().all())

    items = await _enrich_companies_batch(db, companies)
    summary = await _compute_summary(db, all_ids)

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "summary": summary,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_company(body: CompanyCreate, db: SessionDep, current_user: CurrentUser):
    # Firm-scope check: mandate must belong to this firm
    mandate = (
        await db.execute(
            select(Mandate).where(
                Mandate.id == body.mandate_id,
                Mandate.firm_id == current_user.firm_id,
                Mandate.archived_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")

    data = body.model_dump(exclude={"contacts", "cadence_interval_days"})
    # Analyst-chosen follow-up cadence for the cycle-1 schedule (default 7 days).
    cadence_interval_days = body.cadence_interval_days or 7

    # Type is DERIVED from the engagement side when not provided (BUG-7).
    if data.get("type") is None:
        data["type"] = _TYPE_BY_MANDATE_TYPE.get(mandate.type, CompanyType.TARGET)

    # Two-axis classification: category_id is the source of truth; category enum is a cache.
    category_id, legacy_cat = await _resolve_category(
        db, current_user.firm_id, data.pop("category_id", None), data.get("category")
    )
    await _validate_sourcing_layer(
        db, current_user.firm_id, mandate.id, data.get("sourcing_layer_id")
    )
    data["category_id"] = category_id
    data["category"] = legacy_cat

    company = Company(
        firm_id=current_user.firm_id,
        created_by_id=current_user.id,
        **data,
    )
    db.add(company)
    await db.flush()

    # Attach the shared firm-wide profile and enrich it (Req A bridge, §8-A). The
    # analyst's just-entered facts enrich the profile latest-wins, then every company
    # sharing it (incl. this one) syncs from the merged record.
    facts = {f: getattr(company, f) for f in STATIC_FACT_FIELDS}
    profile = await upsert_profile(db, current_user.firm_id, facts, enrich=True)
    company.profile_id = profile.id
    await db.flush()
    await propagate_profile_to_companies(db, profile)

    # Optional inline primary contact(s) from the add form (§7.4); first is primary.
    if body.contacts:
        for i, ic in enumerate(body.contacts):
            if not ic.contact_person or not ic.contact_person.strip():
                continue
            db.add(
                Contact(
                    firm_id=current_user.firm_id,
                    company_id=company.id,
                    is_primary=(i == 0),
                    **ic.model_dump(),
                )
            )

    # Auto-create cycle-1 AWAITING_INITIAL schedule (C-04) with the chosen cadence.
    schedule = OutreachSchedule(
        firm_id=current_user.firm_id,
        company_id=company.id,
        status=ScheduleStatus.AWAITING_INITIAL,
        cycle_number=1,
        is_current=True,
        cadence_interval_days=cadence_interval_days,
    )
    db.add(schedule)
    await db.commit()
    # Reload server-managed columns (updated_at onupdate) touched by the profile write.
    await db.refresh(company)

    # Cross-mandate duplicate warnings (X-01, non-blocking)
    warnings = await find_duplicates(
        db,
        firm_id=current_user.firm_id,
        mandate_id=company.mandate_id,
        company_name=company.company_name,
        website=company.website,
    )

    enriched = await _enrich_company(db, company)
    enriched["duplicate_warnings"] = warnings
    return enriched


@router.get("/check-duplicate")
async def check_duplicate(
    db: SessionDep,
    current_user: CurrentUser,
    name: str = Query(...),
    website: str | None = Query(default=None),
    mandate_id: int = Query(...),
):
    warnings = await find_duplicates(
        db,
        firm_id=current_user.firm_id,
        mandate_id=mandate_id,
        company_name=name,
        website=website,
    )
    return {"warnings": warnings}


@router.get("/{company_id}")
async def get_company(company_id: int, db: SessionDep, current_user: CurrentUser):
    visible = await visible_mandate_ids(current_user, db)

    q = select(Company).where(
        Company.id == company_id,
        Company.firm_id == current_user.firm_id,
    )
    if visible is not None:
        q = q.where(Company.mandate_id.in_(visible))

    result = await db.execute(q)
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    enriched = await _enrich_company(db, company)

    # Full contacts list
    contacts_result = await db.execute(
        select(Contact).where(
            Contact.company_id == company_id,
            Contact.archived_at.is_(None),
        )
    )
    from app.schemas.contact import ContactRead
    enriched["contacts"] = [
        ContactRead.model_validate(c).model_dump() for c in contacts_result.scalars().all()
    ]

    # Schedule detail — current cycle only (A1 site 2)
    sched_result = await db.execute(
        select(OutreachSchedule).where(
            OutreachSchedule.company_id == company_id,
            OutreachSchedule.is_current.is_(True),
        )
    )
    sched = sched_result.scalar_one_or_none()
    if sched:
        from app.schemas.outreach_schedule import OutreachScheduleRead
        enriched["schedule"] = OutreachScheduleRead.model_validate(sched).model_dump()

    # Outreach events (newest first)
    events_result = await db.execute(
        select(OutreachEvent)
        .where(OutreachEvent.company_id == company_id)
        .order_by(OutreachEvent.occurred_on.desc(), OutreachEvent.id.desc())
    )
    from app.schemas.outreach_event import OutreachEventRead
    enriched["events"] = [
        OutreachEventRead.model_validate(e).model_dump() for e in events_result.scalars().all()
    ]

    # Cross-mandate duplicate warnings
    enriched["duplicate_warnings"] = await find_duplicates(
        db,
        firm_id=current_user.firm_id,
        mandate_id=company.mandate_id,
        company_name=company.company_name,
        website=company.website,
    )

    return enriched


@router.patch("/{company_id}")
async def update_company(
    company_id: int,
    body: CompanyUpdate,
    db: SessionDep,
    current_user: CurrentUser,
):
    visible = await visible_mandate_ids(current_user, db)
    q = select(Company).where(
        Company.id == company_id,
        Company.firm_id == current_user.firm_id,
    )
    if visible is not None:
        q = q.where(Company.mandate_id.in_(visible))

    result = await db.execute(q)
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    updates = body.model_dump(exclude_unset=True)

    # Classification: keep category_id (truth) and the legacy category cache consistent.
    if "category_id" in updates:
        cid, legacy = await _resolve_category(
            db, current_user.firm_id, updates.pop("category_id"), None
        )
        company.category_id = cid
        company.category = legacy
        updates.pop("category", None)  # derived cache wins over a stale enum
    elif "category" in updates:
        cid, _ = await _resolve_category(db, current_user.firm_id, None, updates["category"])
        company.category_id = cid
    if "sourcing_layer_id" in updates:
        await _validate_sourcing_layer(
            db, current_user.firm_id, company.mandate_id, updates["sourcing_layer_id"]
        )

    for field, val in updates.items():
        setattr(company, field, val)

    # Static-fact edits write the SHARED profile, then propagate to every engagement
    # that references it (Req A: a colleague's revenue update shows everywhere, §8-A).
    if any(f in updates for f in STATIC_FACT_FIELDS):
        facts = {f: getattr(company, f) for f in STATIC_FACT_FIELDS}
        profile = await upsert_profile(db, current_user.firm_id, facts, enrich=True)
        company.profile_id = profile.id
        await db.flush()
        await propagate_profile_to_companies(db, profile)

    # Stop schedule if status changed to RESPONDED/BOUNCED/DECLINED (C-03 + E-04)
    if "status" in updates and updates["status"] in STOP_STATUSES:
        sched_result = await db.execute(
            select(OutreachSchedule).where(
                OutreachSchedule.company_id == company_id,
                OutreachSchedule.is_current.is_(True),
            )
        )
        sched = sched_result.scalar_one_or_none()
        if sched and sched.status == ScheduleStatus.ACTIVE:
            sched.status = ScheduleStatus.STOPPED
            sched.stopped_reason = StoppedReason[updates["status"].value]
            sched.stopped_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(company)
    return await _enrich_company(db, company)


@router.delete("/{company_id}", status_code=status.HTTP_200_OK)
async def archive_company(company_id: int, db: SessionDep, current_user: CurrentUser):
    """Soft-delete — sets archived_at. History is preserved."""
    visible = await visible_mandate_ids(current_user, db)
    q = select(Company).where(
        Company.id == company_id,
        Company.firm_id == current_user.firm_id,
    )
    if visible is not None:
        q = q.where(Company.mandate_id.in_(visible))

    result = await db.execute(q)
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    company.archived_at = datetime.now(timezone.utc)
    await db.commit()
    return {"detail": "Company archived"}


@router.post("/{company_id}/unarchive", status_code=status.HTTP_200_OK)
async def unarchive_company(company_id: int, db: SessionDep, current_user: CurrentUser):
    """Restore a soft-deleted company (clears archived_at)."""
    company = await _get_visible_company(company_id, db, current_user, include_archived=True)
    company.archived_at = None
    await db.commit()
    await db.refresh(company)
    return await _enrich_company(db, company)


# ── Schedule sub-resource ─────────────────────────────────────────────────────


async def _get_visible_company(
    company_id: int, db, current_user, include_archived: bool = False
):
    visible = await visible_mandate_ids(current_user, db)
    q = select(Company).where(
        Company.id == company_id,
        Company.firm_id == current_user.firm_id,
    )
    if not include_archived:
        q = q.where(Company.archived_at.is_(None))
    if visible is not None:
        q = q.where(Company.mandate_id.in_(visible))
    result = await db.execute(q)
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.get("/{company_id}/schedule")
async def get_schedule(company_id: int, db: SessionDep, current_user: CurrentUser):
    await _get_visible_company(company_id, db, current_user)
    sched_result = await db.execute(
        select(OutreachSchedule).where(
            OutreachSchedule.company_id == company_id,
            OutreachSchedule.is_current.is_(True),
        )
    )
    sched = sched_result.scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    fu = await get_followups_done(db, sched.id)
    cadence = compute_cadence(sched, fu)
    from app.schemas.outreach_schedule import OutreachScheduleRead
    base = OutreachScheduleRead.model_validate(sched).model_dump()
    base.update(cadence)
    return base


@router.patch("/{company_id}/schedule")
async def update_schedule(
    company_id: int,
    body: OutreachScheduleUpdate,
    db: SessionDep,
    current_user: CurrentUser,
    action: str | None = Query(default=None, description="pause | resume"),
):
    await _get_visible_company(company_id, db, current_user)
    sched_result = await db.execute(
        select(OutreachSchedule).where(
            OutreachSchedule.company_id == company_id,
            OutreachSchedule.is_current.is_(True),
        )
    )
    sched = sched_result.scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")

    updates = body.model_dump(exclude_unset=True)
    for field, val in updates.items():
        setattr(sched, field, val)

    if action == "pause":
        await pause_schedule(db, sched)
    elif action == "resume":
        await resume_schedule(db, sched)

    await db.commit()
    await db.refresh(sched)
    fu = await get_followups_done(db, sched.id)
    cadence = compute_cadence(sched, fu)
    from app.schemas.outreach_schedule import OutreachScheduleRead
    base = OutreachScheduleRead.model_validate(sched).model_dump()
    base.update(cadence)
    return base


# ── Events sub-resource ───────────────────────────────────────────────────────


@router.get("/{company_id}/events")
async def get_events(company_id: int, db: SessionDep, current_user: CurrentUser):
    await _get_visible_company(company_id, db, current_user, include_archived=True)
    result = await db.execute(
        select(OutreachEvent)
        .where(OutreachEvent.company_id == company_id)
        .order_by(OutreachEvent.occurred_on.desc(), OutreachEvent.id.desc())
    )
    from app.schemas.outreach_event import OutreachEventRead
    return [OutreachEventRead.model_validate(e).model_dump() for e in result.scalars().all()]


async def _resolve_touch_contact(db, company: Company, firm_id: int, body) -> Contact | None:
    """Return the contact this touch is against — an existing one (by id / email / name)
    or a newly-created inline contact (§8-B). Enriches identity fields on a match."""
    if body.contact_id:
        return (
            await db.execute(
                select(Contact).where(
                    Contact.id == body.contact_id, Contact.firm_id == firm_id
                )
            )
        ).scalar_one_or_none()

    nc = getattr(body, "new_contact", None)
    if not nc or not nc.contact_person or not nc.contact_person.strip():
        return None

    existing: Contact | None = None
    if nc.email:
        existing = (
            await db.execute(
                select(Contact).where(
                    Contact.company_id == company.id,
                    Contact.email == nc.email,
                    Contact.archived_at.is_(None),
                )
            )
        ).scalar_one_or_none()
    if existing is None:
        existing = (
            await db.execute(
                select(Contact).where(
                    Contact.company_id == company.id,
                    Contact.contact_person == nc.contact_person.strip(),
                    Contact.archived_at.is_(None),
                )
            )
        ).scalar_one_or_none()

    if existing is not None:
        for f in ("designation", "email", "phone", "linkedin"):
            v = getattr(nc, f, None)
            if v and not getattr(existing, f):
                setattr(existing, f, v)
        return existing

    has_primary = (
        await db.execute(
            select(Contact.id).where(
                Contact.company_id == company.id,
                Contact.is_primary.is_(True),
                Contact.archived_at.is_(None),
            )
        )
    ).first() is not None
    contact = Contact(
        firm_id=firm_id,
        company_id=company.id,
        contact_person=nc.contact_person.strip(),
        designation=nc.designation,
        email=nc.email,
        phone=nc.phone,
        linkedin=nc.linkedin,
        is_primary=not has_primary,
    )
    db.add(contact)
    await db.flush()
    return contact


def _refresh_contact_cache(contact: Contact, body) -> None:
    """Refresh a contact's latest-touch cache from an event (§8-B). The event stays the
    source of truth; these columns just let the Contact List render without a join."""
    if body.mode is not None:
        contact.mode = body.mode
    if body.sentiment is not None:
        contact.sentiment = body.sentiment
    if body.engagement is not None:
        contact.engagement = body.engagement
    if body.regarding:
        contact.reason = body.regarding
    contact.date_connected = body.occurred_on
    if body.notes:
        contact.comments = (contact.comments + "\n" if contact.comments else "") + body.notes
    if contact.last_contact_date is None or body.occurred_on > contact.last_contact_date:
        contact.last_contact_date = body.occurred_on


@router.post("/{company_id}/events", status_code=status.HTTP_201_CREATED)
async def log_event(
    company_id: int,
    body: "EventCreate",
    db: SessionDep,
    current_user: CurrentUser,
):
    company = await _get_visible_company(company_id, db, current_user)

    # Always operate on the CURRENT cycle (A1 site 6 — highest risk)
    sched_result = await db.execute(
        select(OutreachSchedule).where(
            OutreachSchedule.company_id == company_id,
            OutreachSchedule.is_current.is_(True),
        )
    )
    sched = sched_result.scalar_one_or_none()

    # Capture *who* the touch is against (existing or inline new contact) — §8-B.
    contact = await _resolve_touch_contact(db, company, current_user.firm_id, body)

    event = OutreachEvent(
        firm_id=current_user.firm_id,
        company_id=company_id,
        schedule_id=sched.id if sched else None,
        contact_id=contact.id if contact else None,
        event_type=body.event_type,
        occurred_on=body.occurred_on,
        regarding=body.regarding,
        notes=body.notes,
        mode=body.mode,
        sentiment=body.sentiment,
        owner_id=current_user.id,
    )
    db.add(event)

    # INITIAL_EMAIL → activate schedule (E-01)
    if body.event_type == OutreachEventType.INITIAL_EMAIL and sched:
        await activate_schedule(db, sched, body.occurred_on)

    # RESPONSE / BOUNCE → stop the cadence (status is set by recompute_status below).
    if body.event_type in EVENT_STOP_MAP and sched:
        await stop_schedule(db, sched, EVENT_STOP_MAP[body.event_type])

    # RESPONSE → auto-advance the company's sourcing candidate to Engaged (§3.1 hook).
    if body.event_type == OutreachEventType.RESPONSE:
        from app.services.sourcing import advance_candidate_to_engaged

        await advance_candidate_to_engaged(db, company)

    # FOLLOW_UP → check cap; if exhausted, stop with EXHAUSTED (Slice 2)
    if body.event_type == OutreachEventType.FOLLOW_UP and sched and sched.status == ScheduleStatus.ACTIVE:
        await db.flush()  # ensure the new event is counted
        fu_done = await get_followups_done(db, sched.id)
        from app.models.firm import Firm as _Firm
        firm_result = await db.execute(select(_Firm).where(_Firm.id == current_user.firm_id))
        firm_obj = firm_result.scalar_one()
        mandate_result = await db.execute(select(Mandate).where(Mandate.id == company.mandate_id))
        mandate_obj = mandate_result.scalar_one()
        cap = effective_cap(firm_obj, mandate_obj)
        if fu_done >= cap and company.status not in STOP_STATUSES:
            await stop_schedule(db, sched, StoppedReason.EXHAUSTED)

    # Single-writer status projection (BUG-1) — never writes COLD (derived).
    await db.flush()
    await recompute_status(db, company)

    # Refresh the contact's latest-touch cache from this event (§8-B).
    if contact:
        _refresh_contact_cache(contact, body)

    await db.flush()
    await db.commit()

    from app.schemas.outreach_event import OutreachEventRead
    return OutreachEventRead.model_validate(event).model_dump()


# Forward-ref for the event body — defined here to avoid circular imports
from pydantic import BaseModel as _BaseModel
from datetime import date as _date
from app.models.enums import OutreachEventType as _EventType


class EventContactPayload(_BaseModel):
    contact_person: str
    designation: str | None = None
    email: str | None = None
    phone: str | None = None
    linkedin: str | None = None


class EventCreate(_BaseModel):
    event_type: _EventType
    occurred_on: _date
    contact_id: int | None = None
    regarding: str | None = None
    notes: str | None = None
    # Per-touch context (§8-B) — the event is the source of truth.
    mode: ContactMode | None = None
    sentiment: Sentiment | None = None
    engagement: Engagement | None = None
    # Optional inline contact to capture *who* responded (create or match by email/name).
    new_contact: EventContactPayload | None = None


class RestartBody(_BaseModel):
    contact_id: int | None = None


# ── Benchmark ─────────────────────────────────────────────────────────────────

@router.get("/{company_id}/benchmark")
async def get_benchmark(company_id: int, db: SessionDep, current_user: CurrentUser):
    """§5.4 mandate comparison — mandate avg vs this company."""
    from app.services.benchmark import get_benchmark as _get_benchmark
    await _get_visible_company(company_id, db, current_user, include_archived=True)
    return await _get_benchmark(db, company_id, current_user.firm_id)


# ── Cycle management (Slice 2) ────────────────────────────────────────────────


@router.get("/{company_id}/cycles")
async def get_cycles(company_id: int, db: SessionDep, current_user: CurrentUser):
    """All cadence cycles for this company — current + historical."""
    await _get_visible_company(company_id, db, current_user, include_archived=True)
    result = await db.execute(
        select(OutreachSchedule)
        .where(OutreachSchedule.company_id == company_id)
        .order_by(OutreachSchedule.cycle_number)
    )
    cycles = result.scalars().all()
    items = []
    for sched in cycles:
        fu = await get_followups_done(db, sched.id)
        cadence = compute_cadence(sched, fu)
        from app.schemas.outreach_schedule import OutreachScheduleRead
        base = OutreachScheduleRead.model_validate(sched).model_dump()
        base.update(cadence)
        items.append(base)
    return {"items": items, "total": len(items)}


@router.post("/{company_id}/restart", status_code=status.HTTP_201_CREATED)
async def restart_company_cycle(
    company_id: int,
    body: RestartBody,
    db: SessionDep,
    current_user: CurrentUser,
):
    """Start a new cadence cycle (swap contact + fresh AWAITING_INITIAL anchor).

    The current cycle must be STOPPED (typically EXHAUSTED). Past events are
    preserved; a NOTE event is appended to record the restart.
    """
    company = await _get_visible_company(company_id, db, current_user)
    new_sched = await restart_cycle(
        db,
        company=company,
        new_contact_id=body.contact_id,
        owner_id=current_user.id,
    )
    await db.commit()
    await db.refresh(new_sched)

    fu = await get_followups_done(db, new_sched.id)
    cadence = compute_cadence(new_sched, fu)
    from app.schemas.outreach_schedule import OutreachScheduleRead
    base = OutreachScheduleRead.model_validate(new_sched).model_dump()
    base.update(cadence)
    return base
