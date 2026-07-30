"""SL-3 — saved pool searches (§2.2 MIG-3).

Revision ID: c9e1a3b4d5f6
Revises: b8d0f2c3e4a5
Create Date: 2026-07-02

Additive / reversible.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "c9e1a3b4d5f6"
down_revision = "b8d0f2c3e4a5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_searches",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("firm_id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("scope", sa.String(20), nullable=False, server_default="PRIVATE"),
        sa.Column("criteria", sa.JSON(), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.ForeignKeyConstraint(["firm_id"], ["firms.id"]),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("saved_searches") as batch_op:
        batch_op.create_index("ix_saved_searches_firm_id", ["firm_id"], unique=False)
        batch_op.create_index("ix_saved_searches_owner_id", ["owner_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("saved_searches") as batch_op:
        batch_op.drop_index("ix_saved_searches_owner_id")
        batch_op.drop_index("ix_saved_searches_firm_id")
    op.drop_table("saved_searches")
