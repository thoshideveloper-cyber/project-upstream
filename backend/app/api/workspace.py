"""Workspace router — what this firm holds, and how to start its book over.

A firm *is* the workspace. Everything below the firm is one of three things:

* **configuration** — users, category vocabulary, funnel stages, data sources, mailboxes
  and templates: what the firm decided, not what it did;
* **the company database** — ``company_profiles``, the standing research pool that ships
  pre-filled with real organisations and grows with every import;
* **the book** — projects, engagements, companies, contacts, schedules, the outreach event
  log, import batches: all of it produced by uploading the firm's workbooks.

``POST /workspace/reset`` removes exactly the third group, so the same workbooks (or
corrected ones) can be re-imported into a clean firm without touching configuration or
losing the database. That is a deliberate exception to the app's soft-delete rule
(``CLAUDE.md`` 6): ``archived_at`` exists to preserve the memory of outreach that really
happened, whereas this endpoint exists to undo an import that should not have. It is
irreversible, partner-only, and requires the firm's own name back as confirmation.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, func, select

from app.core.deps import CurrentUser, PartnerDep, SessionDep
from app.models.activity_event import ActivityEvent
from app.models.company import Company
from app.models.company_category import CompanyCategoryVocab
from app.models.company_profile import CompanyProfile
from app.models.contact import Contact
from app.models.data_source_config import DataSourceConfig
from app.models.email_template import EmailTemplate
from app.models.firm import Firm
from app.models.import_batch import ImportBatch
from app.models.import_row import ImportRow
from app.models.mandate import Mandate
from app.models.mandate_assignment import MandateAssignment
from app.models.outreach_event import OutreachEvent
from app.models.outreach_schedule import OutreachSchedule
from app.models.project import Project
from app.models.project_assignment import ProjectAssignment
from app.models.saved_search import SavedSearch
from app.models.sent_email import SentEmail
from app.models.sourcing_candidate import SourcingCandidate
from app.models.sourcing_layer import SourcingLayer
from app.models.sourcing_stage import SourcingStage
from app.models.task import Task
from app.models.user import User

router = APIRouter(prefix="/workspace", tags=["workspace"])


class ResetRequest(BaseModel):
    confirm_firm_name: str


# The book, children first. SQLite enforces the FKs these tables declare, so the order is
# load-bearing: ``import_rows`` points at companies/contacts/schedules, ``sent_emails`` at
# outreach events, and ``companies`` at its sourcing layer — a company must therefore be
# deleted *before* the layer it sits in, not after.
_BOOK: list[tuple[str, type]] = [
    ("sent_emails", SentEmail),
    ("import_rows", ImportRow),
    ("import_batches", ImportBatch),
    # Both point at projects/companies/mandates, so both die before them. ``activity_events``
    # is book-tier on purpose: it records what an import did, and a reset undoes the import.
    # That is also why WORKSPACE_RESET itself can never be logged here -- the row would be
    # deleted by the very action it records; it goes to the application logger instead.
    ("activity_events", ActivityEvent),
    ("tasks", Task),
    ("outreach_events", OutreachEvent),
    ("outreach_schedules", OutreachSchedule),
    ("contacts", Contact),
    ("sourcing_candidates", SourcingCandidate),
    ("companies", Company),
    ("sourcing_layers", SourcingLayer),
    ("mandate_assignments", MandateAssignment),
    ("mandates", Mandate),
    ("saved_searches", SavedSearch),
    ("project_assignments", ProjectAssignment),
    ("projects", Project),
]


def _firm_scope(model: type, firm_id: int):
    """A WHERE clause restricting ``model`` to one firm.

    Three tables carry no ``firm_id`` — they are reached through the parent that does,
    which is also what keeps a reset from ever crossing a tenant boundary.
    """
    if model is ImportRow:
        return ImportRow.batch_id.in_(
            select(ImportBatch.id).where(ImportBatch.firm_id == firm_id)
        )
    if model is MandateAssignment:
        return MandateAssignment.mandate_id.in_(
            select(Mandate.id).where(Mandate.firm_id == firm_id)
        )
    if model is ProjectAssignment:
        return ProjectAssignment.project_id.in_(
            select(Project.id).where(Project.firm_id == firm_id)
        )
    return model.firm_id == firm_id


async def _count(db, model: type, firm_id: int) -> int:
    return (
        await db.execute(
            select(func.count()).select_from(model).where(_firm_scope(model, firm_id))
        )
    ).scalar() or 0


async def _firm_name(db, firm_id: int) -> str:
    """The firm's name, fetched rather than walked.

    ``current_user`` arrives without its ``firm`` relationship loaded, and touching it on
    an async session raises rather than lazy-loading.
    """
    return (
        await db.execute(select(Firm.name).where(Firm.id == firm_id))
    ).scalar_one()


async def _database_size(db, firm_id: int) -> int:
    return (
        await db.execute(
            select(func.count())
            .select_from(CompanyProfile)
            .where(
                CompanyProfile.firm_id == firm_id,
                CompanyProfile.archived_at.is_(None),
            )
        )
    ).scalar() or 0


@router.get("")
async def read_workspace(db: SessionDep, current_user: CurrentUser):
    """What this firm holds right now — the book, the database, the configuration.

    Read-only and cheap (count-only group of scalar sub-selects). The settings screen uses
    it to state what a reset would remove before anyone confirms one.
    """
    firm_id = current_user.firm_id
    book = {name: await _count(db, model, firm_id) for name, model in _BOOK}
    return {
        "firm": {"id": firm_id, "name": await _firm_name(db, firm_id)},
        # Distinguished from the book on purpose: this is the one thing a reset keeps.
        "database": {"companies": await _database_size(db, firm_id)},
        "book": book,
        "book_total": sum(book.values()),
        "config": {
            "users": await _count(db, User, firm_id),
            "categories": await _count(db, CompanyCategoryVocab, firm_id),
            "stages": await _count(db, SourcingStage, firm_id),
            "data_sources": await _count(db, DataSourceConfig, firm_id),
            "email_templates": await _count(db, EmailTemplate, firm_id),
        },
    }


@router.post("/reset", status_code=status.HTTP_200_OK)
async def reset_workspace(body: ResetRequest, db: SessionDep, current_user: PartnerDep):
    """Delete this firm's imported book. Keeps users, configuration and the database.

    Partner-only and name-confirmed: it is the one destructive action in the app, and the
    thing it destroys is a colleague's work as much as your own.
    """
    firm_id = current_user.firm_id
    firm_name = await _firm_name(db, firm_id)
    if body.confirm_firm_name.strip() != firm_name:
        raise HTTPException(
            status_code=422,
            detail=f"Type the firm's name exactly ({firm_name}) to confirm the reset.",
        )

    deleted: dict[str, int] = {}
    for name, model in _BOOK:
        count = await _count(db, model, firm_id)
        if count:
            await db.execute(delete(model).where(_firm_scope(model, firm_id)))
        deleted[name] = count
    await db.commit()

    return {
        "reset": True,
        "firm": firm_name,
        "deleted": deleted,
        "deleted_total": sum(deleted.values()),
        "kept": {
            "database_companies": await _database_size(db, firm_id),
            "users": await _count(db, User, firm_id),
        },
    }
