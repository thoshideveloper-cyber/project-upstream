"""Migration integrity — MIG-1 upgrade → downgrade → upgrade is clean on SQLite.

Runs the full Alembic chain against a temp SQLite file (through the sync driver, as in
prod), steps the SL-1 revision down and back up, and asserts the funnel tables toggle.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from app.core.config import settings

BACKEND_DIR = Path(__file__).resolve().parents[1]
SL1_REVISION = "a7c9e1b2d3f4"
PREV_REVISION = "f4b3c5d7e9a0"


def _alembic_config() -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    return cfg


def _tables(sync_url: str) -> set[str]:
    engine = create_engine(sync_url)
    try:
        return set(inspect(engine).get_table_names())
    finally:
        engine.dispose()


@pytest.mark.asyncio
async def test_mig1_upgrade_downgrade_upgrade(tmp_path, monkeypatch):
    db_file = tmp_path / "mig_test.db"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{db_file}")
    sync_url = settings.sync_database_url
    cfg = _alembic_config()

    command.upgrade(cfg, "head")
    tables = _tables(sync_url)
    assert "sourcing_stages" in tables
    assert "sourcing_candidates" in tables

    command.downgrade(cfg, PREV_REVISION)
    tables = _tables(sync_url)
    assert "sourcing_stages" not in tables
    assert "sourcing_candidates" not in tables
    # Prior tables survive the downgrade.
    assert "companies" in tables
    assert "company_profiles" in tables

    command.upgrade(cfg, "head")
    tables = _tables(sync_url)
    assert "sourcing_stages" in tables
    assert "sourcing_candidates" in tables


@pytest.mark.asyncio
async def test_mig1_backfills_candidates_from_placements(tmp_path, monkeypatch):
    """A placed company with an INITIAL_EMAIL backfills as an Active-outreach candidate."""
    db_file = tmp_path / "mig_backfill.db"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{db_file}")
    sync_url = settings.sync_database_url
    cfg = _alembic_config()

    # Bring the schema up to just before SL-1, then seed a placement by hand.
    command.upgrade(cfg, PREV_REVISION)
    engine = create_engine(sync_url)
    with engine.begin() as conn:
        from sqlalchemy import text

        conn.execute(text("INSERT INTO firms (id, name, follow_up_cap) VALUES (1, 'F', 4)"))
        conn.execute(
            text(
                "INSERT INTO projects (id, firm_id, name, client_name) "
                "VALUES (1, 1, 'P', 'C')"
            )
        )
        conn.execute(
            text(
                "INSERT INTO mandates (id, firm_id, project_id, client_name, name, type, status) "
                "VALUES (1, 1, 1, 'C', 'M', 'SELL_SIDE', 'ACTIVE')"
            )
        )
        conn.execute(
            text(
                "INSERT INTO company_profiles (id, firm_id, company_name, name_key) "
                "VALUES (1, 1, 'Acme', 'acme')"
            )
        )
        conn.execute(
            text(
                "INSERT INTO companies (id, firm_id, mandate_id, profile_id, company_name, "
                "type, status, category, source, source_quality) "
                "VALUES (1, 1, 1, 1, 'Acme', 'BUYER', 'CONTACTED', 'OTHER', "
                "'PROPRIETARY', 'MEDIUM')"
            )
        )
    engine.dispose()

    command.upgrade(cfg, "head")

    engine = create_engine(sync_url)
    with engine.connect() as conn:
        from sqlalchemy import text

        row = conn.execute(
            text(
                "SELECT c.company_id, s.kind FROM sourcing_candidates c "
                "JOIN sourcing_stages s ON s.id = c.stage_id WHERE c.mandate_id = 1"
            )
        ).fetchone()
    engine.dispose()
    assert row is not None
    assert row[0] == 1  # company_id linked
    assert row[1] == "ACTIVE"  # CONTACTED status → Active outreach
