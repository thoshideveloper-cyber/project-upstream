"""Classification service — firm-configurable category vocabulary + sourcing layers.

Central home for the two-axis classification model (Phase 2a §7):
  - Axis 1: firm-scoped ``company_categories`` vocabulary (source of truth).
  - Axis 2: per-engagement ordered ``sourcing_layers``.

Also owns the mapping between the legacy ``CompanyCategory`` enum (kept only as a
derived read-cache on ``companies.category``) and the new vocabulary ``code``, so the
enum → vocab cutover and the reverse cache-write both use one definition.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company_category import CompanyCategoryVocab
from app.models.enums import CompanyCategory, MandateType
from app.models.sourcing_layer import SourcingLayer

# ── Default firm category vocabulary ──────────────────────────────────────────
# (code, display name, sort_order). Seeded from Phase 8's enum values PLUS the
# real Excel codes the enum could not express (PMS, Private Credit, Investment
# Bank, Holding/Corporate). FINANCIAL_SPONSOR folds into Private Equity.
DEFAULT_CATEGORIES: list[tuple[str, str, int]] = [
    ("STRATEGIC", "Strategic", 10),
    ("PRIVATE_EQUITY", "Private Equity", 20),
    ("VENTURE_CAPITAL", "Venture Capital", 30),
    ("FAMILY_OFFICE", "Family Office", 40),
    ("PMS", "PMS", 50),
    ("PRIVATE_CREDIT", "Private Credit", 60),
    ("INVESTMENT_BANK", "Investment Bank", 70),
    ("HOLDING_CORPORATE", "Holding / Corporate", 80),
    ("OTHER", "Other", 999),
]

# Legacy enum value → new vocabulary code (used by the A1 migration backfill).
LEGACY_ENUM_TO_CODE: dict[str, str] = {
    CompanyCategory.STRATEGIC.value: "STRATEGIC",
    CompanyCategory.PRIVATE_EQUITY.value: "PRIVATE_EQUITY",
    CompanyCategory.VENTURE_CAPITAL.value: "VENTURE_CAPITAL",
    CompanyCategory.FAMILY_OFFICE.value: "FAMILY_OFFICE",
    CompanyCategory.FINANCIAL_SPONSOR.value: "PRIVATE_EQUITY",
    CompanyCategory.OTHER.value: "OTHER",
}

# New vocabulary code → legacy enum (single-writer cache on companies.category).
# Codes with no legacy equivalent collapse to OTHER — the enum is legacy only.
CODE_TO_LEGACY_ENUM: dict[str, CompanyCategory] = {
    "STRATEGIC": CompanyCategory.STRATEGIC,
    "PRIVATE_EQUITY": CompanyCategory.PRIVATE_EQUITY,
    "VENTURE_CAPITAL": CompanyCategory.VENTURE_CAPITAL,
    "FAMILY_OFFICE": CompanyCategory.FAMILY_OFFICE,
}


def legacy_category_for_code(code: str | None) -> CompanyCategory:
    """Map a vocabulary code to the legacy enum for the derived cache column."""
    if not code:
        return CompanyCategory.OTHER
    return CODE_TO_LEGACY_ENUM.get(code, CompanyCategory.OTHER)


# ── Default per-engagement sourcing layers ────────────────────────────────────
# Sensible starters the analyst can rename/reorder/add to; empty = fresh deal.
DEFAULT_LAYERS_BY_TYPE: dict[MandateType, list[str]] = {
    MandateType.CAPITAL_RAISE: ["Direct", "Secondary", "Strategics"],
    MandateType.SELL_SIDE: ["Strategic buyers", "Financial buyers"],
    MandateType.BUY_SIDE: ["Primary targets", "Secondary targets"],
}


async def seed_firm_categories(db: AsyncSession, firm_id: int) -> list[CompanyCategoryVocab]:
    """Idempotently seed the default category vocabulary for a firm.

    Returns the firm's full (post-seed) category list. Only inserts codes that do
    not already exist so it is safe to call on every firm creation.
    """
    existing = await db.execute(
        select(CompanyCategoryVocab.code).where(CompanyCategoryVocab.firm_id == firm_id)
    )
    existing_codes = {row[0] for row in existing.all()}
    for code, name, sort_order in DEFAULT_CATEGORIES:
        if code in existing_codes:
            continue
        db.add(
            CompanyCategoryVocab(
                firm_id=firm_id, name=name, code=code, sort_order=sort_order
            )
        )
    await db.flush()
    result = await db.execute(
        select(CompanyCategoryVocab)
        .where(CompanyCategoryVocab.firm_id == firm_id)
        .order_by(CompanyCategoryVocab.sort_order, CompanyCategoryVocab.name)
    )
    return list(result.scalars().all())


async def seed_mandate_layers(
    db: AsyncSession, firm_id: int, mandate_id: int, mandate_type: MandateType
) -> list[SourcingLayer]:
    """Seed the default sourcing layers for a newly created engagement.

    No-op if the engagement already has layers (idempotent). Returns nothing if
    the type has no default set.
    """
    existing = await db.execute(
        select(SourcingLayer.id).where(SourcingLayer.mandate_id == mandate_id).limit(1)
    )
    if existing.first() is not None:
        return []
    created: list[SourcingLayer] = []
    for i, name in enumerate(DEFAULT_LAYERS_BY_TYPE.get(mandate_type, [])):
        layer = SourcingLayer(
            firm_id=firm_id, mandate_id=mandate_id, name=name, sort_order=(i + 1) * 10
        )
        db.add(layer)
        created.append(layer)
    await db.flush()
    return created
