"""The activity log — who changed what, written by hand at curated call sites.

Two rules hold this together, and both are easy to break by accident:

1. **``log()`` never commits.** It calls ``db.add(...)`` and nothing else. The caller's
   own ``await db.commit()`` carries the row, so the activity entry and the mutation it
   describes land in one transaction or neither does. An activity row that survives a
   rolled-back mutation is not an incomplete log — it is a lie, and a partner reading the
   feed has no way to tell. Several routers flush mid-request, which is exactly why this
   must not.

2. **The actor comes from the call site.** Every mutating router already has
   ``current_user`` in its signature, so identity is free here and impossible to get from
   a session listener.

Why not a SQLAlchemy session listener, which would be automatic and complete?
``session.execute(delete(...))`` — the workspace reset and the project delete — fires no
ORM events at all, so a differ would silently miss the two most destructive paths in the
app, which are the two a partner most wants recorded. A differ also has no
``current_user``, would emit ``status: NOT_CONTACTED -> CONTACTED`` where the product
wants "logged an initial email", and would see every row as dirty because every model
carries ``updated_at onupdate=func.now()``. Completeness is bought instead by
``tests/test_activity_coverage.py``, which fails the suite when a new mutating route is
added without a decision about logging it.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Sequence

from sqlalchemy import and_, false, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import to_naive_utc
from app.models.activity_event import ActivityEvent
from app.models.enums import ActivityObjectType, ActivityVerb
from app.models.user import User

# Verb groups drive the feed's filter chips. Kept beside the vocabulary rather than in
# the router so the frontend's copy in lib/activity.ts has one thing to mirror.
VERB_GROUPS: dict[str, tuple[ActivityVerb, ...]] = {
    "DEAL": (
        ActivityVerb.PROJECT_CREATED,
        ActivityVerb.PROJECT_UPDATED,
        ActivityVerb.PROJECT_ARCHIVED,
        ActivityVerb.PROJECT_UNARCHIVED,
        ActivityVerb.PROJECT_DELETED,
        ActivityVerb.MANDATE_CREATED,
        ActivityVerb.MANDATE_UPDATED,
        ActivityVerb.MANDATE_ARCHIVED,
        ActivityVerb.MANDATE_UNARCHIVED,
    ),
    "OUTREACH": (
        ActivityVerb.OUTREACH_LOGGED,
        ActivityVerb.EMAIL_SENT,
        ActivityVerb.SCHEDULE_UPDATED,
        ActivityVerb.SCHEDULE_RESTARTED,
        ActivityVerb.COMPANY_STATUS_CHANGED,
    ),
    "DATA": (
        ActivityVerb.COMPANY_CREATED,
        ActivityVerb.COMPANY_UPDATED,
        ActivityVerb.COMPANY_ARCHIVED,
        ActivityVerb.COMPANY_UNARCHIVED,
        ActivityVerb.CONTACT_CREATED,
        ActivityVerb.CONTACT_UPDATED,
        ActivityVerb.CONTACT_ARCHIVED,
        ActivityVerb.CANDIDATE_ADDED,
        ActivityVerb.CANDIDATE_PUSHED,
        ActivityVerb.CANDIDATE_STAGE_CHANGED,
        ActivityVerb.IMPORT_APPLIED,
    ),
    "PEOPLE": (
        ActivityVerb.PROJECT_MEMBER_ADDED,
        ActivityVerb.PROJECT_MEMBER_REMOVED,
        ActivityVerb.MANDATE_ASSIGNED,
        ActivityVerb.MANDATE_UNASSIGNED,
        ActivityVerb.TASK_CREATED,
        ActivityVerb.TASK_UPDATED,
        ActivityVerb.TASK_ASSIGNED,
        ActivityVerb.TASK_STATUS_CHANGED,
        ActivityVerb.TASK_ARCHIVED,
    ),
}


async def log(
    db: AsyncSession,
    *,
    actor: User | None,
    verb: ActivityVerb,
    object_type: ActivityObjectType,
    object_id: int | None = None,
    object_label: str | None = None,
    project_id: int | None = None,
    mandate_id: int | None = None,
    company_id: int | None = None,
    firm_id: int | None = None,
    meta: dict | None = None,
) -> ActivityEvent:
    """Add one activity row to the caller's transaction. Does NOT commit.

    ``actor_name`` and ``object_label`` are snapshots taken now, on purpose: a firm-wide
    feed page references dozens of objects the client never loaded, and after a project
    delete those objects are gone entirely. A later rename not showing up in history is
    correct for an append-only log.
    """
    event = ActivityEvent(
        firm_id=firm_id if firm_id is not None else (actor.firm_id if actor else None),
        project_id=project_id,
        mandate_id=mandate_id,
        company_id=company_id,
        actor_id=actor.id if actor else None,
        actor_name=actor.full_name if actor else None,
        verb=verb,
        object_type=object_type,
        object_id=object_id,
        object_label=object_label,
        meta=meta,
    )
    db.add(event)
    return event


def visible_activity_filter(user: User, visible_projects: list[int] | None):
    """The single source of the activity RBAC predicate.

    Firm scope always. Beyond that: a row on a project you can see, or an unattached row
    (``project_id IS NULL``) that is either yours or — for a partner — anyone's.

    The ``project_id IS NULL`` half is load-bearing. Personal-task and firm-configuration
    rows have no project, so without this clause they would either vanish from the feed
    entirely or, written the naive way, hand an analyst the firm's whole admin trail.

    Note the explicit ``is None`` test on ``visible_projects``; ``if visible_projects:``
    would collapse "partner" and "analyst with no projects" into the same branch.
    """
    unattached = ActivityEvent.project_id.is_(None)
    mine = ActivityEvent.actor_id == user.id

    if visible_projects is None:
        return ActivityEvent.firm_id == user.firm_id  # partner: everything in the firm

    project_clause = (
        ActivityEvent.project_id.in_(visible_projects) if visible_projects else false()
    )
    return and_(
        ActivityEvent.firm_id == user.firm_id,
        or_(project_clause, and_(unattached, mine)),
    )


async def feed(
    db: AsyncSession,
    *,
    user: User,
    visible_projects: list[int] | None,
    project_id: int | None = None,
    company_id: int | None = None,
    verbs: Sequence[ActivityVerb] | None = None,
    actor_id: int | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    """The one query all three read endpoints share.

    ``since``/``until`` arrive from the API timezone-aware while ``created_at`` is naive
    (the house convention for ``server_default`` timestamps). PostgreSQL raises on that
    comparison, so both are normalised through ``to_naive_utc``.
    """
    stmt = select(ActivityEvent).where(visible_activity_filter(user, visible_projects))
    if project_id is not None:
        stmt = stmt.where(ActivityEvent.project_id == project_id)
    if company_id is not None:
        stmt = stmt.where(ActivityEvent.company_id == company_id)
    if verbs:
        stmt = stmt.where(ActivityEvent.verb.in_(list(verbs)))
    if actor_id is not None:
        stmt = stmt.where(ActivityEvent.actor_id == actor_id)
    if since is not None:
        stmt = stmt.where(ActivityEvent.created_at >= to_naive_utc(since))
    if until is not None:
        stmt = stmt.where(ActivityEvent.created_at <= to_naive_utc(until))

    from sqlalchemy import func

    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar() or 0

    rows = (
        await db.execute(
            stmt.order_by(ActivityEvent.created_at.desc(), ActivityEvent.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    return {
        "items": [_serialise(e) for e in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def _serialise(e: ActivityEvent) -> dict[str, Any]:
    return {
        "id": e.id,
        "firm_id": e.firm_id,
        "project_id": e.project_id,
        "mandate_id": e.mandate_id,
        "company_id": e.company_id,
        "actor_id": e.actor_id,
        "actor_name": e.actor_name,
        "verb": e.verb.value,
        "object_type": e.object_type.value,
        "object_id": e.object_id,
        "object_label": e.object_label,
        "meta": e.meta,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


__all__ = ["VERB_GROUPS", "feed", "log", "visible_activity_filter"]
