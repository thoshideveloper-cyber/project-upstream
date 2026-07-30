"""Bulk-load the firm's proprietary company/contact export into the pool.

Runs the SAME idempotent pipeline as the CSV wizard (parse → map → dedup preview →
upsert into ``company_profiles``). Dry-run first — it prints the dedup preview and writes
nothing until you pass ``--apply``.

Usage:
    python -m scripts.import_ib_db --firm-id 1 --file targets.csv            # dry-run
    python -m scripts.import_ib_db --firm-id 1 --file targets.csv --apply    # commit
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
from pathlib import Path

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.enums import ImportSource, ImportStatus
from app.models.import_batch import ImportBatch
from app.models.import_row import ImportRow
from app.services.imports import (
    apply_import,
    decode_bytes,
    dedup_preview,
    parse_csv,
    suggest_mapping,
)


async def _run(firm_id: int, file_path: str, apply: bool) -> None:
    raw = Path(file_path).read_bytes()
    text = decode_bytes(raw)
    headers, rows = parse_csv(text)
    mapping = suggest_mapping(headers)

    print(f"File: {file_path}  ·  rows: {len(rows)}  ·  headers: {headers}")
    print(f"Suggested mapping: {mapping}\n")

    engine = create_async_engine(settings.database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        preview = await dedup_preview(db, firm_id, rows, mapping)
        c = preview["counts"]
        print(
            f"Dedup preview — create: {c['create']}, update(merge): {c['update']}, "
            f"error: {c['error']}"
        )
        for cluster in preview["clusters"]:
            print(f"    intra-file merge {cluster['key']}: rows {cluster['row_indices']}")

        if not apply:
            print("\nDRY-RUN — nothing written. Re-run with --apply to commit.")
            await engine.dispose()
            return

        batch = ImportBatch(
            firm_id=firm_id,
            source=ImportSource.IB_DB,
            filename=Path(file_path).name,
            file_hash=hashlib.sha256(raw).hexdigest(),
            mapping=mapping,
            row_count=len(rows),
            status=ImportStatus.PREVIEWED,
        )
        db.add(batch)
        await db.flush()
        row_models = []
        for i, raw_row in enumerate(rows):
            rm = ImportRow(batch_id=batch.id, row_index=i, raw=raw_row)
            db.add(rm)
            row_models.append(rm)
        await db.flush()
        result = await apply_import(db, batch=batch, rows=row_models, mapping=mapping)
        batch.status = ImportStatus.APPLIED
        await db.commit()
        print(f"\nAPPLIED batch #{batch.id} — {result}")

    await engine.dispose()


def main() -> None:
    ap = argparse.ArgumentParser(description="Bulk-import IB-DB export into the pool.")
    ap.add_argument("--firm-id", type=int, required=True)
    ap.add_argument("--file", required=True)
    ap.add_argument("--apply", action="store_true", help="commit (default is dry-run)")
    args = ap.parse_args()
    asyncio.run(_run(args.firm_id, args.file, args.apply))


if __name__ == "__main__":
    main()
