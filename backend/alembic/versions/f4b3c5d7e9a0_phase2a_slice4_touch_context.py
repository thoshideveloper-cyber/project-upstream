"""Phase 2a Slice A4 — per-touch context (sentiment, mode) on events + contact cache.

Revision ID: f4b3c5d7e9a0
Revises: e3a2b4c6d7e8
Create Date: 2026-07-01

Additive: the response-capture flow (§8-B) records who responded and the outcome.
  1. ``outreach_events.mode``       — channel of this touch (Email/Call/LinkedIn/…).
  2. ``outreach_events.sentiment``  — Positive/Negative/Neutral (source of truth, BUG-12).
  3. ``contacts.sentiment``         — typed cache of the contact's latest-touch sentiment.

Enums are stored as strings (native_enum=False) so no DDL enum type is created; nothing
to backfill (both are new signals with no historical value).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "f4b3c5d7e9a0"
down_revision = "e3a2b4c6d7e8"
branch_labels = None
depends_on = None

_MODE = sa.String(length=20)
_SENTIMENT = sa.String(length=20)


def upgrade() -> None:
    with op.batch_alter_table("outreach_events") as batch_op:
        batch_op.add_column(sa.Column("mode", _MODE, nullable=True))
        batch_op.add_column(sa.Column("sentiment", _SENTIMENT, nullable=True))
    with op.batch_alter_table("contacts") as batch_op:
        batch_op.add_column(sa.Column("sentiment", _SENTIMENT, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("contacts") as batch_op:
        batch_op.drop_column("sentiment")
    with op.batch_alter_table("outreach_events") as batch_op:
        batch_op.drop_column("sentiment")
        batch_op.drop_column("mode")
