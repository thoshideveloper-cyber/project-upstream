"""SL-2 — pool ingest audit: import_batches + import_rows (§2.2 MIG-2).

Revision ID: b8d0f2c3e4a5
Revises: a7c9e1b2d3f4
Create Date: 2026-07-02

Additive / reversible. No data migration (new ingest surface only).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "b8d0f2c3e4a5"
down_revision = "a7c9e1b2d3f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "import_batches",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("firm_id", sa.Integer(), nullable=False),
        sa.Column("uploaded_by", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(20), nullable=False, server_default="CSV"),
        sa.Column("filename", sa.String(500), nullable=True),
        sa.Column("file_hash", sa.String(64), nullable=True),
        sa.Column("mapping", sa.JSON(), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.ForeignKeyConstraint(["firm_id"], ["firms.id"]),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("import_batches") as batch_op:
        batch_op.create_index("ix_import_batches_firm_id", ["firm_id"], unique=False)
        batch_op.create_index("ix_import_batches_file_hash", ["file_hash"], unique=False)

    op.create_table(
        "import_rows",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("batch_id", sa.Integer(), nullable=False),
        sa.Column("row_index", sa.Integer(), nullable=False),
        sa.Column("raw", sa.JSON(), nullable=False),
        sa.Column("resolved_profile_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(20), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["batch_id"], ["import_batches.id"]),
        sa.ForeignKeyConstraint(["resolved_profile_id"], ["company_profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("import_rows") as batch_op:
        batch_op.create_index("ix_import_rows_batch_id", ["batch_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("import_rows") as batch_op:
        batch_op.drop_index("ix_import_rows_batch_id")
    op.drop_table("import_rows")

    with op.batch_alter_table("import_batches") as batch_op:
        batch_op.drop_index("ix_import_batches_file_hash")
        batch_op.drop_index("ix_import_batches_firm_id")
    op.drop_table("import_batches")
