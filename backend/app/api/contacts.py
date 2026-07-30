"""Contacts router — firm-scoped person-level CRUD + touch history (L-01/02/03, §6.4)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.core.deps import CurrentUser, SessionDep
from app.models.company import Company
from app.models.company_category import CompanyCategoryVocab
from app.models.contact import Contact
from app.models.enums import Engagement, Sentiment
from app.models.outreach_event import OutreachEvent
from app.models.user import User
from app.schemas.contact import ContactCreate, ContactRead, ContactUpdate
from app.schemas.outreach_event import OutreachEventRead

router = APIRouter(prefix="/contacts", tags=["contacts"])


async def _get_contact(
    contact_id: int,
    firm_id: int,
    db,
    include_archived: bool = False,
) -> Contact:
    q = select(Contact).where(
        Contact.id == contact_id,
        Contact.firm_id == firm_id,
    )
    if not include_archived:
        q = q.where(Contact.archived_at.is_(None))
    result = await db.execute(q)
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


async def _unset_primary(db, company_id: int, exclude_id: int | None = None) -> None:
    """Unset is_primary for all active contacts of a company, except exclude_id."""
    q = select(Contact).where(
        Contact.company_id == company_id,
        Contact.is_primary.is_(True),
        Contact.archived_at.is_(None),
    )
    if exclude_id is not None:
        q = q.where(Contact.id != exclude_id)
    result = await db.execute(q)
    for c in result.scalars().all():
        c.is_primary = False


@router.get("")
async def list_contacts(
    db: SessionDep,
    current_user: CurrentUser,
    q: str | None = Query(default=None),
    company_id: int | None = Query(default=None),
    engagement: Engagement | None = Query(default=None),
    sentiment: Sentiment | None = Query(default=None),
    poc_owner_id: int | None = Query(default=None),
    include_archived: bool = Query(default=False),
):
    """Firm-wide Contact List (§8-E) — the live Excel Contact List with client /
    engagement / POC / sentiment tags, filterable."""
    stmt = select(Contact).where(Contact.firm_id == current_user.firm_id)
    if not include_archived:
        stmt = stmt.where(Contact.archived_at.is_(None))
    if q:
        stmt = stmt.where(Contact.contact_person.ilike(f"%{q}%"))
    if company_id:
        stmt = stmt.where(Contact.company_id == company_id)
    if engagement:
        stmt = stmt.where(Contact.engagement == engagement)
    if sentiment:
        stmt = stmt.where(Contact.sentiment == sentiment)
    if poc_owner_id:
        stmt = stmt.where(Contact.poc_owner_id == poc_owner_id)

    stmt = stmt.order_by(Contact.contact_person)
    contacts = list((await db.execute(stmt)).scalars().all())

    # Batch-resolve company (name + category) and POC owner display fields (no N+1).
    company_ids = {c.company_id for c in contacts}
    poc_ids = {c.poc_owner_id for c in contacts if c.poc_owner_id}
    companies = (
        {
            co.id: co
            for co in (
                await db.execute(select(Company).where(Company.id.in_(company_ids)))
            ).scalars().all()
        }
        if company_ids
        else {}
    )
    cat_ids = {co.category_id for co in companies.values() if co.category_id}
    cats = (
        {
            cat.id: cat.name
            for cat in (
                await db.execute(
                    select(CompanyCategoryVocab).where(CompanyCategoryVocab.id.in_(cat_ids))
                )
            ).scalars().all()
        }
        if cat_ids
        else {}
    )
    pocs = (
        {
            u.id: u.full_name
            for u in (
                await db.execute(select(User).where(User.id.in_(poc_ids)))
            ).scalars().all()
        }
        if poc_ids
        else {}
    )

    items = []
    for c in contacts:
        co = companies.get(c.company_id)
        data = ContactRead.model_validate(c).model_dump()
        data["company_name"] = co.company_name if co else None
        data["category_name"] = cats.get(co.category_id) if co and co.category_id else None
        data["poc_name"] = pocs.get(c.poc_owner_id) if c.poc_owner_id else None
        items.append(data)

    return {"items": items, "total": len(items)}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_contact(body: ContactCreate, db: SessionDep, current_user: CurrentUser):
    # Validate that the company belongs to this firm
    from app.models.company import Company
    company_result = await db.execute(
        select(Company).where(
            Company.id == body.company_id,
            Company.firm_id == current_user.firm_id,
        )
    )
    if not company_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Company not found")

    # Enforce ≤1 primary per company (L-01)
    if body.is_primary:
        await _unset_primary(db, body.company_id)

    contact = Contact(firm_id=current_user.firm_id, **body.model_dump())
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return ContactRead.model_validate(contact).model_dump()


@router.get("/{contact_id}")
async def get_contact(contact_id: int, db: SessionDep, current_user: CurrentUser):
    contact = await _get_contact(contact_id, current_user.firm_id, db)
    data = ContactRead.model_validate(contact).model_dump()

    # Which company this person sits at — same resolved field the list endpoint
    # returns, so the detail page can name (and link) the company.
    company = (
        await db.execute(
            select(Company).where(
                Company.id == contact.company_id,
                Company.firm_id == current_user.firm_id,
            )
        )
    ).scalar_one_or_none()
    data["company_name"] = company.company_name if company else None

    # Chronological touch history from outreach_events (L-03)
    events_result = await db.execute(
        select(OutreachEvent)
        .where(OutreachEvent.contact_id == contact_id)
        .order_by(OutreachEvent.occurred_on.asc(), OutreachEvent.id.asc())
    )
    data["events"] = [
        OutreachEventRead.model_validate(e).model_dump()
        for e in events_result.scalars().all()
    ]
    return data


@router.patch("/{contact_id}")
async def update_contact(
    contact_id: int,
    body: ContactUpdate,
    db: SessionDep,
    current_user: CurrentUser,
):
    contact = await _get_contact(contact_id, current_user.firm_id, db)
    updates = body.model_dump(exclude_unset=True)

    # Enforce ≤1 primary per company when setting is_primary=True (L-01)
    if updates.get("is_primary"):
        await _unset_primary(db, contact.company_id, exclude_id=contact_id)

    for field, val in updates.items():
        setattr(contact, field, val)

    await db.commit()
    await db.refresh(contact)
    return ContactRead.model_validate(contact).model_dump()


@router.delete("/{contact_id}", status_code=status.HTTP_200_OK)
async def archive_contact(contact_id: int, db: SessionDep, current_user: CurrentUser):
    """Soft delete — sets archived_at."""
    contact = await _get_contact(contact_id, current_user.firm_id, db)
    contact.archived_at = datetime.now(timezone.utc)
    await db.commit()
    return {"detail": "Contact archived"}


@router.post("/{contact_id}/unarchive", status_code=status.HTTP_200_OK)
async def unarchive_contact(contact_id: int, db: SessionDep, current_user: CurrentUser):
    """Restore a soft-deleted contact (clears archived_at)."""
    contact = await _get_contact(contact_id, current_user.firm_id, db, include_archived=True)
    contact.archived_at = None
    await db.commit()
    await db.refresh(contact)
    return ContactRead.model_validate(contact).model_dump()
