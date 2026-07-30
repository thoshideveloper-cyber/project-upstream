"""Email pipeline: email_accounts, email_templates, sent_emails.

Revision ID: e5a7c9d1b3f5
Revises: d0f2b4c5e6a7
Create Date: 2026-07-18
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "e5a7c9d1b3f5"
down_revision = "d0f2b4c5e6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "email_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("firm_id", sa.Integer(), sa.ForeignKey("firms.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "provider",
            sa.Enum("GOOGLE", "MICROSOFT", "SANDBOX", name="emailprovider", native_enum=False),
            nullable=False,
        ),
        sa.Column("email_address", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("refresh_token_enc", sa.Text(), nullable=True),
        sa.Column("access_token_enc", sa.Text(), nullable=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("signature", sa.Text(), nullable=True),
        sa.Column("daily_send_limit", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_email_accounts_user"),
    )
    op.create_index("ix_email_accounts_firm_id", "email_accounts", ["firm_id"])

    op.create_table(
        "email_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("firm_id", sa.Integer(), sa.ForeignKey("firms.id"), nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column(
            "kind",
            sa.Enum(
                "INITIAL", "FOLLOW_UP", "BUMP", "BREAKUP",
                name="emailtemplatekind", native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("subject", sa.String(300), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_shared", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("use_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_email_templates_firm_id", "email_templates", ["firm_id"])

    op.create_table(
        "sent_emails",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("firm_id", sa.Integer(), sa.ForeignKey("firms.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("contact_id", sa.Integer(), sa.ForeignKey("contacts.id"), nullable=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("outreach_events.id"), nullable=True),
        sa.Column("to_email", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("body_text", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("SENT", "SIMULATED", "FAILED", name="emailsendstatus", native_enum=False),
            nullable=False,
        ),
        sa.Column("provider_message_id", sa.String(255), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_sent_emails_firm_id", "sent_emails", ["firm_id"])
    op.create_index("ix_sent_emails_user_id", "sent_emails", ["user_id"])
    op.create_index("ix_sent_emails_company_id", "sent_emails", ["company_id"])


def downgrade() -> None:
    op.drop_table("sent_emails")
    op.drop_table("email_templates")
    op.drop_table("email_accounts")
