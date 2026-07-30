"""SL-7 — pluggable-provider registry: data_source_configs (§2.2 MIG-4).

Revision ID: d0f2b4c5e6a7
Revises: c9e1a3b4d5f6
Create Date: 2026-07-02

Additive / reversible. Seeds the mock ranking + enrichment providers (and a
disabled Groq ranking row) per existing firm so the seam is provable out of the box.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "d0f2b4c5e6a7"
down_revision = "c9e1a3b4d5f6"
branch_labels = None
depends_on = None

_DEFAULTS = [
    ("mock_ranking", "RANKING", 1),
    ("mock_enrichment", "ENRICHMENT", 1),
    ("groq_ranking", "RANKING", 0),
]


def upgrade() -> None:
    op.create_table(
        "data_source_configs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("firm_id", sa.Integer(), nullable=False),
        sa.Column("provider_key", sa.String(100), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("config", sa.JSON(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.ForeignKeyConstraint(["firm_id"], ["firms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("data_source_configs") as batch_op:
        batch_op.create_index("ix_data_source_configs_firm_id", ["firm_id"], unique=False)

    conn = op.get_bind()
    firm_ids = [r[0] for r in conn.execute(sa.text("SELECT id FROM firms")).fetchall()]
    for firm_id in firm_ids:
        for provider_key, kind, enabled in _DEFAULTS:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO data_source_configs
                        (firm_id, provider_key, kind, enabled, config, created_at, updated_at)
                    VALUES (:firm_id, :provider_key, :kind, :enabled, '{}',
                            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """
                ),
                {"firm_id": firm_id, "provider_key": provider_key, "kind": kind, "enabled": enabled},
            )


def downgrade() -> None:
    with op.batch_alter_table("data_source_configs") as batch_op:
        batch_op.drop_index("ix_data_source_configs_firm_id")
    op.drop_table("data_source_configs")
