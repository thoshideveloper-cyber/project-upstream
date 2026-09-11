"""Pool classification — company_profiles.segment / .sector.

Revision ID: c4f6a8b0d2e3
Revises: b2e4f6a8c0d1
Create Date: 2026-08-06

Additive / reversible. The sourcing pool is the only surface that ships pre-filled
(``app/data/company_pool.py``), and a pool you cannot slice is a phone book. Category and
type already exist, but on ``companies`` — i.e. per *placement*, which means they are
unknowable until a deal has been imported. These two columns say what is true of the
company itself, so Discover has real facets on an empty book:

- segment — TARGET / INVESTOR: which side of the market the company sits on.
- sector  — the research bucket it came from ("Private equity", "IT services &
  consulting", …). Free text, not an enum: the vocabulary grows with the datasets and
  imports that feed it, and a CHECK constraint here would turn new research into a
  migration.

Both nullable and indexed; NULL means "not classified", which is the honest state for a
company that arrived from a client sheet carrying no such column.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "c4f6a8b0d2e3"
down_revision = "b2e4f6a8c0d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("company_profiles") as batch_op:
        batch_op.add_column(sa.Column("segment", sa.String(length=16), nullable=True))
        batch_op.add_column(sa.Column("sector", sa.String(length=64), nullable=True))
        batch_op.create_index("ix_company_profiles_segment", ["segment"], unique=False)
        batch_op.create_index("ix_company_profiles_sector", ["sector"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("company_profiles") as batch_op:
        batch_op.drop_index("ix_company_profiles_sector")
        batch_op.drop_index("ix_company_profiles_segment")
        batch_op.drop_column("sector")
        batch_op.drop_column("segment")
