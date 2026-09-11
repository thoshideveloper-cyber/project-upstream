"""Activity router — three read surfaces over one query, and no way to write.

The firm-wide feed for a partner is just ``GET /activity`` with no filters:
``visible_project_ids`` returns ``None`` for a partner so no project predicate applies,
while an analyst on the same URL gets their own projects. One query to get right instead
of two, and no role gate to keep in sync with the one in ``visible_project_ids``.

There is no ``POST /activity``, ever. The log is written by the code that performs the
mutation, in the same transaction; an endpoint that let a client assert "X did Y" would
make every row in the table unfalsifiable. A test asserts the 405.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, SessionDep, visible_project_ids
from app.models.enums import ActivityVerb
from app.services import activity as activity_service

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("")
async def list_activity(
    db: SessionDep,
    current_user: CurrentUser,
    project_id: int | None = Query(default=None),
    company_id: int | None = Query(default=None),
    verb: list[ActivityVerb] | None = Query(default=None),
    group: str | None = Query(default=None, description="DEAL | OUTREACH | DATA | PEOPLE"),
    actor_id: int | None = Query(default=None),
    since: datetime | None = Query(default=None),
    until: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    """The desk feed. Firm-wide for a partner, own-projects for an analyst."""
    visible = await visible_project_ids(current_user, db)
    verbs = list(verb) if verb else None
    if group:
        verbs = list(activity_service.VERB_GROUPS.get(group.upper(), ()))
        if not verbs:
            # An unknown group must return nothing, not everything.
            return {"items": [], "total": 0, "page": page, "page_size": page_size}

    return await activity_service.feed(
        db,
        user=current_user,
        visible_projects=visible,
        project_id=project_id,
        company_id=company_id,
        verbs=verbs,
        actor_id=actor_id,
        since=since,
        until=until,
        page=page,
        page_size=page_size,
    )


@router.get("/groups")
async def list_verb_groups(current_user: CurrentUser):
    """The filter-chip vocabulary, so the frontend never hard-codes a verb list."""
    return {
        name: [v.value for v in verbs]
        for name, verbs in activity_service.VERB_GROUPS.items()
    }
