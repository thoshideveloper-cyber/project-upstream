"""Tasks router — declared work, as opposed to the work the cadence engine derives.

One list endpoint, one filter set, one RBAC surface. There is deliberately no
``GET /projects/{id}/tasks``: the deal room asks for ``/tasks?project_id=`` instead, so
there is exactly one place where "which tasks may this user see" is decided and exactly
one place to test it.

Two edit rules, and the asymmetry is the product:

* **status** — anyone who can see the task. That is what makes it a shared board.
* **everything else** — its author, its assignee, or a partner.

Personal tasks sit outside both: owner-only, always, including against a partner.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException, Query
from fastapi import status as http_status
from sqlalchemy import func, select

from app.core.deps import CurrentUser, SessionDep, visible_project_ids
from app.core.time import utcnow
from app.models.enums import (
    ActivityObjectType,
    ActivityVerb,
    TaskPriority,
    TaskScope,
    TaskStatus,
)
from app.models.task import Task
from app.models.user import User
from app.schemas.task import TaskCreate, TaskStatusUpdate, TaskUpdate
from app.services import activity, tasks as task_service
from app.services.scope import resolve_scope

router = APIRouter(prefix="/tasks", tags=["tasks"])


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _get_task(task_id: int, db, current_user, *, include_archived: bool = False) -> Task:
    visible = await visible_project_ids(current_user, db)
    q = select(Task).where(
        Task.id == task_id,
        task_service.visible_task_filter(current_user, visible),
    )
    if not include_archived:
        q = q.where(Task.archived_at.is_(None))
    task = (await db.execute(q)).scalar_one_or_none()
    if not task:
        # 404 rather than 403 for something outside the user's world, matching the
        # projects router: a stranger's task should not be distinguishable from a
        # task that never existed.
        raise HTTPException(status_code=404, detail="Task not found")
    return task


async def _assert_assignee_in_firm(db, current_user, assignee_id: int | None) -> None:
    if assignee_id is None:
        return
    exists = (
        await db.execute(
            select(User.id).where(
                User.id == assignee_id, User.firm_id == current_user.firm_id
            )
        )
    ).scalar_one_or_none()
    if exists is None:
        raise HTTPException(status_code=404, detail="User not found")


def _task_activity_kwargs(task: Task) -> dict:
    return {
        "object_type": ActivityObjectType.TASK,
        "object_id": task.id,
        "object_label": task.title,
        "project_id": task.project_id,
        "mandate_id": task.mandate_id,
        "company_id": task.company_id,
    }


# ── Summary ───────────────────────────────────────────────────────────────────
#
# Declared BEFORE /tasks/{task_id}. FastAPI matches routes in registration order, so
# with the detail route first, "summary" is parsed as ``task_id: int`` and 422s. The
# same trap main.py guards for /imports/workbook/*.


@router.get("/summary")
async def get_task_summary(
    db: SessionDep,
    current_user: CurrentUser,
    project_id: int | None = Query(default=None),
):
    """Counts for the sidebar, the dashboard and the deal-room vitals."""
    visible = await visible_project_ids(current_user, db)
    return await task_service.task_summary(
        db, current_user, visible, project_id=project_id
    )


# ── List / create ─────────────────────────────────────────────────────────────


@router.get("")
async def list_tasks(
    db: SessionDep,
    current_user: CurrentUser,
    project_id: int | None = Query(default=None),
    mandate_id: int | None = Query(default=None),
    company_id: int | None = Query(default=None),
    contact_id: int | None = Query(default=None),
    assignee_id: int | None = Query(default=None),
    status: list[TaskStatus] | None = Query(default=None),
    priority: TaskPriority | None = Query(default=None),
    scope: TaskScope | None = Query(default=None),
    due_before: date | None = Query(default=None),
    overdue: bool = Query(default=False),
    q: str | None = Query(default=None),
    include_done: bool = Query(default=False),
    include_archived: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    visible = await visible_project_ids(current_user, db)
    filters = dict(
        project_id=project_id,
        mandate_id=mandate_id,
        company_id=company_id,
        contact_id=contact_id,
        assignee_id=assignee_id,
        statuses=status,
        priority=priority,
        scope=scope,
        due_before=due_before,
        overdue=overdue,
        q=q,
        include_done=include_done,
        include_archived=include_archived,
    )

    base = task_service.apply_filters(
        select(Task).where(task_service.visible_task_filter(current_user, visible)),
        **filters,
    )
    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar() or 0

    paged = await db.execute(
        task_service.default_order(base)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = await task_service.decorate(db, paged.scalars().all())

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "summary": await task_service.task_summary(
            db, current_user, visible, project_id=project_id
        ),
    }


@router.post("", status_code=http_status.HTTP_201_CREATED)
async def create_task(body: TaskCreate, db: SessionDep, current_user: CurrentUser):
    """Create a task, deriving the whole attachment chain from the one id supplied."""
    await _assert_visible_attachment(db, current_user, body)
    chain = await resolve_scope(
        db,
        current_user.firm_id,
        project_id=body.project_id,
        mandate_id=body.mandate_id,
        company_id=body.company_id,
        contact_id=body.contact_id,
    )
    await _assert_assignee_in_firm(db, current_user, body.assignee_id)

    task = Task(
        firm_id=current_user.firm_id,
        scope=chain.scope,
        project_id=chain.project_id,
        mandate_id=chain.mandate_id,
        company_id=chain.company_id,
        contact_id=chain.contact_id,
        title=body.title,
        notes=body.notes,
        status=body.status,
        priority=body.priority,
        due_date=body.due_date,
        assignee_id=body.assignee_id,
        created_by_id=current_user.id,
        completed_at=utcnow() if body.status == TaskStatus.DONE else None,
    )
    db.add(task)
    await db.flush()

    await activity.log(
        db,
        actor=current_user,
        verb=ActivityVerb.TASK_CREATED,
        **_task_activity_kwargs(task),
        meta={"scope": chain.scope.value, "assignee_id": task.assignee_id},
    )
    await db.commit()
    await db.refresh(task)
    return (await task_service.decorate(db, [task]))[0]


async def _assert_visible_attachment(db, current_user, body: TaskCreate) -> None:
    """Refuse to attach a task to something the caller cannot already see.

    ``resolve_scope`` validates tenancy; this validates *visibility*, reusing the same
    helpers the owning routers use so the 404 story stays identical everywhere.
    """
    from app.api.companies import _get_visible_company

    if body.company_id is not None:
        await _get_visible_company(body.company_id, db, current_user)
    if body.contact_id is not None:
        # Contacts are firm-scoped, not mandate-scoped, so ``_get_contact`` alone would
        # let an analyst attach work to a company they cannot see. Gate on the company.
        from app.api.contacts import _get_contact

        contact = await _get_contact(body.contact_id, current_user.firm_id, db)
        await _get_visible_company(contact.company_id, db, current_user)
    if body.mandate_id is not None:
        from app.api.mandates import _get_visible_mandate

        await _get_visible_mandate(body.mandate_id, db, current_user)
    if body.project_id is not None:
        from app.api.projects import _get_project

        await _get_project(body.project_id, db, current_user)


# ── Detail / update ───────────────────────────────────────────────────────────


@router.get("/{task_id}")
async def get_task(task_id: int, db: SessionDep, current_user: CurrentUser):
    task = await _get_task(task_id, db, current_user, include_archived=True)
    return (await task_service.decorate(db, [task]))[0]


@router.patch("/{task_id}")
async def update_task(
    task_id: int, body: TaskUpdate, db: SessionDep, current_user: CurrentUser
):
    """Edit a task. Status alone is open to anyone who can see it; the rest is not."""
    task = await _get_task(task_id, db, current_user)
    updates = body.model_dump(exclude_unset=True)
    new_status = updates.pop("status", None)

    if updates and not task_service.may_edit_details(task, current_user):
        raise HTTPException(
            status_code=403,
            detail="Only the task's author, its assignee or a partner may edit it.",
        )

    if "assignee_id" in updates:
        await _assert_assignee_in_firm(db, current_user, updates["assignee_id"])

    changed = sorted(updates)
    old_assignee = task.assignee_id
    for field, value in updates.items():
        setattr(task, field, value)

    if new_status is not None and new_status != task.status:
        old_status = task.status
        task_service.apply_status_change(task, new_status)
        await activity.log(
            db,
            actor=current_user,
            verb=ActivityVerb.TASK_STATUS_CHANGED,
            **_task_activity_kwargs(task),
            meta={"from": old_status.value, "to": new_status.value},
        )

    if "assignee_id" in updates and updates["assignee_id"] != old_assignee:
        await activity.log(
            db,
            actor=current_user,
            verb=ActivityVerb.TASK_ASSIGNED,
            **_task_activity_kwargs(task),
            meta={"from": old_assignee, "to": updates["assignee_id"]},
        )
        changed = [c for c in changed if c != "assignee_id"]

    if changed:
        await activity.log(
            db,
            actor=current_user,
            verb=ActivityVerb.TASK_UPDATED,
            **_task_activity_kwargs(task),
            meta={"fields": changed},
        )

    await db.commit()
    await db.refresh(task)
    return (await task_service.decorate(db, [task]))[0]


@router.patch("/{task_id}/status")
async def update_task_status(
    task_id: int, body: TaskStatusUpdate, db: SessionDep, current_user: CurrentUser
):
    """Move a task across the board. Open to anyone who can see it, by design."""
    task = await _get_task(task_id, db, current_user)
    if body.status != task.status:
        old_status = task.status
        task_service.apply_status_change(task, body.status)
        await activity.log(
            db,
            actor=current_user,
            verb=ActivityVerb.TASK_STATUS_CHANGED,
            **_task_activity_kwargs(task),
            meta={"from": old_status.value, "to": body.status.value},
        )
    await db.commit()
    await db.refresh(task)
    return (await task_service.decorate(db, [task]))[0]


@router.delete("/{task_id}", status_code=http_status.HTTP_200_OK)
async def archive_task(task_id: int, db: SessionDep, current_user: CurrentUser):
    """Soft-delete (CLAUDE.md rule 6). Editing a task is narrower than moving it, and
    removing one is an edit."""
    task = await _get_task(task_id, db, current_user)
    if not task_service.may_edit_details(task, current_user):
        raise HTTPException(
            status_code=403,
            detail="Only the task's author, its assignee or a partner may archive it.",
        )
    task.archived_at = utcnow()
    await activity.log(
        db,
        actor=current_user,
        verb=ActivityVerb.TASK_ARCHIVED,
        **_task_activity_kwargs(task),
    )
    await db.commit()
    return {"detail": "Task archived"}


@router.post("/{task_id}/unarchive", status_code=http_status.HTTP_200_OK)
async def unarchive_task(task_id: int, db: SessionDep, current_user: CurrentUser):
    task = await _get_task(task_id, db, current_user, include_archived=True)
    if not task_service.may_edit_details(task, current_user):
        raise HTTPException(
            status_code=403,
            detail="Only the task's author, its assignee or a partner may restore it.",
        )
    task.archived_at = None
    await db.commit()
    await db.refresh(task)
    return (await task_service.decorate(db, [task]))[0]
