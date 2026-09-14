"""Top up a firm's standing company database — real companies only, always additive.

Firm creation already plants this (``app.services.pool.seed_firm_pool``, called by signup
and by ``app.seed.bootstrap``), so this script is the *re-run*: use it after the shipped
dataset grows, or to repair a firm whose pool was emptied.

The pool (``company_profiles``) is the firm's inventory: what an analyst searches *before*
a deal exists, and the only part of the app that is not blank on day one. It grows from:

1. ``app/data/company_pool.py`` — the shipped dataset of real organisations
   (name / HQ / domain / segment / sector, all verified; no invented revenue).
2. Client workbooks, through ``/import`` — every master sheet and research long-list an
   analyst applies merges into the same records. That path is the product, so it is off
   here by default; ``--workbooks`` replays the local ``phase_2/`` files for testing.

Every write goes through ``upsert_profile`` (domain-then-name blocking), so running this
twice, or running it after a workbook import, adds nothing it already has.

    python -m app.seed.sourcing_pool               # shipped dataset only
    python -m app.seed.sourcing_pool --workbooks   # + the local phase_2/ workbooks
"""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.firm import Firm
from app.services.pool import pool_size, seed_firm_pool
from app.services.profiles import upsert_profile
from app.services.workbook_parse import (
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
            if shape.kind not in (MASTER, LONGLIST):
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
                    }
                )
    return out


async def seed_pool(
    db: AsyncSession, firm_id: int, *, include_workbooks: bool = False
) -> dict:
    """Upsert the shipped dataset (and optionally local workbooks) into the firm's pool."""
    result = await seed_firm_pool(db, firm_id)

    wb_rows = workbook_rows() if include_workbooks else []
    for facts in wb_rows:
        await upsert_profile(db, firm_id, facts)

    await db.commit()
    after = await pool_size(db, firm_id)
    return {
        **result,
        "workbook_rows": len(wb_rows),
        "pool_after": after,
        "added": after - result["pool_before"],
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
        name = firm.name
    await engine.dispose()

    print(f"Company database topped up for '{name}':")
    print(f"  shipped dataset      : {result['dataset_rows']}")
    print(f"  workbook companies   : {result['workbook_rows']}")
    print(
        f"  pool {result['pool_before']} -> {result['pool_after']} "
        f"(+{result['added']} new, rest already known)"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Top up the firm-wide company database.")
    parser.add_argument(
        "--workbooks",
        action="store_true",
        help="Also merge the local phase_2/ workbooks (testing shortcut).",
    )
    parser.add_argument("--firm", default=None, help="Firm name (default: the first one).")
    args = parser.parse_args()
    asyncio.run(_main(args.workbooks, args.firm))


if __name__ == "__main__":
    main()
