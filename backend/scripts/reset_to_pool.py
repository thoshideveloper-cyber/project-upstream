"""Reset a dev database to the *empty-canvas + sourcing pool* state.

The point of this script is to make the workbook import testable over and over. It
strips everything an import creates — projects, engagements, companies, contacts,
schedules, the event log and the staged import batches — while keeping the three
things a fresh firm legitimately starts with:

  * the firm, and its users (you still have to log in),
  * ``company_profiles`` — the standing company database, which is firm-wide research
    and is NOT produced by an import, and
  * the firm's vocabulary and funnel config (categories, sourcing stages, data sources).

Sourcing *layers* and *candidates* are deleted despite belonging to the pool's world:
both hang off a mandate, so they cannot outlive the engagements being removed.

Usage (from ``backend/``):
    ./.venv/Scripts/python.exe scripts/reset_to_pool.py            # uses DATABASE_URL
    ./.venv/Scripts/python.exe scripts/reset_to_pool.py --db upstream_e2e.db
"""

from __future__ import annotations

import argparse
import os
import re
import sqlite3
import sys

# Children first — SQLite enforces the FKs these tables declare. Note `companies` must
# precede `sourcing_layers`: a company points *at* its layer (companies.sourcing_layer_id),
# so clearing layers first trips the constraint.
WIPE_ORDER = [
    "sent_emails",
    "import_rows",
    "import_batches",
    "outreach_events",
    "outreach_schedules",
    "contacts",
    "sourcing_candidates",
    "companies",
    "sourcing_layers",
    "mandate_assignments",
    "mandates",
    "saved_searches",
    "projects",
    "refresh_tokens",  # stale sessions; you will log in again anyway
]

KEEP = [
    "firms",
    "users",
    "company_profiles",
    "company_categories",
    "sourcing_stages",
    "data_source_configs",
    "email_accounts",
    "email_templates",
]


def resolve_db(explicit: str | None) -> str:
    if explicit:
        return explicit
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        # Fall back to backend/.env without importing app settings.
        try:
            with open(".env", encoding="utf-8") as fh:
                for line in fh:
                    if line.startswith("DATABASE_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
        except FileNotFoundError:
            pass
    match = re.search(r"sqlite(?:\+\w+)?:///(.+)", url)
    if not match:
        sys.exit(f"Not a SQLite DATABASE_URL ({url!r}) — refusing to touch it.")
    return match.group(1).lstrip("./")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", help="SQLite file (defaults to DATABASE_URL / .env)")
    ap.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    args = ap.parse_args()

    path = resolve_db(args.db)
    if not os.path.exists(path):
        sys.exit(f"No such database: {path}")

    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys = ON")
    existing = {
        r[0] for r in conn.execute("select name from sqlite_master where type='table'")
    }

    def count(table: str) -> int:
        return conn.execute(f'select count(*) from "{table}"').fetchone()[0]

    print(f"Database: {path}\n")
    print("  will DELETE")
    for table in WIPE_ORDER:
        if table in existing and count(table):
            print(f"    {table:24} {count(table)}")
    print("  will KEEP")
    for table in KEEP:
        if table in existing:
            print(f"    {table:24} {count(table)}")

    if not args.yes:
        if input("\nProceed? [y/N] ").strip().lower() != "y":
            sys.exit("Aborted.")

    for table in WIPE_ORDER:
        if table in existing:
            conn.execute(f'delete from "{table}"')
    # Re-issue IDs from 1 so a fresh import reads like a fresh firm.
    if "sqlite_sequence" in existing:
        marks = ",".join("?" * len(WIPE_ORDER))
        conn.execute(f"delete from sqlite_sequence where name in ({marks})", WIPE_ORDER)
    conn.commit()
    conn.execute("VACUUM")

    print("\nDone. Remaining:")
    for table in KEEP:
        if table in existing:
            print(f"    {table:24} {count(table)}")
    conn.close()


if __name__ == "__main__":
    main()
