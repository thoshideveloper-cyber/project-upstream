"""Task queries and mutations.

Everything that decides *which tasks a user may see* lives in ``visible_task_filter`` and
nowhere else, so the list, the detail lookup, the summary and the per-project rollup
cannot drift apart. Drift there is not a cosmetic bug: the list envelope's ``total`` is
computed from the same predicate, so a filter that is right in one place and wrong in
another produces a count that contradicts the rows beside it.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Sequence

from sqlalchemy import ColumnElement, and_, case, false, func, or_, select, true
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import today_ist, utcnow
from app.models.enums import TaskPriority, TaskScope, TaskStatus, UserRole
from app.models.project import Project
from app.models.task import Task
from app.models.user import User

# TaskPriority is stored as VARCHAR, so ORDER BY priority DESC sorts alphabetically and
# gives MEDIUM > LOW > HIGH. Rank it explicitly.
PRIORITY_RANK = case(
    (Task.priority == TaskPriority.HIGH, 3),
    (Task.priority == TaskPriority.MEDIUM, 2),
    (Task.priority == TaskPriority.LOW, 1),
    else_=0,
)

OPEN_STATUSES = (TaskStatus.BACKLOG, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED)


def visible_task_filter(user: User, visible_projects: list[int] | None) -> ColumnElement:
    """The single source of the task RBAC predicate.

    A partner (``visible_projects is None``) sees every task in the firm **except**
    other people's personal ones. An analyst sees tasks on their visible projects, plus
    their own personal tasks.

    ``PERSONAL`` tasks are owner-only, always, including against a partner. They are the
    one thing in this app that is genuinely private, and a partner's firm-wide list
    silently including them would be a surprise of the worst kind.

    Note the explicit ``is None`` test. ``if visible_projects:`` would treat a partner
    (``None``) and an analyst with zero projects (``[]``) identically, which is a
    firm-wide leak — the exact shape of bug this codebase has been one refactor away from
    since ``visible_mandate_ids`` was written.
    """
    mine = Task.created_by_id == user.id
    personal_and_mine = and_(Task.scope == TaskScope.PERSONAL, mine)
    not_personal = Task.scope != TaskScope.PERSONAL

    if visible_projects is None:
        # Partner: everything in the firm that is not someone else's personal task.
        return and_(Task.firm_id == user.firm_id, or_(not_personal, personal_and_mine))

    if not visible_projects:
        project_clause = false()
    else:
        project_clause = Task.project_id.in_(visible_projects)

    return and_(
        Task.firm_id == user.firm_id,
        or_(and_(not_personal, project_clause), personal_and_mine),
    )


def may_edit_details(task: Task, user: User) -> bool:
    """Who may change title / notes / due date / priority / assignee.

    Anyone who can *see* a task may move its status — that is what makes it a shared
    board. Rewriting what the task says is narrower: its author, its assignee, or a
    partner. A personal task is its owner's alone, partner or not.
    """
    if task.scope == TaskScope.PERSONAL:
        return task.created_by_id == user.id
    if user.role == UserRole.PARTNER:
        return True
    return task.created_by_id == user.id or task.assignee_id == user.id


def _base_query(user: User, visible_projects: list[int] | None):
    return select(Task).where(visible_task_filter(user, visible_projects))


def apply_filters(
    stmt,
    *,
    project_id: int | None = None,
    mandate_id: int | None = None,
    company_id: int | None = None,
    contact_id: int | None = None,
    assignee_id: int | None = None,
    statuses: Sequence[TaskStatus] | None = None,
    priority: TaskPriority | None = None,
    scope: TaskScope | None = None,
    due_before: date | None = None,
    overdue: bool = False,
    q: str | None = None,
    include_done: bool = False,
    include_archived: bool = False,
):
    """Narrow a task query. Shared by the list endpoint and the summary."""
    if project_id is not None:
        stmt = stmt.where(Task.project_id == project_id)
    if mandate_id is not None:
        stmt = stmt.where(Task.mandate_id == mandate_id)
    if company_id is not None:
        stmt = stmt.where(Task.company_id == company_id)
    if contact_id is not None:
        stmt = stmt.where(Task.contact_id == contact_id)
    if assignee_id is not None:
        stmt = stmt.where(Task.assignee_id == assignee_id)
    if statuses:
        stmt = stmt.where(Task.status.in_(list(statuses)))
    elif not include_done:
        stmt = stmt.where(Task.status != TaskStatus.DONE)
    if priority is not None:
        stmt = stmt.where(Task.priority == priority)
    if scope is not None:
        stmt = stmt.where(Task.scope == scope)
    if due_before is not None:
        stmt = stmt.where(Task.due_date.is_not(None), Task.due_date < due_before)
    if overdue:
        stmt = stmt.where(
            Task.due_date.is_not(None),
            Task.due_date < today_ist(),
            Task.status != TaskStatus.DONE,
        )
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Task.title.ilike(like), Task.notes.ilike(like)))
    if not include_archived:
        stmt = stmt.where(Task.archived_at.is_(None))
    return stmt


def default_order(stmt):
    """Soonest real due date first, then priority, then newest.

    ``due_date IS NULL`` as a leading sort key rather than ``NULLS LAST``, which older
    SQLite does not support — undated work sinks below dated work on every backend.
    """
    return stmt.order_by(
        (Task.due_date.is_(None)).asc(),
        Task.due_date.asc(),
        PRIORITY_RANK.desc(),
        Task.id.desc(),
    )


async def decorate(db: AsyncSession, tasks: Sequence[Task]) -> list[dict]:
    """Attach the display names a task row needs, in two queries for the whole page.

    Never walk ``task.assignee`` / ``task.project``: touching an unloaded relationship on
    an async session raises, and doing it per row would be an N+1 besides.
    """
    from app.schemas.task import TaskRead

    if not tasks:
        return []

    user_ids = {t.assignee_id for t in tasks} | {t.created_by_id for t in tasks}
    user_ids.discard(None)
    names: dict[int, str] = {}
    if user_ids:
        rows = await db.execute(
            select(User.id, User.full_name).where(User.id.in_(list(user_ids)))
        )
        names = {uid: full_name for uid, full_name in rows.all()}

    project_ids = {t.project_id for t in tasks}
    project_ids.discard(None)
    project_names: dict[int, str] = {}
    if project_ids:
        rows = await db.execute(
            select(Project.id, Project.name).where(Project.id.in_(list(project_ids)))
        )
        project_names = {pid: name for pid, name in rows.all()}

    labels = await _attachment_labels(db, tasks)
    today = today_ist()

    out: list[dict] = []
    for t in tasks:
        data = TaskRead.model_validate(t).model_dump()
        data["assignee_name"] = names.get(t.assignee_id) if t.assignee_id else None
        data["created_by_name"] = names.get(t.created_by_id) if t.created_by_id else None
        data["project_name"] = project_names.get(t.project_id) if t.project_id else None
        data["attached_to"] = labels.get(t.id)
        data["is_overdue"] = bool(
            t.due_date and t.due_date < today and t.status != TaskStatus.DONE
        )
        out.append(data)
    return out


async def _attachment_labels(db: AsyncSession, tasks: Sequence[Task]) -> dict[int, dict]:
    """One `{type, id, label}` per task, batched by kind (three queries at most)."""
    from app.models.company import Company
    from app.models.contact import Contact
    from app.models.mandate import Mandate

    contact_ids = {t.contact_id for t in tasks if t.scope == TaskScope.CONTACT}
    company_ids = {t.company_id for t in tasks if t.scope == TaskScope.COMPANY}
    mandate_ids = {t.mandate_id for t in tasks if t.scope == TaskScope.MANDATE}
    project_ids = {t.project_id for t in tasks if t.scope == TaskScope.PROJECT}
    for s in (contact_ids, company_ids, mandate_ids, project_ids):
        s.discard(None)

    async def _lookup(model: Any, label_col: Any, ids: set[int]) -> dict[int, str]:
        if not ids:
            return {}
        rows = await db.execute(
            select(model.id, label_col).where(model.id.in_(list(ids)))
        )
        return {rid: label for rid, label in rows.all()}

    contacts = await _lookup(Contact, Contact.contact_person, contact_ids)
    companies = await _lookup(Company, Company.company_name, company_ids)
    mandates = await _lookup(Mandate, Mandate.name, mandate_ids)
    projects = await _lookup(Project, Project.name, project_ids)

    out: dict[int, dict] = {}
    for t in tasks:
        if t.scope == TaskScope.CONTACT and t.contact_id:
            out[t.id] = {
                "type": "CONTACT",
                "id": t.contact_id,
                "label": contacts.get(t.contact_id),
            }
        elif t.scope == TaskScope.COMPANY and t.company_id:
            out[t.id] = {
                "type": "COMPANY",
                "id": t.company_id,
                "label": companies.get(t.company_id),
            }
        elif t.scope == TaskScope.MANDATE and t.mandate_id:
            out[t.id] = {
                "type": "MANDATE",
                "id": t.mandate_id,
                "label": mandates.get(t.mandate_id),
            }
        elif t.scope == TaskScope.PROJECT and t.project_id:
            out[t.id] = {
                "type": "PROJECT",
                "id": t.project_id,
                "label": projects.get(t.project_id),
            }
    return out


def apply_status_change(task: Task, new_status: TaskStatus) -> None:
    """Move a task's status, keeping ``completed_at`` honest in both directions.

    Setting it on DONE is the obvious half. Clearing it when a task is reopened is the
    half that gets forgotten, and it is the one that matters: a task carrying a stale
    ``completed_at`` reads as finished in every "what got done this week" query.
    """
    task.status = new_status
    task.completed_at = utcnow() if new_status == TaskStatus.DONE else None


async def task_summary(
    db: AsyncSession,
    user: User,
    visible_projects: list[int] | None,
    *,
    project_id: int | None = None,
) -> dict:
    """Counts for the sidebar and the dashboard, in two grouped queries.

    ``by_project`` is only computed when the summary is not already scoped to one
    project — asking a single-project summary to break itself down by project is a
    query nobody reads.
    """
    today = today_ist()
    week_end = today + timedelta(days=7)

    base = select(Task).where(visible_task_filter(user, visible_projects))
    base = base.where(Task.archived_at.is_(None))
    if project_id is not None:
        base = base.where(Task.project_id == project_id)
    scoped = base.subquery()

    status_rows = (
        await db.execute(
            select(scoped.c.status, scoped.c.priority, func.count())
            .select_from(scoped)
            .group_by(scoped.c.status, scoped.c.priority)
        )
    ).all()

    by_status = {s.value: 0 for s in TaskStatus}
    by_priority = {p.value: 0 for p in TaskPriority}
    total = 0
    for status_val, priority_val, count in status_rows:
        key = status_val.value if hasattr(status_val, "value") else str(status_val)
        pkey = priority_val.value if hasattr(priority_val, "value") else str(priority_val)
        by_status[key] = by_status.get(key, 0) + count
        by_priority[pkey] = by_priority.get(pkey, 0) + count
        total += count

    open_count = sum(by_status.get(s.value, 0) for s in OPEN_STATUSES)

    date_rows = (
        await db.execute(
            select(
                func.count().filter(
                    scoped.c.due_date.is_not(None),
                    scoped.c.due_date < today,
                    scoped.c.status != TaskStatus.DONE,
                ),
                func.count().filter(
                    scoped.c.due_date == today, scoped.c.status != TaskStatus.DONE
                ),
                func.count().filter(
                    scoped.c.due_date.is_not(None),
                    scoped.c.due_date >= today,
                    scoped.c.due_date <= week_end,
                    scoped.c.status != TaskStatus.DONE,
                ),
                func.count().filter(
                    scoped.c.assignee_id == user.id, scoped.c.status != TaskStatus.DONE
                ),
            ).select_from(scoped)
        )
    ).one()

    summary: dict = {
        "total": total,
        "open": open_count,
        "overdue": date_rows[0] or 0,
        "due_today": date_rows[1] or 0,
        "due_this_week": date_rows[2] or 0,
        "by_status": by_status,
        "by_priority": by_priority,
        "assigned_to_me": date_rows[3] or 0,
    }

    if project_id is None:
        summary["by_project"] = await project_task_counts(
            db, user, visible_projects, as_list=True
        )
    return summary


async def project_task_counts(
    db: AsyncSession,
    user: User,
    visible_projects: list[int] | None,
    *,
    project_ids: list[int] | None = None,
    as_list: bool = False,
):
    """Open and overdue task counts per project — ONE grouped query for a whole page.

    ``GET /projects`` advertises a fixed query count regardless of how many projects or
    mandates are on the page. This must never become a loop.
    """
    today = today_ist()
    stmt = (
        select(
            Task.project_id,
            func.count().filter(Task.status != TaskStatus.DONE),
            func.count().filter(
                Task.due_date.is_not(None),
                Task.due_date < today,
                Task.status != TaskStatus.DONE,
            ),
        )
        .where(
            visible_task_filter(user, visible_projects),
            Task.archived_at.is_(None),
            Task.project_id.is_not(None),
        )
        .group_by(Task.project_id)
    )
    if project_ids is not None:
        if not project_ids:
            return [] if as_list else {}
        stmt = stmt.where(Task.project_id.in_(project_ids))

    rows = (await db.execute(stmt)).all()
    if as_list:
        names: dict[int, str] = {}
        pids = [r[0] for r in rows]
        if pids:
            nrows = await db.execute(
                select(Project.id, Project.name).where(Project.id.in_(pids))
            )
            names = {pid: name for pid, name in nrows.all()}
        return [
            {
                "project_id": pid,
                "project_name": names.get(pid),
                "open": open_n,
                "overdue": overdue_n,
            }
            for pid, open_n, overdue_n in rows
        ]
    return {pid: {"open": open_n, "overdue": overdue_n} for pid, open_n, overdue_n in rows}


async def project_status_breakdown(
    db: AsyncSession, user: User, visible_projects: list[int] | None, project_id: int
) -> dict[str, int]:
    """`{BACKLOG: n, ...}` for one project — the deal room's task vitals."""
    rows = (
        await db.execute(
            select(Task.status, func.count())
            .where(
                visible_task_filter(user, visible_projects),
                Task.archived_at.is_(None),
                Task.project_id == project_id,
            )
            .group_by(Task.status)
        )
    ).all()
    out = {s.value: 0 for s in TaskStatus}
    for status_val, count in rows:
        key = status_val.value if hasattr(status_val, "value") else str(status_val)
        out[key] = count
    return out


__all__ = [
    "OPEN_STATUSES",
    "PRIORITY_RANK",
    "apply_filters",
    "apply_status_change",
    "decorate",
    "default_order",
    "may_edit_details",
    "project_status_breakdown",
    "project_task_counts",
    "task_summary",
    "visible_task_filter",
]
