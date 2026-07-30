"""Phase 2a Slice A2 — shared company profiles (the interim bridge).

Revision ID: e3a2b4c6d7e8
Revises: d2f1a3b4c5d6
Create Date: 2026-07-01

Changes (additive / non-destructive; NO FK moves on schedules/events/contacts):
  1. Create ``company_profiles`` (firm-wide shared record + name_key/domain_key).
  2. Add ``companies.profile_id`` (nullable FK).
  3. Backfill: dedupe existing per-mandate companies into profiles by domain_key
     (when a website is present) else name_key, within a firm; merge facts
     (first-non-null across the cluster); point each company at its profile.

Because schedules/events/contacts are untouched, an imperfect dedupe is recoverable
(worst case: two profiles for one entity — merge later), not a broken-cadence outage.
A read-only dry-run dedupe report is available at ``scripts/dedupe_report.py``.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

import sqlalchemy as sa
from alembic import op

revision = "e3a2b4c6d7e8"
down_revision = "d2f1a3b4c5d6"
branch_labels = None
depends_on = None

# Frozen copies of the normalisation helpers (migrations must not import app code).
_SUFFIX_RE = re.compile(
    r"\b(pvt|private|ltd|limited|inc|incorporated|llp|llc|co|corp|corporation"
    r"|group|holdings|industries|enterprises|solutions|technologies|tech|india)\b",
    re.IGNORECASE,
)
_PUNCT_RE = re.compile(r"[^\w\s]")
_WS_RE = re.compile(r"\s+")


def _norm(name: str) -> str:
    s = (name or "").lower()
    s = _PUNCT_RE.sub(" ", s)
    s = _SUFFIX_RE.sub(" ", s)
    return _WS_RE.sub(" ", s).strip()


def _domain(url: str | None) -> str | None:
    if not url:
        return None
    try:
        parsed = urlparse(url if "://" in url else f"https://{url}")
        host = parsed.netloc or parsed.path
        host = re.sub(r"^www\.", "", host).lower()
        parts = host.split(".")
        if len(parts) >= 2:
            return ".".join(parts[-2:])
        return host or None
    except Exception:
        return None


def _blank(v) -> bool:
    return v is None or (isinstance(v, str) and not v.strip())


def upgrade() -> None:
    op.create_table(
        "company_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("firm_id", sa.Integer(), nullable=False),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("hq", sa.String(255), nullable=True),
        sa.Column("website", sa.String(500), nullable=True),
        sa.Column("linkedin", sa.String(500), nullable=True),
        sa.Column("headcount", sa.Integer(), nullable=True),
        sa.Column("revenue_source", sa.Text(), nullable=True),
        sa.Column("revenue_inr_cr", sa.Numeric(15, 2), nullable=True),
        sa.Column("name_key", sa.String(255), nullable=False),
        sa.Column("domain_key", sa.String(255), nullable=True),
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
    with op.batch_alter_table("company_profiles") as batch_op:
        batch_op.create_index("ix_company_profiles_firm_id", ["firm_id"], unique=False)
        batch_op.create_index("ix_company_profiles_name_key", ["name_key"], unique=False)
        batch_op.create_index("ix_company_profiles_domain_key", ["domain_key"], unique=False)

    with op.batch_alter_table("companies") as batch_op:
        batch_op.add_column(sa.Column("profile_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_companies_profile_id", ["profile_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_companies_profile_id_company_profiles",
            "company_profiles",
            ["profile_id"],
            ["id"],
        )

    # ── Backfill: dedupe companies → profiles ─────────────────────────────────
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            """
            SELECT id, firm_id, company_name, website, hq, linkedin,
                   headcount, revenue_source, revenue_inr_cr
            FROM companies
            WHERE archived_at IS NULL
            """
        )
    ).fetchall()

    # Cluster by (firm_id, domain_key) when a website exists, else (firm_id, name_key).
    clusters: dict[tuple, list] = {}
    for r in rows:
        firm_id = r[1]
        dk = _domain(r[3])
        key = ("d", dk) if dk else ("n", _norm(r[2] or ""))
        clusters.setdefault((firm_id, key), []).append(r)

    for (firm_id, _key), members in clusters.items():
        def pick(idx: int):
            for m in members:
                if not _blank(m[idx]):
                    return m[idx]
            return None

        company_name = pick(2) or (members[0][2] or "")
        website = pick(3)
        profile_vals = {
            "firm_id": firm_id,
            "company_name": company_name,
            "website": website,
            "hq": pick(4),
            "linkedin": pick(5),
            "headcount": pick(6),
            "revenue_source": pick(7),
            "revenue_inr_cr": pick(8),
            "name_key": _norm(company_name),
            "domain_key": _domain(website),
        }
        conn.execute(
            sa.text(
                """
                INSERT INTO company_profiles
                    (firm_id, company_name, hq, website, linkedin, headcount,
                     revenue_source, revenue_inr_cr, name_key, domain_key,
                     created_at, updated_at)
                VALUES
                    (:firm_id, :company_name, :hq, :website, :linkedin, :headcount,
                     :revenue_source, :revenue_inr_cr, :name_key, :domain_key,
                     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """
            ),
            profile_vals,
        )
        profile_id = conn.execute(
            sa.text(
                """
                SELECT id FROM company_profiles
                WHERE firm_id = :firm_id AND name_key = :name_key
                ORDER BY id DESC LIMIT 1
                """
            ),
            {"firm_id": firm_id, "name_key": profile_vals["name_key"]},
        ).scalar()
        for m in members:
            conn.execute(
                sa.text("UPDATE companies SET profile_id = :pid WHERE id = :cid"),
                {"pid": profile_id, "cid": m[0]},
            )


def downgrade() -> None:
    with op.batch_alter_table("companies") as batch_op:
        batch_op.drop_constraint(
            "fk_companies_profile_id_company_profiles", type_="foreignkey"
        )
        batch_op.drop_index("ix_companies_profile_id")
        batch_op.drop_column("profile_id")

    with op.batch_alter_table("company_profiles") as batch_op:
        batch_op.drop_index("ix_company_profiles_domain_key")
        batch_op.drop_index("ix_company_profiles_name_key")
        batch_op.drop_index("ix_company_profiles_firm_id")
    op.drop_table("company_profiles")
