"""Seed the firm's standing sourcing database — real companies only, always additive.

The pool (``company_profiles``) is the firm's inventory: what an analyst searches *before*
a deal exists. It is deliberately independent of any mandate, so it is seeded separately
from client engagements and grows from three places, all of which land here:

1. ``pool_dataset`` — real public companies in the firm's deal space, name/HQ/website only.
2. The client workbooks' **research long-lists** (`PE names`, `Remaining PE companies`) —
   the tabs the workbook importer deliberately leaves alone because they are staging, not
   an active master sheet. This is exactly where they belong.
3. The client workbooks' **master sheets** — so every company the firm has ever worked is
   searchable in the pool even before its project is imported.

Every write goes through ``upsert_profile`` (domain-then-name blocking), so running this
twice, or running it after the workbook import, adds nothing it already has. Later
`/import` runs enrich the same records rather than duplicating them.

    python -m app.seed.sourcing_pool                  # dataset + phase_2 workbooks
    python -m app.seed.sourcing_pool --no-workbooks   # dataset only
"""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.company_profile import CompanyProfile
from app.models.firm import Firm
from app.seed import pool_dataset
from app.services.profiles import upsert_profile
from app.services.workbook_parse import (
    CONTACTS,
    LONGLIST,
    MASTER,
    as_int,
    as_revenue,
    clean_text,
    parse_workbook,
)

WORKBOOK_DIR = Path(__file__).resolve().parents[3] / "phase_2"


def workbook_rows(directory: Path = WORKBOOK_DIR) -> list[dict]:
    """Every company on every master sheet and research long-list, as profile facts.

    Contact-list tabs are skipped: their `Company` column is a person's employer, not a
    researched company record, and it arrives properly through the workbook importer.
    """
    out: list[dict] = []
    if not directory.exists():
        return out
    for path in sorted(directory.glob("*.xlsx")):
        parsed = parse_workbook(path.read_bytes(), path.name)
        for shape in parsed.sheets:
            if shape.kind not in (MASTER, LONGLIST) or shape.kind == CONTACTS:
                continue
            for row in parsed.rows_by_sheet.get(shape.title, []):
                name = clean_text(row.get("company_name"))
                if not name:
                    continue
                out.append(
                    {
                        "company_name": name,
                        "hq": clean_text(row.get("hq")),
                        "website": clean_text(row.get("website")),
                        "linkedin": None,
                        "headcount": as_int(row.get("headcount")),
                        "revenue_source": clean_text(row.get("revenue_source")),
                        "revenue_inr_cr": as_revenue(row.get("revenue_inr_cr")),
                        "_source": f"{path.name} · {shape.title}",
                    }
                )
    return out


async def seed_pool(
    db: AsyncSession, firm_id: int, *, include_workbooks: bool = True
) -> dict:
    """Upsert the dataset (and optionally the workbooks) into the firm's pool."""
    before = (
        await db.execute(
            select(func.count()).select_from(CompanyProfile).where(
                CompanyProfile.firm_id == firm_id
            )
        )
    ).scalar() or 0

    dataset = pool_dataset.rows()
    for facts in dataset:
        await upsert_profile(db, firm_id, {k: v for k, v in facts.items() if not k.startswith("_")})

    wb_rows = workbook_rows() if include_workbooks else []
    for facts in wb_rows:
        await upsert_profile(db, firm_id, {k: v for k, v in facts.items() if not k.startswith("_")})

    await db.commit()
    after = (
        await db.execute(
            select(func.count()).select_from(CompanyProfile).where(
                CompanyProfile.firm_id == firm_id
            )
        )
    ).scalar() or 0
    return {
        "dataset_rows": len(dataset),
        "workbook_rows": len(wb_rows),
        "pool_before": before,
        "pool_after": after,
        "added": after - before,
    }


async def _main(include_workbooks: bool, firm_name: str | None) -> None:
    engine = create_async_engine(settings.database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        q = select(Firm).order_by(Firm.id)
        if firm_name:
            q = q.where(Firm.name == firm_name)
        firm = (await db.execute(q)).scalars().first()
        if firm is None:
            raise SystemExit("No firm found — run `python -m app.seed.bootstrap` first.")
        result = await seed_pool(db, firm.id, include_workbooks=include_workbooks)
    await engine.dispose()

    print(f"Sourcing pool seeded for '{firm.name}':")
    print(f"  researched companies : {result['dataset_rows']}")
    print(f"  workbook companies   : {result['workbook_rows']}")
    print(
        f"  pool {result['pool_before']} -> {result['pool_after']} "
        f"(+{result['added']} new, rest already known)"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the firm-wide sourcing pool.")
    parser.add_argument("--no-workbooks", action="store_true", help="Dataset only.")
    parser.add_argument("--firm", default=None, help="Firm name (default: the first one).")
    args = parser.parse_args()
    asyncio.run(_main(not args.no_workbooks, args.firm))


if __name__ == "__main__":
    main()
