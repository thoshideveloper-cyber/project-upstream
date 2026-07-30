"""Sourcing service — the funnel (stages + candidates) and the shared push code path.

Home for:
  - the firm-wide funnel-stage vocabulary (seed + invariants),
  - creating per-mandate *placements* from pool profiles (the one code path reused by
    ``/companies`` create, the Active-outreach stage transition, and ``/sourcing/push``),
  - applying stage-transition side-effects (SOURCING_LAYER_PLAN §3.1).

Cadence stays separate and authoritative — the funnel stage never recomputes the clock;
it only *triggers* the same cadence primitives (``activate_schedule``/``stop_schedule``).
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import today_ist
from app.models.company import Company
from app.models.company_profile import CompanyProfile
from app.models.enums import (
    CompanyType,
    MandateType,
    OutreachEventType,
    ScheduleStatus,
    SourcingStageKind,
    StoppedReason,
)
from app.models.mandate import Mandate
from app.models.outreach_event import OutreachEvent
from app.models.outreach_schedule import OutreachSchedule
from app.models.sourcing_candidate import SourcingCandidate
from app.models.sourcing_stage import SourcingStage
from app.services.cadence import stop_schedule
from app.services.profiles import STATIC_FACT_FIELDS, sync_company_from_profile, upsert_profile

# Which counterparty a company represents is DERIVED from the engagement side (BUG-7):
# a sell-side deal sources buyers, a buy-side deal sources targets, a raise sources
# investors. Shared here so the /companies create path and the push path never drift.
_TYPE_BY_MANDATE_TYPE: dict[MandateType, CompanyType] = {
    MandateType.SELL_SIDE: CompanyType.BUYER,
    MandateType.BUY_SIDE: CompanyType.TARGET,
    MandateType.CAPITAL_RAISE: CompanyType.INVESTOR,
}

# Default ordered funnel (SOURCING_LAYER_PLAN §1.1): (name, kind, sort_order).
DEFAULT_STAGES: list[tuple[str, SourcingStageKind, int]] = [
    ("Research / Long-list", SourcingStageKind.RESEARCH, 10),
    ("Shortlisted", SourcingStageKind.SHORTLIST, 20),
    ("Active outreach", SourcingStageKind.ACTIVE, 30),
    ("Engaged", SourcingStageKind.ENGAGED, 40),
    ("Passed", SourcingStageKind.PASSED, 50),
]


# ── Stage vocabulary ──────────────────────────────────────────────────────────


async def seed_firm_stages(db: AsyncSession, firm_id: int) -> list[SourcingStage]:
    """Idempotently seed the default funnel stages for a firm. Safe to call repeatedly."""
    existing = await db.execute(
        select(SourcingStage.kind).where(
            SourcingStage.firm_id == firm_id,
            SourcingStage.archived_at.is_(None),
        )
    )
    existing_kinds = {row[0] for row in existing.all()}
    for name, kind, sort_order in DEFAULT_STAGES:
        # Seed a behavioural (non-CUSTOM) stage only if that kind is absent.
        if kind in existing_kinds:
            continue
        db.add(
            SourcingStage(firm_id=firm_id, name=name, kind=kind, sort_order=sort_order)
        )
    await db.flush()
    return await get_firm_stages(db, firm_id)


async def get_firm_stages(db: AsyncSession, firm_id: int) -> list[SourcingStage]:
    """Ordered, non-archived stages for a firm (self-seeds when empty)."""
    stmt = (
        select(SourcingStage)
        .where(SourcingStage.firm_id == firm_id, SourcingStage.archived_at.is_(None))
        .order_by(SourcingStage.sort_order, SourcingStage.id)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    if not rows:
        await seed_firm_stages(db, firm_id)
        rows = list((await db.execute(stmt)).scalars().all())
    return rows


def first_stage_of_kind(
    stages: list[SourcingStage], kind: SourcingStageKind
) -> SourcingStage | None:
    for s in stages:
        if s.kind == kind:
            return s
    return None


def validate_stage_invariants(stages: list[SourcingStage]) -> None:
    """Enforce the stage-behaviour invariants (SOURCING_LAYER_PLAN §2.1):
    ≤1 ACTIVE-kind stage, exactly 1 PASSED terminal, and RESEARCH/SHORTLIST must
    sort before ACTIVE. ``stages`` is the *post-change* non-archived set.
    """
    actives = [s for s in stages if s.kind == SourcingStageKind.ACTIVE]
    passeds = [s for s in stages if s.kind == SourcingStageKind.PASSED]
    if len(actives) > 1:
        raise HTTPException(422, "Only one ACTIVE-kind stage is allowed (the push transition).")
    if len(passeds) != 1:
        raise HTTPException(422, "Exactly one PASSED (terminal) stage is required.")
    if actives:
        active_order = actives[0].sort_order
        for s in stages:
            if s.kind in (SourcingStageKind.RESEARCH, SourcingStageKind.SHORTLIST):
                if s.sort_order >= active_order:
                    raise HTTPException(
                        422,
                        "RESEARCH/SHORTLIST stages must sort before the ACTIVE stage.",
                    )


# ── Placement creation (the one shared code path) ─────────────────────────────


async def create_placement(
    db: AsyncSession,
    *,
    firm_id: int,
    mandate: Mandate,
    profile: CompanyProfile,
    actor_id: int | None,
    rationale: str | None = None,
) -> Company:
    """Create a per-mandate ``companies`` placement from a pool profile + its cycle-1
    ``AWAITING_INITIAL`` schedule. Type is derived from the mandate side; static facts
    are synced from the shared profile (no re-typing). Does NOT commit.
    """
    company = Company(
        firm_id=firm_id,
        mandate_id=mandate.id,
        profile_id=profile.id,
        company_name=profile.company_name,
        type=_TYPE_BY_MANDATE_TYPE.get(mandate.type, CompanyType.TARGET),
        rationale=rationale,
        created_by_id=actor_id,
    )
    sync_company_from_profile(company, profile)
    db.add(company)
    await db.flush()

    schedule = OutreachSchedule(
        firm_id=firm_id,
        company_id=company.id,
        status=ScheduleStatus.AWAITING_INITIAL,
        cycle_number=1,
        is_current=True,
    )
    db.add(schedule)
    await db.flush()
    return company


async def get_or_create_candidate(
    db: AsyncSession,
    *,
    firm_id: int,
    mandate_id: int,
    profile_id: int,
    stage: SourcingStage,
    actor_id: int | None,
) -> tuple[SourcingCandidate, bool]:
    """Find-or-create the (mandate × profile) candidate row. Returns (candidate, created).

    A newly created row lands at ``stage``; an existing row is returned untouched (the
    caller decides whether to advance it). Unique (mandate_id, profile_id) backstops
    duplicates at the DB.
    """
    existing = (
        await db.execute(
            select(SourcingCandidate).where(
                SourcingCandidate.mandate_id == mandate_id,
                SourcingCandidate.profile_id == profile_id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        if existing.archived_at is not None:
            existing.archived_at = None
        return existing, False
    candidate = SourcingCandidate(
        firm_id=firm_id,
        mandate_id=mandate_id,
        profile_id=profile_id,
        stage_id=stage.id,
        added_by_id=actor_id,
    )
    db.add(candidate)
    await db.flush()
    return candidate, True


async def materialise_candidate(
    db: AsyncSession,
    *,
    candidate: SourcingCandidate,
    active_stage: SourcingStage,
    actor_id: int | None,
) -> Company:
    """Materialise a candidate into a placement (the Active-outreach transition).

    Idempotent: if the candidate already has a live placement it is returned as-is
    (surfacing, never duplicating). Sets ``candidate.company_id`` and stage=ACTIVE.
    """
    if candidate.company_id is not None:
        existing = (
            await db.execute(
                select(Company).where(
                    Company.id == candidate.company_id,
                    Company.archived_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            candidate.stage_id = active_stage.id
            return existing

    mandate = (
        await db.execute(select(Mandate).where(Mandate.id == candidate.mandate_id))
    ).scalar_one()
    profile = (
        await db.execute(
            select(CompanyProfile).where(CompanyProfile.id == candidate.profile_id)
        )
    ).scalar_one()

    company = await create_placement(
        db,
        firm_id=candidate.firm_id,
        mandate=mandate,
        profile=profile,
        actor_id=actor_id,
    )
    candidate.company_id = company.id
    candidate.stage_id = active_stage.id
    return company


# ── Stage transitions ─────────────────────────────────────────────────────────


async def apply_stage_transition(
    db: AsyncSession,
    *,
    candidate: SourcingCandidate,
    target_stage: SourcingStage,
    stages: list[SourcingStage],
    actor_id: int,
) -> dict:
    """Apply a stage change plus its server-computed side-effects (§3.1).

    Returns a dict of flags for the UI (``prompt_log_initial``, ``stopped_cadence``).
    Cadence stays authoritative — this only triggers the shared primitives.
    """
    result: dict = {"prompt_log_initial": False, "stopped_cadence": False}
    kind = target_stage.kind

    if kind == SourcingStageKind.ACTIVE:
        # This IS the push: materialise a placement + cycle-1 AWAITING_INITIAL schedule.
        newly = candidate.company_id is None
        await materialise_candidate(
            db, candidate=candidate, active_stage=target_stage, actor_id=actor_id
        )
        result["prompt_log_initial"] = newly
        return result

    # All other kinds: a plain candidate position update…
    candidate.stage_id = target_stage.id

    if kind == SourcingStageKind.PASSED and candidate.company_id is not None:
        # …with an offered cadence stop for a live placement (never deletes history).
        sched = (
            await db.execute(
                select(OutreachSchedule).where(
                    OutreachSchedule.company_id == candidate.company_id,
                    OutreachSchedule.is_current.is_(True),
                )
            )
        ).scalar_one_or_none()
        if sched and sched.status == ScheduleStatus.ACTIVE:
            await stop_schedule(db, sched, StoppedReason.MANUAL)
            db.add(
                OutreachEvent(
                    firm_id=candidate.firm_id,
                    company_id=candidate.company_id,
                    schedule_id=sched.id,
                    event_type=OutreachEventType.NOTE,
                    occurred_on=today_ist(),
                    notes="Candidate marked Passed — cadence stopped (manual).",
                    owner_id=actor_id,
                )
            )
            result["stopped_cadence"] = True

    return result


async def push_to_mandate(
    db: AsyncSession,
    *,
    firm_id: int,
    profile: CompanyProfile,
    mandate: Mandate,
    actor_id: int,
) -> dict:
    """The one "Push to Project + Side" code path (§3.4).

    Materialises the (mandate × profile) candidate into a placement at the Active stage
    (+ cycle-1 AWAITING_INITIAL schedule), idempotently. Returns the company, whether it
    was already present (surfaced, never duplicated), and ``prompt_log_initial``.
    """
    stages = await get_firm_stages(db, firm_id)
    active = first_stage_of_kind(stages, SourcingStageKind.ACTIVE)
    if active is None:
        raise HTTPException(500, "No ACTIVE-kind stage configured for this firm")

    candidate, _ = await get_or_create_candidate(
        db,
        firm_id=firm_id,
        mandate_id=mandate.id,
        profile_id=profile.id,
        stage=active,
        actor_id=actor_id,
    )
    already_present = False
    if candidate.company_id is not None:
        existing = (
            await db.execute(
                select(Company).where(
                    Company.id == candidate.company_id, Company.archived_at.is_(None)
                )
            )
        ).scalar_one_or_none()
        already_present = existing is not None

    company = await materialise_candidate(
        db, candidate=candidate, active_stage=active, actor_id=actor_id
    )
    return {
        "company": company,
        "candidate": candidate,
        "already_present": already_present,
        "prompt_log_initial": not already_present,
    }


async def build_warm_history(
    db: AsyncSession,
    *,
    firm_id: int,
    profile_ids: list[int],
    visible: list[int] | None,
) -> dict[int, list[dict]]:
    """Batched warm history for a page of pool profiles (resolves review #4).

    Keyed off ``profile_id`` (a single grouped query over placements), NOT per-row
    ``find_duplicates``. The *existence* of prior work is firm-wide (the point of a
    shared pool); per-touch detail (client / POC / sentiment / date) is shown only for
    **visible** mandates — otherwise a muted "worked by another team" with no details.
    """
    from app.models.contact import Contact

    if not profile_ids:
        return {}

    companies = list(
        (
            await db.execute(
                select(Company).where(
                    Company.firm_id == firm_id,
                    Company.profile_id.in_(profile_ids),
                    Company.archived_at.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )
    if not companies:
        return {}

    mandate_ids = {c.mandate_id for c in companies}
    mandates = {
        m.id: m
        for m in (
            await db.execute(select(Mandate).where(Mandate.id.in_(mandate_ids)))
        ).scalars().all()
    }

    def _visible(mandate_id: int) -> bool:
        return visible is None or mandate_id in visible

    visible_company_ids = [c.id for c in companies if _visible(c.mandate_id)]

    # Latest event per visible company (batched); primary contact (batched).
    latest_event: dict[int, OutreachEvent] = {}
    poc_by_company: dict[int, str] = {}
    if visible_company_ids:
        events = (
            await db.execute(
                select(OutreachEvent)
                .where(OutreachEvent.company_id.in_(visible_company_ids))
                .order_by(OutreachEvent.occurred_on.desc(), OutreachEvent.id.desc())
            )
        ).scalars().all()
        for e in events:
            latest_event.setdefault(e.company_id, e)
        contacts = (
            await db.execute(
                select(Contact).where(
                    Contact.company_id.in_(visible_company_ids),
                    Contact.is_primary.is_(True),
                    Contact.archived_at.is_(None),
                )
            )
        ).scalars().all()
        for c in contacts:
            poc_by_company.setdefault(c.company_id, c.contact_person)

    result: dict[int, list[dict]] = {}
    for c in companies:
        vis = _visible(c.mandate_id)
        m = mandates.get(c.mandate_id)
        if vis:
            ev = latest_event.get(c.id)
            entry = {
                "mandate_id": c.mandate_id,
                "mandate_name": m.name if m else None,
                "client_name": m.client_name if m else None,
                "visible": True,
                "status": c.status.value if c.status else None,
                "poc": poc_by_company.get(c.id),
                "sentiment": ev.sentiment.value if ev and ev.sentiment else None,
                "last_touch": ev.occurred_on.isoformat() if ev and ev.occurred_on else None,
            }
        else:
            entry = {
                "mandate_id": None,
                "mandate_name": None,
                "client_name": None,
                "visible": False,
                "status": None,
                "poc": None,
                "sentiment": None,
                "last_touch": None,
            }
        result.setdefault(c.profile_id, []).append(entry)
    return result


async def advance_candidate_to_engaged(db: AsyncSession, company: Company) -> None:
    """Auto-advance a company's candidate to the ENGAGED stage when a RESPONSE is logged
    (hook from ``log_event``). No-op if there is no candidate or it is already terminal.
    """
    candidate = (
        await db.execute(
            select(SourcingCandidate).where(
                SourcingCandidate.company_id == company.id,
                SourcingCandidate.archived_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if candidate is None:
        return
    stages = await get_firm_stages(db, company.firm_id)
    engaged = first_stage_of_kind(stages, SourcingStageKind.ENGAGED)
    if engaged is None:
        return
    current = next((s for s in stages if s.id == candidate.stage_id), None)
    # Don't override a terminal Passed with an auto-advance.
    if current is not None and current.kind == SourcingStageKind.PASSED:
        return
    candidate.stage_id = engaged.id


__all__ = [
    "_TYPE_BY_MANDATE_TYPE",
    "DEFAULT_STAGES",
    "seed_firm_stages",
    "get_firm_stages",
    "first_stage_of_kind",
    "validate_stage_invariants",
    "create_placement",
    "get_or_create_candidate",
    "materialise_candidate",
    "apply_stage_transition",
    "advance_candidate_to_engaged",
    "build_warm_history",
    "push_to_mandate",
]
