"""The standing company pool — the one thing a new firm is not empty of.

Every other surface of the app starts blank and fills from the workbooks a firm uploads
(that is the product: their spreadsheets, connected). Discover is the exception, because
a company *database* with nothing in it cannot be searched, and searching before a deal
exists is the whole point of the screen. So firm creation plants the shipped dataset
(``app/data/company_pool.py`` — real organisations, verified name/HQ/domain) into the new
firm's pool and stops there: no deals, no contacts, no schedules, no invented revenue.

Per-firm rather than shared, deliberately. Everything in this app is firm-scoped
(``CLAUDE.md`` rule 5) and the pool is a *working* record — analysts enrich it, imports
merge into it, ``archived_at`` hides rows from it. One shared global table would make one
firm's edits visible to another; a copy per firm keeps the tenant boundary intact and
costs 164 rows.

Idempotent: every write goes through ``upsert_profile``'s domain-then-name blocking, so
re-running adds only what is missing and never duplicates a company an import already
brought in under the same domain.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.data import company_pool
from app.models.company_profile import CompanyProfile
from app.services.profiles import (
    CLASSIFICATION_FIELDS,
    STATIC_FACT_FIELDS,
    compute_domain_key,
    compute_name_key,
    upsert_profile,
)


async def pool_size(db: AsyncSession, firm_id: int) -> int:
    """How many live companies the firm's database holds."""
    return (
        await db.execute(
            select(func.count())
            .select_from(CompanyProfile)
            .where(CompanyProfile.firm_id == firm_id, CompanyProfile.archived_at.is_(None))
        )
    ).scalar() or 0


async def seed_firm_pool(db: AsyncSession, firm_id: int) -> dict:
    """Plant (or top up) the shipped company database for one firm.

    Does not commit — the caller owns the transaction, so signup stays atomic: a firm
    either exists with its database or does not exist at all.
    """
    before = await pool_size(db, firm_id)
    dataset = company_pool.rows()
    for facts in dataset:
        await upsert_profile(db, firm_id, facts)
    after = await pool_size(db, firm_id)
    return {
        "dataset_rows": len(dataset),
        "pool_before": before,
        "pool_after": after,
        "added": after - before,
    }


def seed_firm_pool_sync(session: Session, firm_id: int) -> dict:
    """The same planting, on a plain synchronous Session.

    ``bootstrap`` is a sync script — it creates tables and writes the firm through a
    regular Session — and reaching for the async engine there cost it an asyncio loop plus
    a hard dependency on greenlet, whose C extension is not loadable in every shell a
    one-off `railway ssh` lands in. Nothing about planting 164 rows needs to be async.

    The dedupe *policy* is not duplicated: both paths block on ``compute_domain_key`` then
    ``compute_name_key`` and copy the same field lists. Only the session dialect differs.
    """
    before = (
        session.execute(
            select(func.count())
            .select_from(CompanyProfile)
            .where(CompanyProfile.firm_id == firm_id, CompanyProfile.archived_at.is_(None))
        ).scalar()
        or 0
    )

    dataset = company_pool.rows()
    for facts in dataset:
        name = facts.get("company_name") or ""
        name_key = compute_name_key(name)
        domain_key = compute_domain_key(facts.get("website"))

        profile: CompanyProfile | None = None
        if domain_key:
            profile = session.execute(
                select(CompanyProfile).where(
                    CompanyProfile.firm_id == firm_id,
                    CompanyProfile.domain_key == domain_key,
                    CompanyProfile.archived_at.is_(None),
                )
            ).scalar_one_or_none()
        if profile is None and name_key:
            profile = session.execute(
                select(CompanyProfile).where(
                    CompanyProfile.firm_id == firm_id,
                    CompanyProfile.name_key == name_key,
                    CompanyProfile.archived_at.is_(None),
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
                if field != "company_name":
                    setattr(profile, field, facts.get(field))
            session.add(profile)
            continue

        # Known company: enrich the gaps, never relabel what a source already asserted.
        for field in STATIC_FACT_FIELDS:
            value = facts.get(field)
            if value is not None and getattr(profile, field) != value:
                setattr(profile, field, value)
        for field in CLASSIFICATION_FIELDS:
            value = facts.get(field)
            if value is not None and getattr(profile, field) is None:
                setattr(profile, field, value)

    session.flush()
    after = (
        session.execute(
            select(func.count())
            .select_from(CompanyProfile)
            .where(CompanyProfile.firm_id == firm_id, CompanyProfile.archived_at.is_(None))
        ).scalar()
        or 0
    )
    return {
        "dataset_rows": len(dataset),
        "pool_before": before,
        "pool_after": after,
        "added": after - before,
    }
