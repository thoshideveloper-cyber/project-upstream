"""Tasks, the activity log, and project-level assignments.

Three create-only tables. Nothing existing is altered, so ``render_as_batch`` never comes
into play and the ``tests/test_migrations.py`` upgrade/downgrade/upgrade round-trip is
materially de-risked: SQLite's batch table-rebuild is where this project's migration pain
has always lived (see ``d5a7c9e1f3b8``).

**No data backfill.** A feed backfilled from ``created_at`` would have to invent an actor
for every historical row, and the schema has nowhere honest to put "we don't know who".
The log starts empty and starts telling the truth from the first write.

Every index and constraint is named explicitly. SQLite reflects an unnamed constraint with
``name=None``, which is precisely why ``d5a7c9e1f3b8`` exists.

Revision ID: e7c4d9a2f611
Revises: d5a7c9e1f3b8
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "e7c4d9a2f611"
down_revision = "d5a7c9e1f3b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── project_assignments — parent of nothing, child of projects/users ──────
    op.create_table(
        "project_assignments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.id"], name="fk_project_assignments_project_id"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_project_assignments_user_id"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_project_assignments"),
        sa.UniqueConstraint(
            "project_id", "user_id", name="uq_project_assignments_project_user"
        ),
    )
    op.create_index(
        "ix_project_assignments_project_id", "project_assignments", ["project_id"]
    )
    op.create_index("ix_project_assignments_user_id", "project_assignments", ["user_id"])

    # ── tasks ────────────────────────────────────────────────────────────────
    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("firm_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("mandate_id", sa.Integer(), nullable=True),
        sa.Column("company_id", sa.Integer(), nullable=True),
        sa.Column("contact_id", sa.Integer(), nullable=True),
        sa.Column("scope", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("assignee_id", sa.Integer(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["firm_id"], ["firms.id"], name="fk_tasks_firm_id"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name="fk_tasks_project_id"),
        sa.ForeignKeyConstraint(["mandate_id"], ["mandates.id"], name="fk_tasks_mandate_id"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], name="fk_tasks_company_id"),
        sa.ForeignKeyConstraint(["contact_id"], ["contacts.id"], name="fk_tasks_contact_id"),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"], name="fk_tasks_assignee_id"),
        sa.ForeignKeyConstraint(
            ["created_by_id"], ["users.id"], name="fk_tasks_created_by_id"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_tasks"),
        # SQLite is not enforcing FKs in this app, but it does enforce CHECK.
        sa.CheckConstraint(
            "(scope = 'PERSONAL' AND project_id IS NULL AND mandate_id IS NULL "
            "AND company_id IS NULL AND contact_id IS NULL) "
            "OR (scope <> 'PERSONAL' AND project_id IS NOT NULL)",
            name="ck_tasks_scope_consistent",
        ),
    )
    op.create_index("ix_tasks_firm_id", "tasks", ["firm_id"])
    op.create_index("ix_tasks_project_id", "tasks", ["project_id"])
    op.create_index("ix_tasks_mandate_id", "tasks", ["mandate_id"])
    op.create_index("ix_tasks_company_id", "tasks", ["company_id"])
    op.create_index("ix_tasks_assignee_id", "tasks", ["assignee_id"])
    op.create_index("ix_tasks_project_status", "tasks", ["project_id", "status"])
    op.create_index(
        "ix_tasks_assignee_status_due", "tasks", ["assignee_id", "status", "due_date"]
    )

    # ── activity_events ──────────────────────────────────────────────────────
    op.create_table(
        "activity_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("firm_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("mandate_id", sa.Integer(), nullable=True),
        sa.Column("company_id", sa.Integer(), nullable=True),
        sa.Column("actor_id", sa.Integer(), nullable=True),
        sa.Column("actor_name", sa.String(length=255), nullable=True),
        sa.Column("verb", sa.String(length=40), nullable=False),
        sa.Column("object_type", sa.String(length=30), nullable=False),
        sa.Column("object_id", sa.Integer(), nullable=True),
        sa.Column("object_label", sa.String(length=255), nullable=True),
        sa.Column("meta", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["firm_id"], ["firms.id"], name="fk_activity_events_firm_id"),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.id"], name="fk_activity_events_project_id"
        ),
        sa.ForeignKeyConstraint(
            ["mandate_id"], ["mandates.id"], name="fk_activity_events_mandate_id"
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name="fk_activity_events_company_id"
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"], ["users.id"], name="fk_activity_events_actor_id"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_activity_events"),
    )
    op.create_index("ix_activity_events_actor_id", "activity_events", ["actor_id"])
    # These three composite indexes are the three read surfaces.
    op.create_index(
        "ix_activity_events_project_created", "activity_events", ["project_id", "created_at"]
    )
    op.create_index(
        "ix_activity_events_firm_created", "activity_events", ["firm_id", "created_at"]
    )
    op.create_index(
        "ix_activity_events_company_created", "activity_events", ["company_id", "created_at"]
    )


def downgrade() -> None:
    # Dropping the table drops its indexes with it on both backends; separate
    # drop_index calls would fail on the second run.
    op.drop_table("activity_events")
    op.drop_table("tasks")
    op.drop_table("project_assignments")
