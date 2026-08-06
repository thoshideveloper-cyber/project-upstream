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
WB1_REVISION = "b2e4f6a8c0d1"
WB1_PREV_REVISION = "a1c3e5f7b9d0"


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


def _columns(sync_url: str, table: str) -> set[str]:
    engine = create_engine(sync_url)
    try:
        return {c["name"] for c in inspect(engine).get_columns(table)}
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


@pytest.mark.asyncio
async def test_wb1_upgrade_downgrade_upgrade(tmp_path, monkeypatch):
    """WB-1 widens the existing import tables rather than adding a parallel set, so the
    round-trip has to be checked at the *column* level, not just table presence."""
    db_file = tmp_path / "mig_wb1.db"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{db_file}")
    sync_url = settings.sync_database_url
    cfg = _alembic_config()

    added_to_rows = {
        "sheet_name",
        "resolved_company_id",
        "resolved_contact_id",
        "resolved_schedule_id",
    }
    added_to_batches = {"project_id", "summary"}

    command.upgrade(cfg, "head")
    assert added_to_rows <= _columns(sync_url, "import_rows")
    assert added_to_batches <= _columns(sync_url, "import_batches")

    command.downgrade(cfg, WB1_PREV_REVISION)
    assert not (added_to_rows & _columns(sync_url, "import_rows"))
    assert not (added_to_batches & _columns(sync_url, "import_batches"))
    # The tables themselves — and everything the CSV wizard needs — survive.
    assert {"import_rows", "import_batches", "companies", "contacts"} <= _tables(sync_url)
    assert "resolved_profile_id" in _columns(sync_url, "import_rows")

    command.upgrade(cfg, "head")
    assert added_to_rows <= _columns(sync_url, "import_rows")
    assert added_to_batches <= _columns(sync_url, "import_batches")
