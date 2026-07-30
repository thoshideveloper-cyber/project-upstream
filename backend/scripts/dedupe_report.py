"""Read-only dry-run dedupe report for the company-profile bridge (§8-A step 1).

Prints the proposed profile clusters (companies that would merge into one shared
record) and flags conflicting facts a human should review BEFORE trusting the A2
backfill. Never writes anything.

Usage:
    python -m scripts.dedupe_report          # report over the configured DATABASE_URL
"""

from __future__ import annotations

import asyncio
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.company import Company
from app.services.cross_mandate import extract_domain, normalise_name

_CONFLICT_FIELDS = ("hq", "website", "headcount", "revenue_inr_cr")


async def _run() -> None:
    engine = create_async_engine(settings.database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        rows = (
            await db.execute(select(Company).where(Company.archived_at.is_(None)))
        ).scalars().all()

    clusters: dict[tuple, list[Company]] = defaultdict(list)
    for c in rows:
        dk = extract_domain(c.website)
        key = (c.firm_id, ("d", dk) if dk else ("n", normalise_name(c.company_name or "")))
        clusters[key].append(c)

    merges = {k: v for k, v in clusters.items() if len(v) > 1}
    print(f"Companies scanned: {len(rows)}")
    print(f"Distinct profiles proposed: {len(clusters)}")
    print(f"Multi-company clusters (merges): {len(merges)}\n")

    for (firm_id, key), members in sorted(merges.items(), key=lambda kv: -len(kv[1])):
        names = ", ".join(sorted({m.company_name for m in members}))
        print(f"[firm {firm_id}] {key[1]}  ({len(members)} rows): {names}")
        for field in _CONFLICT_FIELDS:
            vals = {getattr(m, field) for m in members if getattr(m, field) is not None}
            if len(vals) > 1:
                print(f"    ⚠ conflicting {field}: {sorted(map(str, vals))}")
        print()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(_run())
