"""Shared pytest fixtures: in-memory SQLite DB + test HTTP client."""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_session
from app.main import app
from app.models.firm import Firm
from app.models.mandate import Mandate
from app.models.mandate_assignment import MandateAssignment
from app.models.user import User
from app.models.enums import MandateStatus, MandateType, UserRole

# StaticPool keeps a single connection so the in-memory DB persists across requests.
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(autouse=True)
def _force_dev_cookie_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    """Override prod cookie settings so HTTPX sends cookies over plain http://test."""
    monkeypatch.setattr(settings, "cookie_secure", False)
    monkeypatch.setattr(settings, "cookie_samesite", "lax")


@pytest_asyncio.fixture
async def engine():
    eng = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def db_session(engine) -> AsyncSession:
    factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    async with factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncClient:
    async def _override():
        yield db_session

    app.dependency_overrides[get_session] = _override
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


# ── Domain fixtures ───────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def firm(db_session: AsyncSession) -> Firm:
    f = Firm(name="Test Firm")
    db_session.add(f)
    await db_session.commit()
    await db_session.refresh(f)
    return f


@pytest_asyncio.fixture
async def partner(db_session: AsyncSession, firm: Firm) -> User:
    u = User(
        firm_id=firm.id,
        email="partner@test.com",
        hashed_password=hash_password("Passw0rd!"),
        full_name="Test Partner",
        role=UserRole.PARTNER,
    )
    db_session.add(u)
    await db_session.commit()
    await db_session.refresh(u)
    return u


@pytest_asyncio.fixture
async def analyst(db_session: AsyncSession, firm: Firm) -> User:
    u = User(
        firm_id=firm.id,
        email="analyst@test.com",
        hashed_password=hash_password("Passw0rd!"),
        full_name="Test Analyst",
        role=UserRole.ANALYST,
    )
    db_session.add(u)
    await db_session.commit()
    await db_session.refresh(u)
    return u


@pytest_asyncio.fixture
async def mandate(db_session: AsyncSession, firm: Firm, partner: User) -> Mandate:
    m = Mandate(
        firm_id=firm.id,
        client_name="Test Client",
        name="Test Mandate",
        type=MandateType.SELL_SIDE,
        status=MandateStatus.ACTIVE,
        lead_owner_id=partner.id,
    )
    db_session.add(m)
    await db_session.commit()
    await db_session.refresh(m)
    return m


@pytest_asyncio.fixture
async def assigned_mandate(db_session: AsyncSession, mandate: Mandate, analyst: User) -> Mandate:
    """Mandate assigned to the analyst fixture."""
    db_session.add(MandateAssignment(mandate_id=mandate.id, user_id=analyst.id))
    await db_session.commit()
    return mandate
