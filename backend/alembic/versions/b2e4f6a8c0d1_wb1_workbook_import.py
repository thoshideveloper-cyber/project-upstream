"""WB-1 — client-workbook import: widen the existing import audit tables.

Revision ID: b2e4f6a8c0d1
Revises: a1c3e5f7b9d0
Create Date: 2026-08-06

Additive / reversible. Deliberately *extends* ``import_batches`` / ``import_rows``
rather than adding a parallel table set, so the workbook wizard inherits the CSV
wizard's audit + error-review surface unchanged (§WB-1 step 2).

- import_batches.project_id — the project every sheet in the workbook lands under.
- import_batches.summary    — applied per-entity outcome (companies/contacts/events).
- import_rows.sheet_name    — a workbook batch spans several tabs; CSV rows stay NULL.
- import_rows.resolved_company_id / resolved_contact_id / resolved_schedule_id —
  one workbook row resolves to a whole slice of the graph, not just a profile.

``ImportSource.WORKBOOK`` needs no DDL: the enum column is a plain VARCHAR
(``native_enum=False``, no CHECK constraint) — see b8d0f2c3e4a5.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "b2e4f6a8c0d1"
down_revision = "a1c3e5f7b9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("import_batches") as batch_op:
        batch_op.add_column(sa.Column("project_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("summary", sa.JSON(), nullable=True))
        batch_op.create_foreign_key(
            "fk_import_batches_project_id", "projects", ["project_id"], ["id"]
        )
        batch_op.create_index("ix_import_batches_project_id", ["project_id"], unique=False)

    with op.batch_alter_table("import_rows") as batch_op:
        batch_op.add_column(sa.Column("sheet_name", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("resolved_company_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("resolved_contact_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("resolved_schedule_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_import_rows_resolved_company_id", "companies", ["resolved_company_id"], ["id"]
        )
        batch_op.create_foreign_key(
            "fk_import_rows_resolved_contact_id", "contacts", ["resolved_contact_id"], ["id"]
        )
        batch_op.create_foreign_key(
            "fk_import_rows_resolved_schedule_id",
            "outreach_schedules",
            ["resolved_schedule_id"],
            ["id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("import_rows") as batch_op:
        batch_op.drop_constraint("fk_import_rows_resolved_schedule_id", type_="foreignkey")
        batch_op.drop_constraint("fk_import_rows_resolved_contact_id", type_="foreignkey")
        batch_op.drop_constraint("fk_import_rows_resolved_company_id", type_="foreignkey")
        batch_op.drop_column("resolved_schedule_id")
        batch_op.drop_column("resolved_contact_id")
        batch_op.drop_column("resolved_company_id")
        batch_op.drop_column("sheet_name")

    with op.batch_alter_table("import_batches") as batch_op:
        batch_op.drop_index("ix_import_batches_project_id")
        batch_op.drop_constraint("fk_import_batches_project_id", type_="foreignkey")
        batch_op.drop_column("summary")
        batch_op.drop_column("project_id")
