"""Analytics queries — overview, response-by-bucket, by-analyst, sources (A-01/A-02)."""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import today_ist
from app.models.company import Company
from app.models.company_category import CompanyCategoryVocab
from app.models.enums import (
    CompanyStatus,
    OutreachEventType,
    ScheduleStatus,
    Source,
    SourceQuality,
)
from app.models.outreach_event import OutreachEvent
from app.models.outreach_schedule import OutreachSchedule
from app.models.sourcing_layer import SourcingLayer
from app.models.user import User

# "Responded" is defined once and reused everywhere (§5.4):
# company.status == RESPONDED OR a RESPONSE event exists for the company.
# For aggregate queries we use status == RESPONDED (single source of truth since
# POST /events sets the status on RESPONSE — they stay in sync).
RESPONDED_STATUS = CompanyStatus.RESPONDED


async def get_overview(
    db: AsyncSession,
    firm_id: int,
    mandate_ids: list[int] | None,
) -> dict:
    """Counts by status/type, % responded, due-this-week, overdue, needs-initial."""
    base = select(Company).where(
        Company.firm_id == firm_id,
        Company.archived_at.is_(None),
    )
    if mandate_ids is not None:
        base = base.where(Company.mandate_id.in_(mandate_ids))

    result = await db.execute(base)
    companies = result.scalars().all()

    total = len(companies)
    by_status: dict[str, int] = {}
    for c in companies:
        key = c.status.value
        by_status[key] = by_status.get(key, 0) + 1

    responded = by_status.get(RESPONDED_STATUS.value, 0)
    bounced = by_status.get(CompanyStatus.BOUNCED.value, 0)
    responded_pct = round(responded / total, 4) if total else 0.0

    # Schedule-based counts: query schedules for these companies
    company_ids = [c.id for c in companies]
    if not company_ids:
        return {
            "total": 0,
            "by_status": by_status,
            "responded_pct": 0.0,
            "responded": 0,
            "bounced": 0,
            "emails_sent": 0,
            "due_this_week": 0,
            "overdue": 0,
            "needs_initial": 0,
            "active_mandates": 0,
        }

    # Total emails sent = INITIAL_EMAIL + FOLLOW_UP across the scoped companies.
    emails_sent = (
        await db.execute(
            select(func.count(OutreachEvent.id)).where(
                OutreachEvent.company_id.in_(company_ids),
                OutreachEvent.event_type.in_(
                    [OutreachEventType.INITIAL_EMAIL, OutreachEventType.FOLLOW_UP]
                ),
            )
        )
    ).scalar() or 0

    # A3: filter to current cycle only to avoid double-counting restarted companies
    sched_result = await db.execute(
        select(OutreachSchedule).where(
            OutreachSchedule.company_id.in_(company_ids),
            OutreachSchedule.is_current.is_(True),
        )
    )
    schedules = sched_result.scalars().all()

    today = today_ist()
    window_end = today + timedelta(days=7)

    needs_initial = sum(1 for s in schedules if s.status == ScheduleStatus.AWAITING_INITIAL)
    overdue = 0
    due_this_week = 0
    for s in schedules:
        if s.status != ScheduleStatus.ACTIVE or s.initial_date is None:
            continue
        # Count follow-ups done: requires event query per schedule — use schedule.id
        # We approximate by computing from events later; for now just use schedule data
        # Since followups_done requires event count, we skip the exact math and delegate
        # to the cadence service. Instead compute from a simpler approach:
        # next_due = initial_date + (fu+1) * interval — we precompute below.
        pass

    # Batch: count follow-ups per schedule_id from events table
    fu_result = await db.execute(
        select(
            OutreachEvent.schedule_id,
            func.count(OutreachEvent.id).label("cnt"),
        )
        .where(
            OutreachEvent.schedule_id.in_([s.id for s in schedules if s.id]),
            OutreachEvent.event_type == OutreachEventType.FOLLOW_UP,
        )
        .group_by(OutreachEvent.schedule_id)
    )
    fu_by_sched = {row.schedule_id: row.cnt for row in fu_result.all()}

    for s in schedules:
        if s.status != ScheduleStatus.ACTIVE or s.initial_date is None:
            continue
        fu_done = fu_by_sched.get(s.id, 0)
        next_due = s.initial_date + timedelta(days=(fu_done + 1) * s.cadence_interval_days)
        days_remaining = (next_due - today).days
        if days_remaining < 0:
            overdue += 1
        if days_remaining <= 7:
            due_this_week += 1

    # Active mandates (distinct mandate_ids in scope)
    active_mandate_ids = len({c.mandate_id for c in companies})

    return {
        "total": total,
        "by_status": by_status,
        "responded_pct": responded_pct,
        "responded": responded,
        "bounced": bounced,
        "emails_sent": emails_sent,
        "due_this_week": due_this_week,
        "overdue": overdue,
        "needs_initial": needs_initial,
        "active_mandates": active_mandate_ids,
    }


async def get_response_by_category(
    db: AsyncSession,
    firm_id: int,
    mandate_ids: list[int] | None,
) -> list[dict]:
    """Response rate grouped by the firm's category vocabulary (BUG-10 — Axis 1)."""
    stmt = (
        select(
            Company.category_id,
            func.count(Company.id).label("total"),
            func.sum(case((Company.status == RESPONDED_STATUS, 1), else_=0)).label("responded"),
        )
        .where(Company.firm_id == firm_id, Company.archived_at.is_(None))
        .group_by(Company.category_id)
        .order_by(func.count(Company.id).desc())
    )
    if mandate_ids is not None:
        stmt = stmt.where(Company.mandate_id.in_(mandate_ids))
    rows = (await db.execute(stmt)).all()

    cat_ids = [r.category_id for r in rows if r.category_id]
    names: dict[int, str] = {}
    if cat_ids:
        vocab = (
            await db.execute(
                select(CompanyCategoryVocab).where(CompanyCategoryVocab.id.in_(cat_ids))
            )
        ).scalars().all()
        names = {c.id: c.name for c in vocab}

    return [
        {
            "category": names.get(r.category_id, "Uncategorized"),
            "category_id": r.category_id,
            "total": r.total,
            "responded": int(r.responded or 0),
            "response_rate": round(int(r.responded or 0) / r.total, 4) if r.total else 0.0,
        }
        for r in rows
    ]


async def get_response_by_sourcing_layer(
    db: AsyncSession,
    firm_id: int,
    mandate_ids: list[int] | None,
) -> list[dict]:
    """Response rate grouped by sourcing layer (BUG-10 — Axis 2; NULL → 'Unsorted')."""
    stmt = (
        select(
            Company.sourcing_layer_id,
            func.count(Company.id).label("total"),
            func.sum(case((Company.status == RESPONDED_STATUS, 1), else_=0)).label("responded"),
        )
        .where(Company.firm_id == firm_id, Company.archived_at.is_(None))
        .group_by(Company.sourcing_layer_id)
        .order_by(func.count(Company.id).desc())
    )
    if mandate_ids is not None:
        stmt = stmt.where(Company.mandate_id.in_(mandate_ids))
    rows = (await db.execute(stmt)).all()

    layer_ids = [r.sourcing_layer_id for r in rows if r.sourcing_layer_id]
    names: dict[int, str] = {}
    if layer_ids:
        layers = (
            await db.execute(
                select(SourcingLayer).where(SourcingLayer.id.in_(layer_ids))
            )
        ).scalars().all()
        names = {layer.id: layer.name for layer in layers}

    return [
        {
            "layer": names.get(r.sourcing_layer_id, "Unsorted"),
            "sourcing_layer_id": r.sourcing_layer_id,
            "total": r.total,
            "responded": int(r.responded or 0),
            "response_rate": round(int(r.responded or 0) / r.total, 4) if r.total else 0.0,
        }
        for r in rows
    ]


async def get_response_by_bucket(
    db: AsyncSession,
    firm_id: int,
    mandate_ids: list[int] | None,
) -> list[dict]:
    """DEPRECATED alias of :func:`get_response_by_category` (BUG-10). Emits both the new
    ``category`` key and the legacy ``bucket`` key so old consumers keep working."""
    items = await get_response_by_category(db, firm_id, mandate_ids)
    return [{**it, "bucket": it["category"]} for it in items]


async def get_by_analyst(
    db: AsyncSession,
    firm_id: int,
) -> list[dict]:
    """Volume / responses / conversion per analyst (A-02). Partner-only endpoint."""
    # Count outreach events per owner within the firm
    events_stmt = (
        select(
            OutreachEvent.owner_id,
            func.count(OutreachEvent.id).label("total_events"),
            func.sum(
                case((OutreachEvent.event_type == OutreachEventType.INITIAL_EMAIL, 1), else_=0)
            ).label("initial_emails"),
            func.sum(
                case(
                    (
                        OutreachEvent.event_type.in_(
                            [OutreachEventType.INITIAL_EMAIL, OutreachEventType.FOLLOW_UP]
                        ),
                        1,
                    ),
                    else_=0,
                )
            ).label("emails_sent"),
            func.sum(
                case((OutreachEvent.event_type == OutreachEventType.RESPONSE, 1), else_=0)
            ).label("responses"),
        )
        .where(OutreachEvent.firm_id == firm_id)
        .group_by(OutreachEvent.owner_id)
    )
    events_result = await db.execute(events_stmt)
    events_by_owner = {
        row.owner_id: {
            "total_events": row.total_events,
            "initial_emails": int(row.initial_emails or 0),
            "emails_sent": int(row.emails_sent or 0),
            "responses": int(row.responses or 0),
        }
        for row in events_result.all()
    }

    # Fetch user names
    user_result = await db.execute(
        select(User).where(User.firm_id == firm_id, User.is_active.is_(True))
    )
    users = user_result.scalars().all()

    out = []
    for u in users:
        stats = events_by_owner.get(
            u.id, {"total_events": 0, "initial_emails": 0, "emails_sent": 0, "responses": 0}
        )
        total = stats["initial_emails"]
        responses = stats["responses"]
        out.append(
            {
                "user_id": u.id,
                "full_name": u.full_name,
                "role": u.role.value,
                "total_events": stats["total_events"],
                "initial_emails": total,
                "emails_sent": stats["emails_sent"],
                "responses": responses,
                "conversion_rate": round(responses / total, 4) if total else 0.0,
            }
        )
    return sorted(out, key=lambda x: x["total_events"], reverse=True)


async def get_by_engagement(
    db: AsyncSession,
    firm_id: int,
    mandate_ids: list[int] | None,
) -> list[dict]:
    """Per-engagement (mandate) rollup scoped to the caller's visibility (analyst-safe).

    Returns, for every visible engagement: company count, total emails sent
    (INITIAL_EMAIL + FOLLOW_UP), responded + bounced counts, and response rate —
    the analyst's "project-wise" view of response / bounce / volume.
    """
    from app.models.mandate import Mandate

    mstmt = select(Mandate).where(
        Mandate.firm_id == firm_id,
        Mandate.archived_at.is_(None),
    )
    if mandate_ids is not None:
        mstmt = mstmt.where(Mandate.id.in_(mandate_ids))
    mandates = (await db.execute(mstmt)).scalars().all()
    if not mandates:
        return []
    m_ids = [m.id for m in mandates]

    # Company status rollup per mandate.
    co_stmt = (
        select(
            Company.mandate_id,
            func.count(Company.id).label("total"),
            func.sum(case((Company.status == RESPONDED_STATUS, 1), else_=0)).label("responded"),
            func.sum(case((Company.status == CompanyStatus.BOUNCED, 1), else_=0)).label("bounced"),
        )
        .where(Company.mandate_id.in_(m_ids), Company.archived_at.is_(None))
        .group_by(Company.mandate_id)
    )
    co_by_mandate = {r.mandate_id: r for r in (await db.execute(co_stmt)).all()}

    # Emails sent per mandate (INITIAL + FOLLOW_UP), joined through the company.
    ev_stmt = (
        select(Company.mandate_id, func.count(OutreachEvent.id).label("sent"))
        .join(OutreachEvent, OutreachEvent.company_id == Company.id)
        .where(
            Company.mandate_id.in_(m_ids),
            Company.archived_at.is_(None),
            OutreachEvent.event_type.in_(
                [OutreachEventType.INITIAL_EMAIL, OutreachEventType.FOLLOW_UP]
            ),
        )
        .group_by(Company.mandate_id)
    )
    sent_by_mandate = {r.mandate_id: r.sent for r in (await db.execute(ev_stmt)).all()}

    out = []
    for m in mandates:
        co = co_by_mandate.get(m.id)
        total = int(co.total) if co else 0
        responded = int(co.responded or 0) if co else 0
        bounced = int(co.bounced or 0) if co else 0
        out.append(
            {
                "mandate_id": m.id,
                "name": m.name,
                "type": m.type.value,
                "total_companies": total,
                "emails_sent": int(sent_by_mandate.get(m.id, 0)),
                "responded": responded,
                "bounced": bounced,
                "response_rate": round(responded / total, 4) if total else 0.0,
            }
        )
    # Busiest engagements first.
    return sorted(out, key=lambda r: r["emails_sent"], reverse=True)


async def get_project_analytics(
    db: AsyncSession,
    firm_id: int,
) -> list[dict]:
    """Per-project + per-engagement health for the partner overview (Slice 5)."""
    from datetime import timedelta

    from app.models.enums import StoppedReason
    from app.models.mandate import Mandate
    from app.models.project import Project

    projects_result = await db.execute(
        select(Project)
        .where(
            Project.firm_id == firm_id,
            Project.archived_at.is_(None),
        )
        .order_by(Project.name)
    )
    projects = projects_result.scalars().all()
    if not projects:
        return []

    # Load all non-archived mandates for this firm
    mandates_result = await db.execute(
        select(Mandate).where(
            Mandate.firm_id == firm_id,
            Mandate.archived_at.is_(None),
        )
    )
    mandates_by_project: dict[int, list] = {}
    for m in mandates_result.scalars().all():
        if m.project_id:
            mandates_by_project.setdefault(m.project_id, []).append(m)

    async def _engagement_stats(mandate: Mandate) -> dict:
        """Compute headline stats for a single mandate."""
        co_result = await db.execute(
            select(Company).where(
                Company.mandate_id == mandate.id,
                Company.archived_at.is_(None),
            )
        )
        companies = co_result.scalars().all()
        total = len(companies)
        if total == 0:
            return {
                "id": mandate.id,
                "name": mandate.name,
                "type": mandate.type.value,
                "status": mandate.status.value,
                "total_companies": 0,
                "contacted": 0,
                "replied": 0,
                "responded": 0,
                "bounced": 0,
                "emails_sent": 0,
                "response_rate": 0.0,
                "overdue_count": 0,
                "cold_count": 0,
                "needs_initial_count": 0,
            }

        responded = sum(1 for c in companies if c.status == RESPONDED_STATUS)
        bounced = sum(1 for c in companies if c.status == CompanyStatus.BOUNCED)
        # The app-wide reply-rate denominator (lib/analytics.ts replyRate):
        # contacted = everyone we actually emailed; replied = any answer at all.
        contacted = sum(1 for c in companies if c.status != CompanyStatus.NOT_CONTACTED)
        replied = sum(
            1
            for c in companies
            if c.status
            in (CompanyStatus.RESPONDED, CompanyStatus.INTERESTED, CompanyStatus.DECLINED)
        )
        company_ids = [c.id for c in companies]

        emails_sent = (
            await db.execute(
                select(func.count(OutreachEvent.id)).where(
                    OutreachEvent.company_id.in_(company_ids),
                    OutreachEvent.event_type.in_(
                        [OutreachEventType.INITIAL_EMAIL, OutreachEventType.FOLLOW_UP]
                    ),
                )
            )
        ).scalar() or 0

        sched_result = await db.execute(
            select(OutreachSchedule).where(
                OutreachSchedule.company_id.in_(company_ids),
                OutreachSchedule.is_current.is_(True),
            )
        )
        schedules = sched_result.scalars().all()

        needs_initial = sum(1 for s in schedules if s.status == ScheduleStatus.AWAITING_INITIAL)
        cold_count = sum(
            1 for s in schedules
            if s.status == ScheduleStatus.STOPPED
            and s.stopped_reason == StoppedReason.EXHAUSTED
        )

        sched_ids = [s.id for s in schedules if s.id]
        fu_by_sched: dict[int, int] = {}
        if sched_ids:
            fu_result = await db.execute(
                select(
                    OutreachEvent.schedule_id,
                    func.count(OutreachEvent.id).label("cnt"),
                )
                .where(
                    OutreachEvent.schedule_id.in_(sched_ids),
                    OutreachEvent.event_type == OutreachEventType.FOLLOW_UP,
                )
                .group_by(OutreachEvent.schedule_id)
            )
            fu_by_sched = {row.schedule_id: row.cnt for row in fu_result.all()}

        today = today_ist()
        overdue_count = 0
        for s in schedules:
            if s.status != ScheduleStatus.ACTIVE or s.initial_date is None:
                continue
            fu_done = fu_by_sched.get(s.id, 0)
            next_due = s.initial_date + timedelta(days=(fu_done + 1) * s.cadence_interval_days)
            if (next_due - today).days < 0:
                overdue_count += 1

        return {
            "id": mandate.id,
            "name": mandate.name,
            "type": mandate.type.value,
            "status": mandate.status.value,
            "total_companies": total,
            "contacted": contacted,
            "replied": replied,
            "responded": responded,
            "bounced": bounced,
            "emails_sent": emails_sent,
            "response_rate": round(responded / total, 4) if total else 0.0,
            "overdue_count": overdue_count,
            "cold_count": cold_count,
            "needs_initial_count": needs_initial,
        }

    out = []
    for project in projects:
        mandates = mandates_by_project.get(project.id, [])
        engagements = []
        total_companies = 0
        total_contacted = 0
        total_replied = 0
        total_responded = 0
        total_bounced = 0
        total_emails_sent = 0
        total_overdue = 0
        total_cold = 0
        total_needs_initial = 0

        for mandate in mandates:
            stats = await _engagement_stats(mandate)
            engagements.append(stats)
            total_companies += stats["total_companies"]
            total_contacted += stats["contacted"]
            total_replied += stats["replied"]
            total_responded += stats["responded"]
            total_bounced += stats["bounced"]
            total_emails_sent += stats["emails_sent"]
            total_overdue += stats["overdue_count"]
            total_cold += stats["cold_count"]
            total_needs_initial += stats["needs_initial_count"]

        out.append({
            "id": project.id,
            "name": project.name,
            "client_name": project.client_name,
            "headline": {
                "total_companies": total_companies,
                "contacted": total_contacted,
                "replied": total_replied,
                "responded": total_responded,
                "bounced": total_bounced,
                "emails_sent": total_emails_sent,
                "response_rate": round(total_responded / total_companies, 4) if total_companies else 0.0,
                "overdue_count": total_overdue,
                "cold_count": total_cold,
                "needs_initial_count": total_needs_initial,
            },
            "engagements": engagements,
        })

    return out


_MONTH_ABBR = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]


async def get_timeseries(
    db: AsyncSession,
    firm_id: int,
    mandate_ids: list[int] | None,
    weeks: int = 12,
) -> list[dict]:
    """Weekly outreach volume + responses over the last ``weeks`` weeks (Mon-anchored).

    One row per week with ``sent`` (INITIAL_EMAIL + FOLLOW_UP), ``initial``, and
    ``responses``. Powers the dashboard trend/sparkline, week-over-week deltas, and the
    analytics trend chart. Visibility-scoped via ``mandate_ids``.
    """
    today = today_ist()
    monday = today - timedelta(days=today.weekday())
    start = monday - timedelta(weeks=weeks - 1)

    comp_stmt = select(Company.id).where(
        Company.firm_id == firm_id, Company.archived_at.is_(None)
    )
    if mandate_ids is not None:
        comp_stmt = comp_stmt.where(Company.mandate_id.in_(mandate_ids))
    company_ids = [r[0] for r in (await db.execute(comp_stmt)).all()]

    buckets = [{"sent": 0, "initial": 0, "responses": 0} for _ in range(weeks)]
    if company_ids:
        rows = (
            await db.execute(
                select(OutreachEvent.occurred_on, OutreachEvent.event_type).where(
                    OutreachEvent.company_id.in_(company_ids),
                    OutreachEvent.occurred_on >= start,
                    OutreachEvent.occurred_on <= today,
                    OutreachEvent.event_type.in_(
                        [
                            OutreachEventType.INITIAL_EMAIL,
                            OutreachEventType.FOLLOW_UP,
                            OutreachEventType.RESPONSE,
                        ]
                    ),
                )
            )
        ).all()
        for occurred_on, event_type in rows:
            widx = (occurred_on - start).days // 7
            if widx < 0 or widx >= weeks:
                continue
            b = buckets[widx]
            if event_type in (OutreachEventType.INITIAL_EMAIL, OutreachEventType.FOLLOW_UP):
                b["sent"] += 1
            if event_type == OutreachEventType.INITIAL_EMAIL:
                b["initial"] += 1
            if event_type == OutreachEventType.RESPONSE:
                b["responses"] += 1

    out = []
    for i in range(weeks):
        ws = start + timedelta(weeks=i)
        out.append(
            {
                "week_start": ws.isoformat(),
                "label": f"{ws.day} {_MONTH_ABBR[ws.month - 1]}",
                **buckets[i],
            }
        )
    return out


async def get_sources(
    db: AsyncSession,
    firm_id: int,
    mandate_ids: list[int] | None,
) -> list[dict]:
    """Counts + response rate by source / source_quality."""
    stmt = (
        select(
            Company.source,
            Company.source_quality,
            func.count(Company.id).label("total"),
            func.sum(
                case((Company.status == RESPONDED_STATUS, 1), else_=0)
            ).label("responded"),
        )
        .where(
            Company.firm_id == firm_id,
            Company.archived_at.is_(None),
        )
        .group_by(Company.source, Company.source_quality)
        .order_by(Company.source, Company.source_quality)
    )
    if mandate_ids is not None:
        stmt = stmt.where(Company.mandate_id.in_(mandate_ids))

    result = await db.execute(stmt)
    rows = result.all()

    return [
        {
            "source": row.source.value if row.source else None,
            "source_quality": row.source_quality.value if row.source_quality else None,
            "total": row.total,
            "responded": int(row.responded or 0),
            "response_rate": round(int(row.responded or 0) / row.total, 4) if row.total else 0.0,
        }
        for row in rows
    ]


# ── Response latency (reply-timing) ───────────────────────────────────────────
# Generalises the per-company dossier BenchmarkStrip (avg touches / days to
# response, services/benchmark.py) into a firm/analyst-wide distribution:
# how long, and how many touches, it takes to earn a reply. Current-cycle only
# (A2), visibility-scoped, denominators always returned so callers never dress a
# tiny sample as signal.

_DAY_BUCKETS: list[tuple[str, int, int | None]] = [
    ("0-2d", 0, 2),
    ("3-6d", 3, 6),
    ("7-13d", 7, 13),
    ("14-29d", 14, 29),
    ("30d+", 30, None),
]
_TOUCH_BUCKETS: list[tuple[str, int, int | None]] = [
    ("1", 1, 1),
    ("2", 2, 2),
    ("3", 3, 3),
    ("4", 4, 4),
    ("5+", 5, None),
]


def _median(values: list[int]) -> float | None:
    if not values:
        return None
    s = sorted(values)
    n = len(s)
    mid = n // 2
    if n % 2:
        return float(s[mid])
    return round((s[mid - 1] + s[mid]) / 2, 2)


def _bucketize(values: list[int], buckets: list[tuple[str, int, int | None]]) -> list[dict]:
    out = [{"label": lbl, "count": 0} for (lbl, _, _) in buckets]
    for v in values:
        for i, (_lbl, lo, hi) in enumerate(buckets):
            if v >= lo and (hi is None or v <= hi):
                out[i]["count"] += 1
                break
    return out


async def get_response_latency(
    db: AsyncSession,
    firm_id: int,
    mandate_ids: list[int] | None,
) -> dict:
    """Distribution of days-to-reply and touches-to-reply across responded companies.

    Scoped to the caller's visibility (analyst → their book, partner → firm) and
    to each company's CURRENT cycle. Returns median + histogram buckets for both
    dimensions, plus denominators (``responded_total`` and per-dimension
    ``with_data``) so the UI can recede a thin sample instead of over-claiming.
    """
    stmt = select(Company).where(
        Company.firm_id == firm_id,
        Company.archived_at.is_(None),
        Company.status == RESPONDED_STATUS,
    )
    if mandate_ids is not None:
        stmt = stmt.where(Company.mandate_id.in_(mandate_ids))
    responded = (await db.execute(stmt)).scalars().all()
    responded_total = len(responded)

    days_vals: list[int] = []
    touch_vals: list[int] = []

    if responded:
        peer_ids = [c.id for c in responded]
        # Current-cycle schedule per company (A2 — exclude dead earlier cycles).
        sched_rows = (
            await db.execute(
                select(OutreachSchedule.company_id, OutreachSchedule.id).where(
                    OutreachSchedule.company_id.in_(peer_ids),
                    OutreachSchedule.is_current.is_(True),
                )
            )
        ).all()
        sched_ids = [r.id for r in sched_rows]

        events_by_company: dict[int, list[OutreachEvent]] = {}
        if sched_ids:
            evs = (
                await db.execute(
                    select(OutreachEvent).where(OutreachEvent.schedule_id.in_(sched_ids))
                )
            ).scalars().all()
            for e in evs:
                events_by_company.setdefault(e.company_id, []).append(e)

        for c in responded:
            evs = sorted(events_by_company.get(c.id, []), key=lambda e: e.occurred_on)
            initial = next(
                (e.occurred_on for e in evs if e.event_type == OutreachEventType.INITIAL_EMAIL),
                None,
            )
            response = next(
                (e.occurred_on for e in evs if e.event_type == OutreachEventType.RESPONSE),
                None,
            )
            if initial and response:
                days_vals.append((response - initial).days)
                # Touches = outbound emails sent up to and including the reply.
                touch_vals.append(
                    sum(
                        1
                        for e in evs
                        if e.event_type
                        in (OutreachEventType.INITIAL_EMAIL, OutreachEventType.FOLLOW_UP)
                        and e.occurred_on <= response
                    )
                )

    return {
        "responded_total": responded_total,
        "days": {
            "median": _median(days_vals),
            "with_data": len(days_vals),
            "buckets": _bucketize(days_vals, _DAY_BUCKETS),
        },
        "touches": {
            "median": _median(touch_vals),
            "with_data": len(touch_vals),
            "buckets": _bucketize(touch_vals, _TOUCH_BUCKETS),
        },
    }
