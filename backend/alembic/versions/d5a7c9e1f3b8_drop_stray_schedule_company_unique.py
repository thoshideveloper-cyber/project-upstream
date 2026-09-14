"""Drop the stray unique(company_id) left on outreach_schedules.

Phase-8 slice 1 (`c1d2e3f4a5b6`) meant to swap `unique(company_id)` for
`unique(company_id, cycle_number)` so a company can be approached again on a
later mandate. It added the new constraint but, on SQLite, never dropped the
old one: it looked the constraint up with

    old_uc_name = next((uc["name"] for uc in ... if uc["column_names"] == ["company_id"]), None)
    ...
    if old_uc_name:
        batch_op.drop_constraint(old_uc_name, type_="unique")

and SQLite reflects a column-level `unique=True` as a constraint whose **name
is None**. So `old_uc_name` was falsy in exactly the case the lookup existed
to catch, the guard skipped the drop, and the batch rebuild carried the old
`UNIQUE (company_id)` straight into the new table.

PostgreSQL names that constraint (`outreach_schedules_company_id_key`), so
production swapped it correctly and is not affected. Every SQLite database —
which is every developer machine, and the documented dev default — has both
constraints, and the stricter one wins: opening cycle 2 on a company fails with
`UNIQUE constraint failed: outreach_schedules.company_id`. Re-approaching a
name on a second mandate is the product's whole argument for keeping a record,
so this is not a cosmetic divergence.

The fix is written to be safe wherever it lands: it drops the constraint only
if a unique on exactly `["company_id"]` is still there, by name when there is
one and by table rebuild when there is not, and does nothing at all on a
database that is already correct.

Revision ID: d5a7c9e1f3b8
Revises: c4f6a8b0d2e3
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "d5a7c9e1f3b8"
down_revision = "c4f6a8b0d2e3"
branch_labels = None
depends_on = None

TABLE = "outreach_schedules"


def _stray(conn) -> dict | None:
    """The unique constraint on company_id alone, if the database still has it."""
    for uc in sa.inspect(conn).get_unique_constraints(TABLE):
        if list(uc.get("column_names") or []) == ["company_id"]:
            return uc
    return None


def upgrade() -> None:
    conn = op.get_bind()
    uc = _stray(conn)
    if uc is None:
        return  # already correct (PostgreSQL, or a database built after this)

    name = uc.get("name")
    if name:
        op.drop_constraint(name, TABLE, type_="unique")
        return

    # SQLite: unnamed, so there is nothing to drop by name. Reflect the table,
    # take the constraint out of the reflected definition, and let batch mode
    # rebuild from that. `recreate="always"` because the batch block issues no
    # operations of its own and would otherwise be a no-op.
    meta = sa.MetaData()
    tbl = sa.Table(TABLE, meta, autoload_with=conn)
    for c in list(tbl.constraints):
        if isinstance(c, sa.UniqueConstraint) and [col.name for col in c.columns] == [
            "company_id"
        ]:
            tbl.constraints.discard(c)
    with op.batch_alter_table(TABLE, copy_from=tbl, recreate="always"):
        pass


def downgrade() -> None:
    # Deliberately not restored. Putting unique(company_id) back would make a
    # second cycle unwritable again, and any database that has been used since
    # this ran may already hold rows that violate it.
    pass
