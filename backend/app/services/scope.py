"""Walk an attachment up to its project, validating every hop stays inside the firm.

A caller says "on company 12" and this resolves the rest of the chain
(``contact -> company -> mandate -> project``). It lives in its own module so
``services/activity.py`` and ``services/tasks.py`` never have to import one another.

Both of them need it for the same reason: ``project_id`` is denormalised onto tasks and
activity rows, which is what makes the sidebar counts one ``GROUP BY`` and the project
delete cascade one predicate. Denormalisation is only safe if it is computed in exactly
one place.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.contact import Contact
from app.models.enums import TaskScope
from app.models.mandate import Mandate
from app.models.project import Project


@dataclass(frozen=True)
class ScopeChain:
    """A resolved attachment: the scope the caller meant, plus every id above it."""

    scope: TaskScope
    project_id: int | None
    mandate_id: int | None
    company_id: int | None
    contact_id: int | None
    label: str | None
    object_type: str | None
    object_id: int | None


async def resolve_scope(
    db: AsyncSession,
    firm_id: int,
    *,
    project_id: int | None = None,
    mandate_id: int | None = None,
    company_id: int | None = None,
    contact_id: int | None = None,
) -> ScopeChain:
    """Resolve the deepest supplied attachment into a full chain.

    Precedence is deepest-first (contact, then company, then mandate, then project), so a
    caller that helpfully sends both a company and its mandate still gets ``COMPANY``.
    Supplying nothing yields ``PERSONAL`` with every id ``None``.

    Raises 404 for anything outside ``firm_id`` — the same shape the routers use, so a
    cross-firm id is indistinguishable from a missing one. Note this checks *tenancy*,
    not visibility: the routers still run their own ``_get_visible_*`` helper, which is
    what enforces CLAUDE.md rule 5.

    A dangling parent (a company whose mandate has no project) raises 422 rather than
    silently producing a ``project_id`` of ``None``, which would make a scoped task
    invisible to every project view and violate ``ck_tasks_scope_consistent``.
    """
    if contact_id is not None:
        contact = (
            await db.execute(
                select(Contact).where(
                    Contact.id == contact_id, Contact.firm_id == firm_id
                )
            )
        ).scalar_one_or_none()
        if contact is None:
            raise HTTPException(status_code=404, detail="Contact not found")
        chain = await resolve_scope(db, firm_id, company_id=contact.company_id)
        return ScopeChain(
            scope=TaskScope.CONTACT,
            project_id=chain.project_id,
            mandate_id=chain.mandate_id,
            company_id=contact.company_id,
            contact_id=contact.id,
            label=contact.contact_person,
            object_type="CONTACT",
            object_id=contact.id,
        )

    if company_id is not None:
        company = (
            await db.execute(
                select(Company).where(
                    Company.id == company_id, Company.firm_id == firm_id
                )
            )
        ).scalar_one_or_none()
        if company is None:
            raise HTTPException(status_code=404, detail="Company not found")
        chain = await resolve_scope(db, firm_id, mandate_id=company.mandate_id)
        return ScopeChain(
            scope=TaskScope.COMPANY,
            project_id=chain.project_id,
            mandate_id=company.mandate_id,
            company_id=company.id,
            contact_id=None,
            label=company.company_name,
            object_type="COMPANY",
            object_id=company.id,
        )

    if mandate_id is not None:
        mandate = (
            await db.execute(
                select(Mandate).where(
                    Mandate.id == mandate_id, Mandate.firm_id == firm_id
                )
            )
        ).scalar_one_or_none()
        if mandate is None:
            raise HTTPException(status_code=404, detail="Mandate not found")
        if mandate.project_id is None:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Engagement '{mandate.name}' is not filed under a project, so work "
                    "cannot be attached to it yet."
                ),
            )
        return ScopeChain(
            scope=TaskScope.MANDATE,
            project_id=mandate.project_id,
            mandate_id=mandate.id,
            company_id=None,
            contact_id=None,
            label=mandate.name,
            object_type="MANDATE",
            object_id=mandate.id,
        )

    if project_id is not None:
        project = (
            await db.execute(
                select(Project).where(
                    Project.id == project_id, Project.firm_id == firm_id
                )
            )
        ).scalar_one_or_none()
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        return ScopeChain(
            scope=TaskScope.PROJECT,
            project_id=project.id,
            mandate_id=None,
            company_id=None,
            contact_id=None,
            label=project.name,
            object_type="PROJECT",
            object_id=project.id,
        )

    return ScopeChain(
        scope=TaskScope.PERSONAL,
        project_id=None,
        mandate_id=None,
        company_id=None,
        contact_id=None,
        label=None,
        object_type=None,
        object_id=None,
    )
