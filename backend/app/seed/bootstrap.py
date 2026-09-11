"""Empty-canvas bootstrap — the real initialisation path, dev and prod.

This creates exactly what a firm starts with on day one and not one row more: the firm,
its category vocabulary, its funnel stages, a partner, a few analysts, and the shipped
company database that makes Discover searchable (``app/data/company_pool.py`` — real
organisations only). No projects, no companies, no contacts, no schedules, no outreach:
that book arrives through ``/import`` from the firm's own workbooks.

``seed.py`` beside this file fabricates a Faker demo book instead. It is a local
development toy — never the deploy path, and it refuses to run against a non-SQLite
database for exactly that reason.

    python -m app.seed.bootstrap --reset
    python -m app.seed.bootstrap --no-pool   # firm + users only, empty Discover too
"""

from __future__ import annotations

import argparse

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.models.company_category import CompanyCategoryVocab
from app.models.enums import UserRole
from app.models.firm import Firm
from app.models.sourcing_stage import SourcingStage
from app.models.user import User
from app.services.classification import DEFAULT_CATEGORIES
from app.services.pool import seed_firm_pool_sync
from app.services.sourcing import DEFAULT_STAGES

PASSWORD = "Passw0rd!"
USERS: list[tuple[str, str, UserRole]] = [
    ("partner@upstream.test", "Priya Menon", UserRole.PARTNER),
    ("analyst1@upstream.test", "Vighnesh Rao", UserRole.ANALYST),
    ("analyst2@upstream.test", "Aditi Sharma", UserRole.ANALYST),
]


def bootstrap(session: Session, firm_name: str = "Upstream Advisors") -> Firm:
    """Idempotently create the firm, its vocabulary, its funnel stages and its users."""
    firm = session.execute(select(Firm).where(Firm.name == firm_name)).scalar_one_or_none()
    if firm is None:
        firm = Firm(name=firm_name)
        session.add(firm)
        session.flush()

    existing_codes = {
        row[0]
        for row in session.execute(
            select(CompanyCategoryVocab.code).where(CompanyCategoryVocab.firm_id == firm.id)
        ).all()
    }
    for code, name, sort_order in DEFAULT_CATEGORIES:
        if code not in existing_codes:
            session.add(
                CompanyCategoryVocab(firm_id=firm.id, name=name, code=code, sort_order=sort_order)
            )

    has_stages = session.execute(
        select(SourcingStage.id).where(SourcingStage.firm_id == firm.id).limit(1)
    ).first()
    if has_stages is None:
        for name, kind, sort_order in DEFAULT_STAGES:
            session.add(
                SourcingStage(firm_id=firm.id, name=name, kind=kind, sort_order=sort_order)
            )

    for email, full_name, role in USERS:
        exists = session.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if exists is None:
            session.add(
                User(
                    firm_id=firm.id,
                    email=email,
                    hashed_password=hash_password(PASSWORD),
                    full_name=full_name,
                    role=role,
                )
            )
    session.commit()
    return firm


def main() -> None:
    parser = argparse.ArgumentParser(description="Create an empty firm (no client data).")
    parser.add_argument("--reset", action="store_true", help="Wipe all data first.")
    parser.add_argument(
        "--no-pool",
        action="store_true",
        help="Skip the shipped company database (leaves Discover empty too).",
    )
    parser.add_argument("--firm", default="Upstream Advisors")
    args = parser.parse_args()

    engine = create_engine(settings.sync_database_url, future=True)
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        if args.reset:
            for table in reversed(Base.metadata.sorted_tables):
                session.execute(table.delete())
            session.commit()
        firm = bootstrap(session, args.firm)
        firm_name = firm.name
        # One transaction, one engine, no event loop: the firm and its company database
        # land together or not at all.
        planted = None if args.no_pool else seed_firm_pool_sync(session, firm.id)
        session.commit()
    engine.dispose()

    print(f"Firm '{firm_name}' ready — no client book, nothing imported.")
    if planted:
        print(
            f"Company database: {planted['pool_after']} companies "
            f"(+{planted['added']} planted from the shipped dataset)."
        )
    print(f"Logins (password {PASSWORD}):")
    for email, full_name, role in USERS:
        print(f"  {role.value:<8} {email:<26} {full_name}")


if __name__ == "__main__":
    main()
