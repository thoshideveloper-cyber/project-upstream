"""Phase 2a Slice A1 — two-axis classification model.

Revision ID: d2f1a3b4c5d6
Revises: c1d2e3f4a5b6
Create Date: 2026-07-01

Changes (all additive / non-destructive):
  1. Create ``company_categories`` — firm-configurable counterparty vocabulary (§7.2).
  2. Create ``sourcing_layers`` — per-engagement ordered bands (§7.3).
  3. Add ``companies.category_id`` + ``companies.sourcing_layer_id`` (nullable FKs).
  4. Backfill:
       a. Seed the default category vocabulary per firm.
       b. Map ``companies.category`` enum → the firm's vocab row (via stable code).
       c. Best-effort seed ``sourcing_layers`` from distinct ``companies.bucket`` per
          mandate (first-seen order) and point companies at them. Unmapped → NULL
          ("Unsorted" band, flagged for analyst review).

The legacy ``companies.category`` enum and ``companies.bucket`` columns are PRESERVED
(``category`` becomes a derived cache; ``bucket`` remains the backfill source only).
Constants are inlined so the migration is frozen and independent of app code.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "d2f1a3b4c5d6"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None

# Frozen copies of app.services.classification constants (migrations must not import
# evolving app code). (code, name, sort_order).
_DEFAULT_CATEGORIES = [
    ("STRATEGIC", "Strategic", 10),
    ("PRIVATE_EQUITY", "Private Equity", 20),
    ("VENTURE_CAPITAL", "Venture Capital", 30),
    ("FAMILY_OFFICE", "Family Office", 40),
    ("PMS", "PMS", 50),
    ("PRIVATE_CREDIT", "Private Credit", 60),
    ("INVESTMENT_BANK", "Investment Bank", 70),
    ("HOLDING_CORPORATE", "Holding / Corporate", 80),
    ("OTHER", "Other", 999),
]

# Legacy enum value → new vocabulary code.
_LEGACY_ENUM_TO_CODE = {
    "STRATEGIC": "STRATEGIC",
    "PRIVATE_EQUITY": "PRIVATE_EQUITY",
    "VENTURE_CAPITAL": "VENTURE_CAPITAL",
    "FAMILY_OFFICE": "FAMILY_OFFICE",
    "FINANCIAL_SPONSOR": "PRIVATE_EQUITY",
    "OTHER": "OTHER",
}


def upgrade() -> None:
    # ── 1. company_categories ────────────────────────────────────────────────
    op.create_table(
        "company_categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("firm_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
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
        sa.UniqueConstraint("firm_id", "code", name="uq_company_categories_firm_code"),
    )
    with op.batch_alter_table("company_categories") as batch_op:
        batch_op.create_index("ix_company_categories_firm_id", ["firm_id"], unique=False)

    # ── 2. sourcing_layers ────────────────────────────────────────────────────
    op.create_table(
        "sourcing_layers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("firm_id", sa.Integer(), nullable=False),
        sa.Column("mandate_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.ForeignKeyConstraint(["firm_id"], ["firms.id"]),
        sa.ForeignKeyConstraint(["mandate_id"], ["mandates.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("sourcing_layers") as batch_op:
        batch_op.create_index("ix_sourcing_layers_firm_id", ["firm_id"], unique=False)
        batch_op.create_index("ix_sourcing_layers_mandate_id", ["mandate_id"], unique=False)

    # ── 3. companies.category_id + sourcing_layer_id ─────────────────────────
    with op.batch_alter_table("companies") as batch_op:
        batch_op.add_column(sa.Column("category_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("sourcing_layer_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_companies_category_id", ["category_id"], unique=False)
        batch_op.create_index("ix_companies_sourcing_layer_id", ["sourcing_layer_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_companies_category_id_company_categories",
            "company_categories",
            ["category_id"],
            ["id"],
        )
        batch_op.create_foreign_key(
            "fk_companies_sourcing_layer_id_sourcing_layers",
            "sourcing_layers",
            ["sourcing_layer_id"],
            ["id"],
        )

    conn = op.get_bind()

    # ── 4a. Seed the default category vocabulary per firm ─────────────────────
    firm_ids = [row[0] for row in conn.execute(sa.text("SELECT id FROM firms")).fetchall()]
    for firm_id in firm_ids:
        for code, name, sort_order in _DEFAULT_CATEGORIES:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO company_categories
                        (firm_id, name, code, sort_order, created_at, updated_at)
                    SELECT :firm_id, :name, :code, :sort_order,
                           CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    WHERE NOT EXISTS (
                        SELECT 1 FROM company_categories
                        WHERE firm_id = :firm_id AND code = :code
                    )
                    """
                ),
                {"firm_id": firm_id, "name": name, "code": code, "sort_order": sort_order},
            )

    # ── 4b. Backfill companies.category_id from the legacy enum via stable code ─
    for enum_val, code in _LEGACY_ENUM_TO_CODE.items():
        conn.execute(
            sa.text(
                """
                UPDATE companies
                SET category_id = (
                    SELECT cc.id FROM company_categories cc
                    WHERE cc.firm_id = companies.firm_id AND cc.code = :code
                    LIMIT 1
                )
                WHERE companies.category = :enum_val
                """
            ),
            {"code": code, "enum_val": enum_val},
        )

    # ── 4c. Best-effort sourcing layers from distinct bucket per mandate ──────
    layer_rows = conn.execute(
        sa.text(
            """
            SELECT mandate_id, firm_id, bucket, MIN(id) AS first_id
            FROM companies
            WHERE bucket IS NOT NULL AND TRIM(bucket) != ''
            GROUP BY mandate_id, firm_id, bucket
            ORDER BY mandate_id, first_id
            """
        )
    ).fetchall()

    order_by_mandate: dict[int, int] = {}
    for mandate_id, firm_id, bucket, _first_id in layer_rows:
        order_by_mandate[mandate_id] = order_by_mandate.get(mandate_id, 0) + 10
        sort_order = order_by_mandate[mandate_id]
        conn.execute(
            sa.text(
                """
                INSERT INTO sourcing_layers
                    (firm_id, mandate_id, name, sort_order, created_at, updated_at)
                VALUES (:firm_id, :mandate_id, :name, :sort_order,
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """
            ),
            {"firm_id": firm_id, "mandate_id": mandate_id, "name": bucket, "sort_order": sort_order},
        )
        layer_id = conn.execute(
            sa.text(
                """
                SELECT id FROM sourcing_layers
                WHERE mandate_id = :mandate_id AND name = :name AND sort_order = :sort_order
                LIMIT 1
                """
            ),
            {"mandate_id": mandate_id, "name": bucket, "sort_order": sort_order},
        ).scalar()
        conn.execute(
            sa.text(
                """
                UPDATE companies
                SET sourcing_layer_id = :layer_id
                WHERE mandate_id = :mandate_id AND bucket = :bucket
                """
            ),
            {"layer_id": layer_id, "mandate_id": mandate_id, "bucket": bucket},
        )


def downgrade() -> None:
    with op.batch_alter_table("companies") as batch_op:
        batch_op.drop_constraint(
            "fk_companies_sourcing_layer_id_sourcing_layers", type_="foreignkey"
        )
        batch_op.drop_constraint(
            "fk_companies_category_id_company_categories", type_="foreignkey"
        )
        batch_op.drop_index("ix_companies_sourcing_layer_id")
        batch_op.drop_index("ix_companies_category_id")
        batch_op.drop_column("sourcing_layer_id")
        batch_op.drop_column("category_id")

    with op.batch_alter_table("sourcing_layers") as batch_op:
        batch_op.drop_index("ix_sourcing_layers_mandate_id")
        batch_op.drop_index("ix_sourcing_layers_firm_id")
    op.drop_table("sourcing_layers")

    with op.batch_alter_table("company_categories") as batch_op:
        batch_op.drop_index("ix_company_categories_firm_id")
    op.drop_table("company_categories")
