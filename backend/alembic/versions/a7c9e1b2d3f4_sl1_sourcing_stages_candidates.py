"""SL-1 — sourcing funnel: stages + candidates (SOURCING_LAYER_PLAN §2.2 MIG-1).

Revision ID: a7c9e1b2d3f4
Revises: f4b3c5d7e9a0
Create Date: 2026-07-02

Additive / reversible (proven upgrade→downgrade→upgrade on SQLite):
  1. Create ``sourcing_stages`` (firm-wide funnel vocabulary, kind-driven).
  2. Seed the 5 default stages per existing firm (data migration).
  3. Create ``sourcing_candidates`` (mandate × profile) with the folded AI score cache
     + unique (mandate_id, profile_id).
  4. Backfill candidate rows from existing placements, deriving the stage from current
     signals; prints a one-line audit report so the backfill is reviewable.

No ``companies`` column changes (no ``stage_id``) — the funnel lives on the candidate.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "a7c9e1b2d3f4"
down_revision = "f4b3c5d7e9a0"
branch_labels = None
depends_on = None

# (name, kind, sort_order) — mirrors app.services.sourcing.DEFAULT_STAGES (frozen copy).
_DEFAULT_STAGES = [
    ("Research / Long-list", "RESEARCH", 10),
    ("Shortlisted", "SHORTLIST", 20),
    ("Active outreach", "ACTIVE", 30),
    ("Engaged", "ENGAGED", 40),
    ("Passed", "PASSED", 50),
]


def upgrade() -> None:
    op.create_table(
        "sourcing_stages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("firm_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.ForeignKeyConstraint(["firm_id"], ["firms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("sourcing_stages") as batch_op:
        batch_op.create_index("ix_sourcing_stages_firm_id", ["firm_id"], unique=False)

    op.create_table(
        "sourcing_candidates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("firm_id", sa.Integer(), nullable=False),
        sa.Column("mandate_id", sa.Integer(), nullable=False),
        sa.Column("profile_id", sa.Integer(), nullable=False),
        sa.Column("stage_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=True),
        sa.Column("added_by_id", sa.Integer(), nullable=True),
        sa.Column("fit_score", sa.Integer(), nullable=True),
        sa.Column("band", sa.String(20), nullable=True),
        sa.Column("subscores", sa.JSON(), nullable=True),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("insufficient_data", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("prompt_version", sa.String(50), nullable=True),
        sa.Column("inputs_hash", sa.String(64), nullable=True),
        sa.Column("score_status", sa.String(20), nullable=True),
        sa.Column("scored_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("score_feedback", sa.String(10), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.ForeignKeyConstraint(["firm_id"], ["firms.id"]),
        sa.ForeignKeyConstraint(["mandate_id"], ["mandates.id"]),
        sa.ForeignKeyConstraint(["profile_id"], ["company_profiles.id"]),
        sa.ForeignKeyConstraint(["stage_id"], ["sourcing_stages.id"]),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["added_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("sourcing_candidates") as batch_op:
        batch_op.create_index("ix_sourcing_candidates_firm_id", ["firm_id"], unique=False)
        batch_op.create_index("ix_sourcing_candidates_mandate_id", ["mandate_id"], unique=False)
        batch_op.create_index("ix_sourcing_candidates_profile_id", ["profile_id"], unique=False)
        batch_op.create_index("ix_sourcing_candidates_stage_id", ["stage_id"], unique=False)
        batch_op.create_index("ix_sourcing_candidates_company_id", ["company_id"], unique=False)
        batch_op.create_unique_constraint(
            "uq_sourcing_candidates_mandate_profile", ["mandate_id", "profile_id"]
        )

    conn = op.get_bind()

    # ── Seed default stages per firm ──────────────────────────────────────────
    firm_ids = [r[0] for r in conn.execute(sa.text("SELECT id FROM firms")).fetchall()]
    for firm_id in firm_ids:
        for name, kind, sort_order in _DEFAULT_STAGES:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO sourcing_stages
                        (firm_id, name, kind, sort_order, created_at, updated_at)
                    VALUES (:firm_id, :name, :kind, :sort_order,
                            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """
                ),
                {"firm_id": firm_id, "name": name, "kind": kind, "sort_order": sort_order},
            )

    # Map (firm_id, kind) → stage_id for the backfill.
    stage_by_firm_kind: dict[tuple, int] = {}
    for sid, fid, kind in conn.execute(
        sa.text("SELECT id, firm_id, kind FROM sourcing_stages")
    ).fetchall():
        stage_by_firm_kind[(fid, kind)] = sid

    # ── Backfill candidate rows from existing placements ──────────────────────
    companies = conn.execute(
        sa.text(
            """
            SELECT id, firm_id, mandate_id, profile_id, status, archived_at, created_by_id
            FROM companies
            WHERE profile_id IS NOT NULL
            """
        )
    ).fetchall()

    seen: set[tuple] = set()
    counts = {"RESEARCH": 0, "SHORTLIST": 0, "ACTIVE": 0, "ENGAGED": 0, "PASSED": 0, "skipped": 0}
    for c in companies:
        cid, firm_id, mandate_id, profile_id, cstatus, archived_at, created_by_id = c
        key = (mandate_id, profile_id)
        if key in seen:
            counts["skipped"] += 1
            continue
        seen.add(key)

        has_response = conn.execute(
            sa.text(
                "SELECT 1 FROM outreach_events WHERE company_id = :cid "
                "AND event_type = 'RESPONSE' LIMIT 1"
            ),
            {"cid": cid},
        ).first() is not None
        has_initial = conn.execute(
            sa.text(
                "SELECT 1 FROM outreach_events WHERE company_id = :cid "
                "AND event_type = 'INITIAL_EMAIL' LIMIT 1"
            ),
            {"cid": cid},
        ).first() is not None
        sched_active = conn.execute(
            sa.text(
                "SELECT 1 FROM outreach_schedules WHERE company_id = :cid "
                "AND is_current = 1 AND status = 'ACTIVE' LIMIT 1"
            ),
            {"cid": cid},
        ).first() is not None

        if archived_at is not None or cstatus == "DECLINED":
            kind = "PASSED"
        elif cstatus in ("RESPONDED", "INTERESTED") or has_response:
            kind = "ENGAGED"
        elif cstatus in ("CONTACTED", "BOUNCED") or sched_active or has_initial:
            kind = "ACTIVE"
        else:
            kind = "RESEARCH"

        stage_id = stage_by_firm_kind.get((firm_id, kind))
        if stage_id is None:
            counts["skipped"] += 1
            continue
        conn.execute(
            sa.text(
                """
                INSERT INTO sourcing_candidates
                    (firm_id, mandate_id, profile_id, stage_id, company_id, added_by_id,
                     insufficient_data, created_at, updated_at)
                VALUES (:firm_id, :mandate_id, :profile_id, :stage_id, :company_id,
                        :added_by_id, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """
            ),
            {
                "firm_id": firm_id,
                "mandate_id": mandate_id,
                "profile_id": profile_id,
                "stage_id": stage_id,
                "company_id": cid,
                "added_by_id": created_by_id,
            },
        )
        counts[kind] += 1

    print(
        "[MIG-1 backfill] candidates created — "
        + ", ".join(f"{k}:{v}" for k, v in counts.items())
    )


def downgrade() -> None:
    with op.batch_alter_table("sourcing_candidates") as batch_op:
        batch_op.drop_constraint("uq_sourcing_candidates_mandate_profile", type_="unique")
        batch_op.drop_index("ix_sourcing_candidates_company_id")
        batch_op.drop_index("ix_sourcing_candidates_stage_id")
        batch_op.drop_index("ix_sourcing_candidates_profile_id")
        batch_op.drop_index("ix_sourcing_candidates_mandate_id")
        batch_op.drop_index("ix_sourcing_candidates_firm_id")
    op.drop_table("sourcing_candidates")

    with op.batch_alter_table("sourcing_stages") as batch_op:
        batch_op.drop_index("ix_sourcing_stages_firm_id")
    op.drop_table("sourcing_stages")
