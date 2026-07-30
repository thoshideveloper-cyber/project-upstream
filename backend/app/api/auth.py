"""Auth router — signup / login / refresh / logout / me."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, SessionDep
from app.core.security import (
    clear_auth_cookies,
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    set_auth_cookies,
    verify_password,
)
from app.core.config import settings
from app.core.time import utcnow
from app.models.enums import UserRole
from app.models.firm import Firm
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.user import UserWithFirm

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Request bodies ────────────────────────────────────────────────────────────


class SignupRequest(BaseModel):
    firm_name: str
    full_name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    # Login matches an existing stored account, so we accept a plain string rather than
    # EmailStr. Deliverability validation belongs at signup; enforcing it here would lock
    # out legitimately-stored accounts (e.g. the RFC-6761 reserved `.test` demo domain).
    email: str
    password: str


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _user_with_firm(db, user_id: int) -> User:
    """Reload a user with their firm eagerly loaded."""
    result = await db.execute(
        select(User).options(selectinload(User.firm)).where(User.id == user_id)
    )
    return result.scalar_one()


async def _issue_tokens(response: Response, user: User, db) -> None:
    """Create a refresh token row and write both cookies."""
    raw_refresh = generate_refresh_token()
    hashed = hash_refresh_token(raw_refresh)
    expires = utcnow() + __import__("datetime").timedelta(days=settings.refresh_token_days)
    db.add(RefreshToken(user_id=user.id, hashed_token=hashed, expires_at=expires))
    await db.flush()
    access = create_access_token(user.id, user.token_version)
    set_auth_cookies(response, access, raw_refresh)


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/signup", response_model=UserWithFirm, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest, response: Response, db: SessionDep):
    """Create a new firm and its first user (PARTNER)."""
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    firm = Firm(name=body.firm_name)
    db.add(firm)
    await db.flush()

    # Seed the firm's default counterparty-category vocabulary (§7.2) + funnel stages.
    from app.services.classification import seed_firm_categories
    from app.services.providers.registry import seed_firm_data_sources
    from app.services.sourcing import seed_firm_stages

    await seed_firm_categories(db, firm.id)
    await seed_firm_stages(db, firm.id)
    await seed_firm_data_sources(db, firm.id)

    user = User(
        firm_id=firm.id,
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=UserRole.PARTNER,
    )
    db.add(user)
    await db.flush()

    await _issue_tokens(response, user, db)
    await db.commit()

    return await _user_with_firm(db, user.id)


@router.post("/login", response_model=UserWithFirm)
async def login(body: LoginRequest, response: Response, db: SessionDep):
    """Verify credentials and set auth cookies."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    await _issue_tokens(response, user, db)
    await db.commit()

    return await _user_with_firm(db, user.id)


@router.post("/refresh", response_model=UserWithFirm)
async def refresh(request: Request, response: Response, db: SessionDep):
    """Rotate the refresh token and issue a new access token."""
    raw = request.cookies.get(settings.refresh_cookie_name)
    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    hashed = hash_refresh_token(raw)
    now = utcnow()

    result = await db.execute(
        select(RefreshToken)
        .where(
            RefreshToken.hashed_token == hashed,
            RefreshToken.revoked.is_(False),
            RefreshToken.expires_at > now,
        )
    )
    token_row = result.scalar_one_or_none()
    if not token_row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalid or expired")

    result = await db.execute(
        select(User).where(User.id == token_row.user_id, User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Revoke the used refresh token (rotation)
    token_row.revoked = True
    await db.flush()

    # Issue new pair
    await _issue_tokens(response, user, db)
    await db.commit()

    return await _user_with_firm(db, user.id)


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(request: Request, response: Response, db: SessionDep):
    """Revoke the refresh token and clear cookies."""
    raw = request.cookies.get(settings.refresh_cookie_name)
    if raw:
        hashed = hash_refresh_token(raw)
        result = await db.execute(
            select(RefreshToken).where(RefreshToken.hashed_token == hashed, RefreshToken.revoked.is_(False))
        )
        token_row = result.scalar_one_or_none()
        if token_row:
            token_row.revoked = True
            await db.commit()

    clear_auth_cookies(response)
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserWithFirm)
async def me(current_user: CurrentUser, db: SessionDep):
    """Return the currently authenticated user with firm."""
    return await _user_with_firm(db, current_user.id)
