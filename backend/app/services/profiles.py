"""Company-profile service — the firm-wide shared record bridge (§8-A).

Owns the upsert/enrich/propagate logic that makes "one company record, enriched by
all analysts" real without any FK moves on schedules/events/contacts:

- ``upsert_profile`` finds-or-creates the firm's shared profile for a set of static
  facts, enriching it latest-non-null-wins.
- ``propagate_profile_to_companies`` syncs every per-mandate company's cache columns
  from its profile, so a colleague's edit to Trunorth's revenue shows on every
  engagement.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.company_profile import CompanyProfile
from app.services.cross_mandate import extract_domain, normalise_name

# Facts that live on the shared profile (the company row keeps them as a synced cache).
STATIC_FACT_FIELDS = (
    "company_name",
    "hq",
    "website",
    "linkedin",
    "headcount",
    "revenue_source",
    "revenue_inr_cr",
)

# Pool classification — profile-only, so deliberately NOT in STATIC_FACT_FIELDS (there is
# no matching column on ``companies`` to cache it into). Fill-if-empty rather than
# latest-wins: these describe where a company was *researched from*, so the first source
# to classify it wins and a later import can only fill a gap, never relabel it.
CLASSIFICATION_FIELDS = ("segment", "sector")


def compute_name_key(company_name: str) -> str:
    return normalise_name(company_name)


def compute_domain_key(website: str | None) -> str | None:
    return extract_domain(website)


async def upsert_profile(
    db: AsyncSession, firm_id: int, facts: dict, *, enrich: bool = True
) -> CompanyProfile:
    """Find-or-create the firm's shared profile for ``facts`` and enrich it.

    Matching precedence: same firm + same ``domain_key`` (when a website is present),
    else same firm + same ``name_key``. When ``enrich`` is True, any non-null fact
    provided updates the profile (latest-wins); nulls never clobber existing facts.
    """
    name = facts.get("company_name") or ""
    name_key = compute_name_key(name)
    domain_key = compute_domain_key(facts.get("website"))

    profile: CompanyProfile | None = None
    if domain_key:
        profile = (
            await db.execute(
                select(CompanyProfile).where(
                    CompanyProfile.firm_id == firm_id,
                    CompanyProfile.domain_key == domain_key,
                    CompanyProfile.archived_at.is_(None),
                )
            )
        ).scalar_one_or_none()
    if profile is None and name_key:
        profile = (
            await db.execute(
                select(CompanyProfile).where(
                    CompanyProfile.firm_id == firm_id,
                    CompanyProfile.name_key == name_key,
                    CompanyProfile.archived_at.is_(None),
                )
            )
        ).scalar_one_or_none()

    if profile is None:
        profile = CompanyProfile(
            firm_id=firm_id,
            company_name=name,
            name_key=name_key,
            domain_key=domain_key,
        )
        for field in (*STATIC_FACT_FIELDS, *CLASSIFICATION_FIELDS):
            if field == "company_name":
                continue
            setattr(profile, field, facts.get(field))
        db.add(profile)
        await db.flush()
        return profile

    if enrich:
        changed = False
        for field in STATIC_FACT_FIELDS:
            val = facts.get(field)
            if val is not None and getattr(profile, field) != val:
                setattr(profile, field, val)
                changed = True
        for field in CLASSIFICATION_FIELDS:
            val = facts.get(field)
            if val is not None and getattr(profile, field) is None:
                setattr(profile, field, val)
        # Keep normalised keys fresh when the name/website change.
        if changed:
            profile.name_key = compute_name_key(profile.company_name or "")
            if profile.website:
                profile.domain_key = compute_domain_key(profile.website)
            await db.flush()
    return profile


def sync_company_from_profile(company: Company, profile: CompanyProfile) -> None:
    """Copy the profile's static facts onto a company's cache columns."""
    for field in STATIC_FACT_FIELDS:
        setattr(company, field, getattr(profile, field))


async def propagate_profile_to_companies(
    db: AsyncSession, profile: CompanyProfile
) -> None:
    """Sync every per-mandate company sharing this profile from the profile's facts."""
    rows = await db.execute(
        select(Company).where(
            Company.profile_id == profile.id,
            Company.archived_at.is_(None),
        )
    )
    for company in rows.scalars().all():
        sync_company_from_profile(company, profile)
