"""Project ownership — track who created a project so its creator can see it.

Revision ID: a1c3e5f7b9d0
Revises: e5a7c9d1b3f5
Create Date: 2026-07-18

Analysts can now open their own client projects. A freshly-created project has no
mandates yet, so mandate-assignment visibility alone would hide it from its own
creator. ``projects.created_by_id`` closes that gap: creator-owned projects are
visible to the analyst even before the first engagement is added. Nullable — existing
rows (and partner-created projects) simply have no owner recorded.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "a1c3e5f7b9d0"
down_revision = "e5a7c9d1b3f5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("projects") as batch_op:
        batch_op.add_column(sa.Column("created_by_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_projects_created_by_id_users",
            "users",
            ["created_by_id"],
            ["id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("projects") as batch_op:
        batch_op.drop_constraint("fk_projects_created_by_id_users", type_="foreignkey")
        batch_op.drop_column("created_by_id")
