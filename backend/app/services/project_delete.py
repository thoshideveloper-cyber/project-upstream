"""Permanent deletion of a project and everything filed under it.

This is the **second deliberate exception to CLAUDE.md rule 6** (soft delete only). The
first is ``POST /workspace/reset``, whose sibling table list lives in
``app/api/workspace.py`` and should be read beside this one. The reasoning is the same in
both places: ``archived_at`` exists to preserve the memory of outreach that really
happened, while these two endpoints exist to remove a book that should never have been
there — a mis-imported workbook, a project opened against the wrong client.

**The role gate was removed on purpose.** Any user who can see a project may delete it,
which means an analyst can permanently destroy a client's whole book. That was a product
decision, and the rails that stand in its place are not role-based:

1. the project must already be archived (409 otherwise), so delete is a deliberate
   second step and a mis-click on the wrong row can only ever archive;
2. the project's name must be typed back (422 otherwise);
3. a dry-run preview states the counts, so the dialog can say what dies;
4. a ``PROJECT_DELETED`` tombstone is written after the loop with ``project_id=NULL``,
   plus a ``logger.warning`` that outlives even a workspace reset.

The ordering below is a subsequence of ``workspace._BOOK`` with the three newer tables
inserted where their foreign keys demand. It matters more than it looks: there is no
``PRAGMA foreign_keys=ON`` anywhere in this backend, so SQLite does **not** enforce the
FKs these tables declare. A wrong order passes every ordinary test on a developer machine
and raises ``ForeignKeyViolation`` only in production. ``tests/test_project_delete.py``
therefore builds its own engine with FK enforcement switched on — it is the only place
the ordering is genuinely exercised.

Every scope is a **subquery expression**, never a materialised Python list: SQLite caps
bound parameters at 999 and a real project's company list will pass that.
"""

from __future__ import annotations

import logging
from typing import Callable

from sqlalchemy import Select, delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_event import ActivityEvent
from app.models.company import Company
from app.models.contact import Contact
from app.models.enums import ActivityObjectType, ActivityVerb
from app.models.import_batch import ImportBatch
from app.models.import_row import ImportRow
from app.models.mandate import Mandate
from app.models.mandate_assignment import MandateAssignment
from app.models.outreach_event import OutreachEvent
from app.models.outreach_schedule import OutreachSchedule
from app.models.project import Project
from app.models.project_assignment import ProjectAssignment
from app.models.sent_email import SentEmail
from app.models.sourcing_candidate import SourcingCandidate
from app.models.sourcing_layer import SourcingLayer
from app.models.task import Task
from app.services import activity

logger = logging.getLogger(__name__)


# ── Scope subqueries ──────────────────────────────────────────────────────────


def _mandate_ids(project_id: int) -> Select:
    return select(Mandate.id).where(Mandate.project_id == project_id)


def _company_ids(project_id: int) -> Select:
    return select(Company.id).where(Company.mandate_id.in_(_mandate_ids(project_id)))


def _contact_ids(project_id: int) -> Select:
    return select(Contact.id).where(Contact.company_id.in_(_company_ids(project_id)))


def _schedule_ids(project_id: int) -> Select:
    return select(OutreachSchedule.id).where(
        OutreachSchedule.company_id.in_(_company_ids(project_id))
    )


def _own_batch_ids(project_id: int) -> Select:
    return select(ImportBatch.id).where(ImportBatch.project_id == project_id)


# ── The ordered step list ─────────────────────────────────────────────────────
#
# Exported so the test can assert the ordering directly rather than inferring it from
# whether a delete happened to succeed on a backend that is not checking.

_STEPS: list[tuple[str, Callable[[int], object]]] = [
    ("sent_emails", lambda pid: delete(SentEmail).where(
        SentEmail.company_id.in_(_company_ids(pid))
    )),
    # import_rows, part 1: rows belonging to this project's own WORKBOOK batches.
    ("import_rows", lambda pid: delete(ImportRow).where(
        ImportRow.batch_id.in_(_own_batch_ids(pid))
    )),
    ("import_batches", lambda pid: delete(ImportBatch).where(
        ImportBatch.project_id == pid
    )),
    ("activity_events", lambda pid: delete(ActivityEvent).where(
        (ActivityEvent.project_id == pid)
        | (ActivityEvent.company_id.in_(_company_ids(pid)))
    )),
    # project_id covers every non-personal task; the company/contact predicates are
    # defensive, for a row whose denormalised project_id somehow went stale.
    ("tasks", lambda pid: delete(Task).where(
        (Task.project_id == pid)
        | (Task.company_id.in_(_company_ids(pid)))
        | (Task.contact_id.in_(_contact_ids(pid)))
    )),
    ("outreach_events", lambda pid: delete(OutreachEvent).where(
        OutreachEvent.company_id.in_(_company_ids(pid))
    )),
    ("outreach_schedules", lambda pid: delete(OutreachSchedule).where(
        OutreachSchedule.company_id.in_(_company_ids(pid))
    )),
    ("contacts", lambda pid: delete(Contact).where(
        Contact.company_id.in_(_company_ids(pid))
    )),
    # Candidates FK companies, so they must go before them...
    ("sourcing_candidates", lambda pid: delete(SourcingCandidate).where(
        SourcingCandidate.mandate_id.in_(_mandate_ids(pid))
    )),
    # ...and companies FK sourcing_layers, so they must go before those.
    ("companies", lambda pid: delete(Company).where(
        Company.mandate_id.in_(_mandate_ids(pid))
    )),
    ("sourcing_layers", lambda pid: delete(SourcingLayer).where(
        SourcingLayer.mandate_id.in_(_mandate_ids(pid))
    )),
    ("mandate_assignments", lambda pid: delete(MandateAssignment).where(
        MandateAssignment.mandate_id.in_(_mandate_ids(pid))
    )),
    ("project_assignments", lambda pid: delete(ProjectAssignment).where(
        ProjectAssignment.project_id == pid
    )),
    ("mandates", lambda pid: delete(Mandate).where(Mandate.project_id == pid)),
    ("projects", lambda pid: delete(Project).where(Project.id == pid)),
]

# Counted and reported, but never deleted:
#
# * ``company_profiles`` — the *database* tier. It survives even a workspace reset per
#   CLAUDE.md's deployment model, so it must certainly survive one project's deletion.
# * ``saved_searches``, ``sourcing_stages``, ``company_categories``, email config,
#   ``users`` — firm configuration, which belongs to the firm and not to this project.


async def _count(db: AsyncSession, model: type, where) -> int:
    return (
        await db.execute(select(func.count()).select_from(model).where(where))
    ).scalar() or 0


async def preview_deletion(db: AsyncSession, project: Project) -> dict:
    """What a permanent delete would remove, per table.

    This rail does more work than the name box. The name box prevents a mis-click; the
    counts prevent a misunderstanding — "this removes 412 companies and 1,203 outreach
    events" is the sentence that stops the wrong delete.
    """
    pid = project.id
    counts = {
        "sent_emails": await _count(db, SentEmail, SentEmail.company_id.in_(_company_ids(pid))),
        "import_rows": await _count(db, ImportRow, ImportRow.batch_id.in_(_own_batch_ids(pid))),
        "import_batches": await _count(db, ImportBatch, ImportBatch.project_id == pid),
        "activity_events": await _count(
            db,
            ActivityEvent,
            (ActivityEvent.project_id == pid)
            | (ActivityEvent.company_id.in_(_company_ids(pid))),
        ),
        "tasks": await _count(db, Task, Task.project_id == pid),
        "outreach_events": await _count(
            db, OutreachEvent, OutreachEvent.company_id.in_(_company_ids(pid))
        ),
        "outreach_schedules": await _count(
            db, OutreachSchedule, OutreachSchedule.company_id.in_(_company_ids(pid))
        ),
        "contacts": await _count(db, Contact, Contact.company_id.in_(_company_ids(pid))),
        "sourcing_candidates": await _count(
            db, SourcingCandidate, SourcingCandidate.mandate_id.in_(_mandate_ids(pid))
        ),
        "companies": await _count(db, Company, Company.mandate_id.in_(_mandate_ids(pid))),
        "sourcing_layers": await _count(
            db, SourcingLayer, SourcingLayer.mandate_id.in_(_mandate_ids(pid))
        ),
        "mandate_assignments": await _count(
            db, MandateAssignment, MandateAssignment.mandate_id.in_(_mandate_ids(pid))
        ),
        "project_assignments": await _count(
            db, ProjectAssignment, ProjectAssignment.project_id == pid
        ),
        "mandates": await _count(db, Mandate, Mandate.project_id == pid),
        "projects": 1,
    }
    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "client_name": project.client_name,
            "archived_at": project.archived_at.isoformat() if project.archived_at else None,
        },
        "counts": counts,
        "total": sum(counts.values()),
        # Named in the response, not only in a docstring: the dialog should be able to
        # say what survives as well as what does not.
        "kept": [
            "company_profiles (the firm's company database)",
            "saved_searches",
            "sourcing_stages",
            "company_categories",
            "email configuration",
            "users",
        ],
    }


async def delete_project(db: AsyncSession, project: Project, *, actor) -> dict[str, int]:
    """Run the ordered deletion. One commit at the end, and no try/except.

    A mis-ordered delete on PostgreSQL raises ``ForeignKeyViolation``, the transaction
    rolls back and a 500 comes out with nothing lost. That is a good failure mode; do not
    wrap it in a handler that turns half a delete into a success.
    """
    pid = project.id
    name, client_name = project.name, project.client_name
    firm_id = project.firm_id

    counts_before = (await preview_deletion(db, project))["counts"]

    # The import_rows trap. ``import_batches.project_id`` is nullable — only WORKBOOK
    # batches set it — so a CSV batch with a NULL project_id can hold rows whose
    # ``resolved_company_id`` points into this project. Deleting the company would leave
    # a dangling FK that PostgreSQL rejects. Null the pointers rather than destroying
    # another batch's audit trail.
    await db.execute(
        update(ImportRow)
        .where(
            ImportRow.batch_id.not_in(_own_batch_ids(pid)),
            (ImportRow.resolved_company_id.in_(_company_ids(pid)))
            | (ImportRow.resolved_contact_id.in_(_contact_ids(pid)))
            | (ImportRow.resolved_schedule_id.in_(_schedule_ids(pid))),
        )
        .values(
            resolved_company_id=None,
            resolved_contact_id=None,
            resolved_schedule_id=None,
        )
    )

    deleted: dict[str, int] = {}
    for table, build in _STEPS:
        result = await db.execute(build(pid))
        deleted[table] = result.rowcount if result.rowcount is not None else counts_before.get(table, 0)

    # The tombstone, written AFTER the loop with project_id=NULL. Written before, step 4
    # would delete it. Same transaction, so it lands only if the delete did.
    await activity.log(
        db,
        actor=actor,
        firm_id=firm_id,
        verb=ActivityVerb.PROJECT_DELETED,
        object_type=ActivityObjectType.PROJECT,
        object_id=None,
        object_label=name,
        project_id=None,
        meta={
            "project_id": pid,
            "name": name,
            "client_name": client_name,
            "counts": deleted,
        },
    )
    # Also to the application logger, so the record outlives a later workspace reset —
    # which truncates activity_events along with the rest of the book.
    logger.warning(
        "PROJECT_DELETED project_id=%s name=%r firm_id=%s actor_id=%s counts=%s",
        pid,
        name,
        firm_id,
        getattr(actor, "id", None),
        deleted,
    )

    await db.commit()
    return deleted


__all__ = ["_STEPS", "delete_project", "preview_deletion"]
