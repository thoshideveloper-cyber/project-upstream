"""Phase 8 Slice 1 — Project entity, cadence cycles, CompanyCategory, follow_up_cap.

Revision ID: c1d2e3f4a5b6
Revises: a1b2c3d4e5f6
Create Date: 2026-06-30

Changes (all additive / non-destructive):
  1. Create `projects` table (firm-scoped, soft-deletable)
  2. Add `mandates.project_id` (FK→projects, nullable → backfill → NOT NULL)
  3. Add `mandates.follow_up_cap` (nullable int)
  4. Add `companies.category` (CompanyCategory enum, default OTHER)
  5. Add `firms.follow_up_cap` (int, default 4)
  6. Add `outreach_schedules.cycle_number/is_current/contact_id`
  7. Swap unique(company_id) → unique(company_id, cycle_number) via batch_alter_table
  8. Backfill: one Project per (firm_id, client_name), point mandates at them,
     map bucket→category, set contact_id = primary contact on each schedule
  9. Enforce mandates.project_id NOT NULL

bucket column is PRESERVED (non-destructive); category is the new source of truth.
EXHAUSTED added to StoppedReason: native_enum=False means no DDL change needed.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "c1d2e3f4a5b6"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Create projects table ─────────────────────────────────────────────
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("firm_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("client_name", sa.String(255), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["firm_id"], ["firms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("projects") as batch_op:
        batch_op.create_index("ix_projects_firm_id", ["firm_id"], unique=False)

    # ── 2+3. Add mandates.project_id (nullable first) + follow_up_cap ────────
    with op.batch_alter_table("mandates") as batch_op:
        batch_op.add_column(sa.Column("project_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("follow_up_cap", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_mandates_project_id_projects",
            "projects",
            ["project_id"],
            ["id"],
        )
        batch_op.create_index("ix_mandates_project_id", ["project_id"], unique=False)

    # ── 4. Add companies.category ─────────────────────────────────────────────
    with op.batch_alter_table("companies") as batch_op:
        batch_op.add_column(
            sa.Column(
                "category",
                sa.Enum(
                    "STRATEGIC",
                    "PRIVATE_EQUITY",
                    "VENTURE_CAPITAL",
                    "FAMILY_OFFICE",
                    "FINANCIAL_SPONSOR",
                    "OTHER",
                    name="companycategory",
                    native_enum=False,
                ),
                nullable=False,
                server_default="OTHER",
            )
        )

    # ── 5. Add firms.follow_up_cap ────────────────────────────────────────────
    with op.batch_alter_table("firms") as batch_op:
        batch_op.add_column(
            sa.Column("follow_up_cap", sa.Integer(), nullable=False, server_default="4")
        )

    # ── 6+7. Add cycle cols + swap unique constraint on outreach_schedules ────
    # Discover the current unnamed unique constraint on company_id dynamically
    # so this migration works on both SQLite (sqlite_autoindex_*) and PostgreSQL.
    conn = op.get_bind()
    from sqlalchemy import inspect as sa_inspect
    insp = sa_inspect(conn)
    existing_ucs = insp.get_unique_constraints("outreach_schedules")
    old_uc_name = next(
        (uc["name"] for uc in existing_ucs if uc.get("column_names") == ["company_id"]),
        None,
    )

    with op.batch_alter_table("outreach_schedules") as batch_op:
        batch_op.add_column(
            sa.Column(
                "cycle_number",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("1"),
            )
        )
        batch_op.add_column(
            sa.Column(
                "is_current",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            )
        )
        batch_op.add_column(sa.Column("contact_id", sa.Integer(), nullable=True))
        if old_uc_name:
            batch_op.drop_constraint(old_uc_name, type_="unique")
        batch_op.create_unique_constraint(
            "uq_outreach_schedules_company_cycle", ["company_id", "cycle_number"]
        )
        batch_op.create_foreign_key(
            "fk_outreach_schedules_contact_id_contacts",
            "contacts",
            ["contact_id"],
            ["id"],
        )

    # ── 8. Backfill data ──────────────────────────────────────────────────────

    # 8a. One Project per distinct (firm_id, client_name) in mandates
    op.execute(
        sa.text("""
            INSERT INTO projects (firm_id, name, client_name, created_at, updated_at)
            SELECT DISTINCT firm_id, client_name, client_name,
                   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            FROM mandates
        """)
    )

    # 8b. Point each mandate at its project
    op.execute(
        sa.text("""
            UPDATE mandates
            SET project_id = (
                SELECT p.id FROM projects p
                WHERE p.firm_id = mandates.firm_id
                  AND p.client_name = mandates.client_name
                LIMIT 1
            )
        """)
    )

    # 8c. Backfill companies.category from bucket
    #     Strategic→STRATEGIC, Financial*/PE*→PRIVATE_EQUITY, rest→OTHER
    op.execute(
        sa.text("""
            UPDATE companies
            SET category = CASE
                WHEN bucket = 'Strategic'             THEN 'STRATEGIC'
                WHEN bucket LIKE 'Financial%'
                  OR bucket LIKE 'PE%'                THEN 'PRIVATE_EQUITY'
                ELSE 'OTHER'
            END
        """)
    )

    # 8d. Set outreach_schedules.contact_id = primary contact for each company
    op.execute(
        sa.text("""
            UPDATE outreach_schedules
            SET contact_id = (
                SELECT c.id FROM contacts c
                WHERE c.company_id = outreach_schedules.company_id
                  AND c.is_primary = true
                  AND c.archived_at IS NULL
                LIMIT 1
            )
        """)
    )

    # ── 9. Enforce mandates.project_id NOT NULL (all rows now have a value) ───
    with op.batch_alter_table("mandates") as batch_op:
        batch_op.alter_column("project_id", existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    # Reverse step 9: make project_id nullable again
    with op.batch_alter_table("mandates") as batch_op:
        batch_op.alter_column("project_id", existing_type=sa.Integer(), nullable=True)

    # Reverse step 6+7: drop cycle columns + restore unique(company_id)
    with op.batch_alter_table("outreach_schedules") as batch_op:
        batch_op.drop_constraint(
            "fk_outreach_schedules_contact_id_contacts", type_="foreignkey"
        )
        batch_op.drop_constraint("uq_outreach_schedules_company_cycle", type_="unique")
        batch_op.drop_column("contact_id")
        batch_op.drop_column("is_current")
        batch_op.drop_column("cycle_number")
        batch_op.create_unique_constraint("uq_outreach_schedules_company_id", ["company_id"])

    # Reverse step 5
    with op.batch_alter_table("firms") as batch_op:
        batch_op.drop_column("follow_up_cap")

    # Reverse step 4
    with op.batch_alter_table("companies") as batch_op:
        batch_op.drop_column("category")

    # Reverse step 2+3
    with op.batch_alter_table("mandates") as batch_op:
        batch_op.drop_index("ix_mandates_project_id")
        batch_op.drop_constraint(
            "fk_mandates_project_id_projects", type_="foreignkey"
        )
        batch_op.drop_column("follow_up_cap")
        batch_op.drop_column("project_id")

    # Reverse step 1
    with op.batch_alter_table("projects") as batch_op:
        batch_op.drop_index("ix_projects_firm_id")
    op.drop_table("projects")
