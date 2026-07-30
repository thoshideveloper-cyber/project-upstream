"""Email pipeline routes — mailbox connection, templates, AI drafting, and sending.

Sending model: the analyst connects THEIR mailbox (Gmail / Outlook via OAuth, or
the Sandbox simulator). Every send goes out through the provider's own API from
that real account, then creates the corresponding OutreachEvent through the same
cadence primitives the manual log path uses — the append-only event log stays the
single source of truth, and the full message is archived in ``sent_emails``.
"""

from __future__ import annotations

import re
import time
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from sqlalchemy import func, select

from app.core import crypto
from app.core.config import settings
from app.core.deps import CurrentUser, SessionDep, visible_mandate_ids
from app.core.time import today_ist
from app.models.company import Company
from app.models.contact import Contact
from app.models.email_account import EmailAccount
from app.models.email_template import EmailTemplate
from app.models.enums import (
    ContactMode,
    EmailProvider,
    EmailSendStatus,
    EmailTemplateKind,
    OutreachEventType,
    ScheduleStatus,
    StoppedReason,
    UserRole,
)
from app.models.firm import Firm
from app.models.mandate import Mandate
from app.models.outreach_event import OutreachEvent
from app.models.outreach_schedule import OutreachSchedule
from app.models.sent_email import SentEmail
from app.models.user import User
from app.schemas.email import (
    EmailAccountRead,
    EmailAccountUpdate,
    EmailDraftBody,
    EmailDraftResult,
    EmailSendBody,
    EmailSendResult,
    EmailTemplateCreate,
    EmailTemplateRead,
    EmailTemplateUpdate,
)
from app.services import email_drafter
from app.services.cadence import (
    activate_schedule,
    effective_cap,
    get_followups_done,
    recompute_status,
    stop_schedule,
)
from app.services.email_sender import EmailSendError, send_email

router = APIRouter(prefix="/email", tags=["email"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
MS_AUTH_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize"
MS_TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
GRAPH_ME_URL = "https://graph.microsoft.com/v1.0/me"

GOOGLE_SCOPES = "https://www.googleapis.com/auth/gmail.send openid email profile"
MS_SCOPES = "offline_access User.Read Mail.Send"


# ── Helpers ───────────────────────────────────────────────────────────────────


def _redirect_uri(provider: str) -> str:
    return f"{settings.backend_public_url}/email/oauth/{provider}/callback"


def _frontend_redirect(query: dict[str, str]) -> RedirectResponse:
    return RedirectResponse(
        f"{settings.frontend_url.rstrip('/')}/schedule?{urlencode(query)}",
        status_code=302,
    )


def _oauth_state(user_id: int, provider: str) -> str:
    """Short-lived signed state — authenticates the browser redirect back to us."""
    payload = {
        "sub": str(user_id),
        "provider": provider,
        "purpose": "email_oauth",
        "exp": int(time.time()) + 600,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _parse_state(state: str, provider: str) -> int:
    try:
        payload = jwt.decode(state, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("purpose") != "email_oauth" or payload.get("provider") != provider:
            raise JWTError("wrong purpose")
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid OAuth state") from exc


async def _get_account(db, user_id: int) -> EmailAccount | None:
    result = await db.execute(select(EmailAccount).where(EmailAccount.user_id == user_id))
    return result.scalar_one_or_none()


async def _sends_today(db, user_id: int) -> int:
    """Sends counted for the pacing cap (SENT + SIMULATED, today UTC)."""
    result = await db.execute(
        select(func.count())
        .select_from(SentEmail)
        .where(
            SentEmail.user_id == user_id,
            SentEmail.status != EmailSendStatus.FAILED,
            func.date(SentEmail.created_at) == datetime.now(timezone.utc).date().isoformat(),
        )
    )
    return result.scalar() or 0


def _default_signature(name: str, firm_name: str) -> str:
    return f"{name}\n{firm_name}"


async def _upsert_account(
    db,
    user: User,
    *,
    provider: EmailProvider,
    email_address: str,
    display_name: str | None,
    refresh_token: str | None,
    access_token: str | None,
    expires_in: int | None,
) -> EmailAccount:
    account = await _get_account(db, user.id)
    firm = (await db.execute(select(Firm).where(Firm.id == user.firm_id))).scalar_one()
    if account is None:
        account = EmailAccount(
            firm_id=user.firm_id,
            user_id=user.id,
            provider=provider,
            email_address=email_address,
            daily_send_limit=settings.email_daily_limit_default,
        )
        db.add(account)
    account.provider = provider
    account.email_address = email_address
    account.display_name = display_name or user.full_name
    account.refresh_token_enc = crypto.encrypt(refresh_token) if refresh_token else None
    account.access_token_enc = crypto.encrypt(access_token) if access_token else None
    account.token_expires_at = (
        datetime.now(timezone.utc) + timedelta(seconds=expires_in) if expires_in else None
    )
    if not account.signature:
        account.signature = _default_signature(display_name or user.full_name, firm.name)
    await db.commit()
    return account


async def _get_visible_company(db, current_user: User, company_id: int) -> Company:
    result = await db.execute(
        select(Company).where(
            Company.id == company_id,
            Company.firm_id == current_user.firm_id,
            Company.archived_at.is_(None),
        )
    )
    company = result.scalar_one_or_none()
    if company is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Company not found")
    visible = await visible_mandate_ids(current_user, db)
    if visible is not None and company.mandate_id not in visible:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Company not found")
    return company


# ── Account ───────────────────────────────────────────────────────────────────


@router.get("/account", response_model=EmailAccountRead)
async def get_account(db: SessionDep, current_user: CurrentUser):
    account = await _get_account(db, current_user.id)
    providers = {
        "google": bool(settings.google_client_id and settings.google_client_secret),
        "microsoft": bool(settings.ms_client_id and settings.ms_client_secret),
        "sandbox": settings.email_sandbox_enabled,
    }
    if account is None:
        return EmailAccountRead(
            connected=False,
            ai_drafting=email_drafter.drafting_available(),
            daily_send_limit=settings.email_daily_limit_default,
            providers=providers,
        )
    return EmailAccountRead(
        connected=True,
        provider=account.provider,
        email_address=account.email_address,
        display_name=account.display_name,
        signature=account.signature,
        daily_send_limit=account.daily_send_limit,
        sends_today=await _sends_today(db, current_user.id),
        ai_drafting=email_drafter.drafting_available(),
        providers=providers,
    )


@router.post("/account/sandbox", response_model=EmailAccountRead, status_code=201)
async def connect_sandbox(db: SessionDep, current_user: CurrentUser):
    """Connect the Sandbox mailbox — sends are simulated but the pipeline is real."""
    if not settings.email_sandbox_enabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sandbox sending is disabled")
    await _upsert_account(
        db,
        current_user,
        provider=EmailProvider.SANDBOX,
        email_address=current_user.email,
        display_name=current_user.full_name,
        refresh_token=None,
        access_token=None,
        expires_in=None,
    )
    return await get_account(db, current_user)


@router.patch("/account", response_model=EmailAccountRead)
async def update_account(body: EmailAccountUpdate, db: SessionDep, current_user: CurrentUser):
    account = await _get_account(db, current_user.id)
    if account is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No email account connected")
    if body.signature is not None:
        account.signature = body.signature.strip() or None
    if body.display_name is not None:
        account.display_name = body.display_name.strip() or None
    if body.daily_send_limit is not None:
        account.daily_send_limit = body.daily_send_limit
    await db.commit()
    return await get_account(db, current_user)


@router.delete("/account", status_code=204)
async def disconnect_account(db: SessionDep, current_user: CurrentUser):
    account = await _get_account(db, current_user.id)
    if account is None:
        return
    # Best-effort token revocation at the provider; local disconnect always succeeds.
    if account.provider == EmailProvider.GOOGLE and account.refresh_token_enc:
        token = crypto.decrypt(account.refresh_token_enc)
        if token:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(GOOGLE_REVOKE_URL, params={"token": token})
            except httpx.HTTPError:
                pass
    await db.delete(account)
    await db.commit()


# ── OAuth (Gmail / Outlook) ───────────────────────────────────────────────────


@router.get("/oauth/{provider}/start")
async def oauth_start(provider: str, current_user: CurrentUser):
    """Return the provider consent URL; the frontend navigates the browser there."""
    state = _oauth_state(current_user.id, provider)
    if provider == "google":
        if not (settings.google_client_id and settings.google_client_secret):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Google OAuth is not configured")
        url = f"{GOOGLE_AUTH_URL}?" + urlencode({
            "client_id": settings.google_client_id,
            "redirect_uri": _redirect_uri("google"),
            "response_type": "code",
            "scope": GOOGLE_SCOPES,
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        })
        return {"url": url}
    if provider == "microsoft":
        if not (settings.ms_client_id and settings.ms_client_secret):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Microsoft OAuth is not configured")
        url = MS_AUTH_URL.format(tenant=settings.ms_tenant) + "?" + urlencode({
            "client_id": settings.ms_client_id,
            "redirect_uri": _redirect_uri("microsoft"),
            "response_type": "code",
            "scope": MS_SCOPES,
            "response_mode": "query",
            "state": state,
        })
        return {"url": url}
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown provider")


@router.get("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    db: SessionDep,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
):
    """Provider redirect target. Auth comes from the signed state, not cookies."""
    if provider not in ("google", "microsoft"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown provider")
    if error or not code or not state:
        return _frontend_redirect({"email_error": error or "Connection was cancelled"})

    user_id = _parse_state(state, provider)
    user = (
        await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    ).scalar_one_or_none()
    if user is None:
        return _frontend_redirect({"email_error": "Session expired — sign in and retry"})

    try:
        if provider == "google":
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(GOOGLE_TOKEN_URL, data={
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": _redirect_uri("google"),
                })
            if resp.status_code != 200:
                return _frontend_redirect({"email_error": "Google rejected the connection"})
            tokens = resp.json()
            claims = jwt.get_unverified_claims(tokens["id_token"])
            await _upsert_account(
                db,
                user,
                provider=EmailProvider.GOOGLE,
                email_address=claims["email"],
                display_name=claims.get("name"),
                refresh_token=tokens.get("refresh_token"),
                access_token=tokens.get("access_token"),
                expires_in=tokens.get("expires_in"),
            )
            return _frontend_redirect({"email_connected": "google"})

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(MS_TOKEN_URL.format(tenant=settings.ms_tenant), data={
                "client_id": settings.ms_client_id,
                "client_secret": settings.ms_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": _redirect_uri("microsoft"),
                "scope": MS_SCOPES,
            })
            if resp.status_code != 200:
                return _frontend_redirect({"email_error": "Microsoft rejected the connection"})
            tokens = resp.json()
            me = await client.get(
                GRAPH_ME_URL, headers={"Authorization": f"Bearer {tokens['access_token']}"}
            )
            profile = me.json() if me.status_code == 200 else {}
        address = profile.get("mail") or profile.get("userPrincipalName") or user.email
        await _upsert_account(
            db,
            user,
            provider=EmailProvider.MICROSOFT,
            email_address=address,
            display_name=profile.get("displayName"),
            refresh_token=tokens.get("refresh_token"),
            access_token=tokens.get("access_token"),
            expires_in=tokens.get("expires_in"),
        )
        return _frontend_redirect({"email_connected": "microsoft"})
    except (httpx.HTTPError, KeyError, JWTError):
        return _frontend_redirect({"email_error": "Connection failed — try again"})


# ── Templates ─────────────────────────────────────────────────────────────────


@router.get("/templates")
async def list_templates(db: SessionDep, current_user: CurrentUser):
    result = await db.execute(
        select(EmailTemplate)
        .where(
            EmailTemplate.firm_id == current_user.firm_id,
            EmailTemplate.archived_at.is_(None),
            (
                (EmailTemplate.owner_id == current_user.id)
                | (EmailTemplate.owner_id.is_(None))
                | (EmailTemplate.is_shared.is_(True))
            ),
        )
        .order_by(EmailTemplate.use_count.desc(), EmailTemplate.name)
    )
    items = [EmailTemplateRead.model_validate(t) for t in result.scalars().all()]
    return {"items": items, "total": len(items)}


@router.post("/templates", status_code=201, response_model=EmailTemplateRead)
async def create_template(body: EmailTemplateCreate, db: SessionDep, current_user: CurrentUser):
    tpl = EmailTemplate(
        firm_id=current_user.firm_id,
        owner_id=current_user.id,
        name=body.name.strip(),
        kind=body.kind,
        subject=body.subject.strip(),
        body=body.body,
        is_shared=body.is_shared,
    )
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return EmailTemplateRead.model_validate(tpl)


def _can_edit_template(tpl: EmailTemplate, user: User) -> bool:
    if tpl.owner_id == user.id:
        return True
    # Firm-shared starters (no owner) are partner-managed.
    return tpl.owner_id is None and user.role == UserRole.PARTNER


async def _get_template(db, current_user: User, template_id: int) -> EmailTemplate:
    result = await db.execute(
        select(EmailTemplate).where(
            EmailTemplate.id == template_id,
            EmailTemplate.firm_id == current_user.firm_id,
            EmailTemplate.archived_at.is_(None),
        )
    )
    tpl = result.scalar_one_or_none()
    if tpl is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    return tpl


@router.patch("/templates/{template_id}", response_model=EmailTemplateRead)
async def update_template(
    template_id: int, body: EmailTemplateUpdate, db: SessionDep, current_user: CurrentUser
):
    tpl = await _get_template(db, current_user, template_id)
    if not _can_edit_template(tpl, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own templates")
    for field in ("name", "kind", "subject", "body", "is_shared"):
        value = getattr(body, field)
        if value is not None:
            setattr(tpl, field, value.strip() if isinstance(value, str) and field != "body" else value)
    await db.commit()
    await db.refresh(tpl)
    return EmailTemplateRead.model_validate(tpl)


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(template_id: int, db: SessionDep, current_user: CurrentUser):
    tpl = await _get_template(db, current_user, template_id)
    if not _can_edit_template(tpl, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only delete your own templates")
    tpl.archived_at = datetime.now(timezone.utc)
    await db.commit()


# ── Send ──────────────────────────────────────────────────────────────────────


@router.post("/send", response_model=EmailSendResult, status_code=201)
async def send(body: EmailSendBody, db: SessionDep, current_user: CurrentUser):
    """Send one email from the analyst's mailbox and log the outreach event.

    The event goes through the same cadence primitives as the manual log path:
    INITIAL_EMAIL activates the schedule; FOLLOW_UP advances it and may exhaust it.
    """
    if body.event_type not in (OutreachEventType.INITIAL_EMAIL, OutreachEventType.FOLLOW_UP):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Emails log as initial or follow-up only")
    if not _EMAIL_RE.match(body.to_email.strip()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Enter a valid recipient address")

    account = await _get_account(db, current_user.id)
    if account is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Connect your email account first")

    company = await _get_visible_company(db, current_user, body.company_id)

    sends_today = await _sends_today(db, current_user.id)
    if sends_today >= account.daily_send_limit:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Daily send limit reached ({account.daily_send_limit}). "
            "Pacing keeps your mail out of spam — raise the limit in Settings if needed.",
        )

    contact: Contact | None = None
    if body.contact_id:
        contact = (
            await db.execute(
                select(Contact).where(
                    Contact.id == body.contact_id,
                    Contact.company_id == company.id,
                    Contact.archived_at.is_(None),
                )
            )
        ).scalar_one_or_none()

    # Signature is appended server-side so the archive matches the wire exactly.
    final_body = body.body.rstrip()
    if account.signature:
        final_body = f"{final_body}\n\n{account.signature}"

    to_email = body.to_email.strip()
    try:
        result = await send_email(
            account, to_email=to_email, subject=body.subject.strip(), body_text=final_body
        )
    except EmailSendError as exc:
        failed = SentEmail(
            firm_id=current_user.firm_id,
            user_id=current_user.id,
            company_id=company.id,
            contact_id=contact.id if contact else None,
            to_email=to_email,
            subject=body.subject.strip(),
            body_text=final_body,
            status=EmailSendStatus.FAILED,
            error=str(exc),
        )
        db.add(failed)
        await db.commit()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc

    # ── Log the outreach event (same primitives as the manual path) ──
    sched = (
        await db.execute(
            select(OutreachSchedule).where(
                OutreachSchedule.company_id == company.id,
                OutreachSchedule.is_current.is_(True),
            )
        )
    ).scalar_one_or_none()

    occurred_on: date = today_ist()
    event = OutreachEvent(
        firm_id=current_user.firm_id,
        company_id=company.id,
        schedule_id=sched.id if sched else None,
        contact_id=contact.id if contact else None,
        event_type=body.event_type,
        occurred_on=occurred_on,
        notes=body.notes,
        mode=ContactMode.EMAIL,
        owner_id=current_user.id,
    )
    db.add(event)

    if body.event_type == OutreachEventType.INITIAL_EMAIL and sched:
        await activate_schedule(db, sched, occurred_on)

    if (
        body.event_type == OutreachEventType.FOLLOW_UP
        and sched
        and sched.status == ScheduleStatus.ACTIVE
    ):
        await db.flush()
        fu_done = await get_followups_done(db, sched.id)
        firm = (await db.execute(select(Firm).where(Firm.id == current_user.firm_id))).scalar_one()
        mandate = (
            await db.execute(select(Mandate).where(Mandate.id == company.mandate_id))
        ).scalar_one()
        if fu_done >= effective_cap(firm, mandate):
            await stop_schedule(db, sched, StoppedReason.EXHAUSTED)

    await db.flush()
    await recompute_status(db, company)

    if contact:
        contact.mode = ContactMode.EMAIL
        contact.last_contact_date = occurred_on

    sent = SentEmail(
        firm_id=current_user.firm_id,
        user_id=current_user.id,
        company_id=company.id,
        contact_id=contact.id if contact else None,
        event_id=event.id,
        to_email=to_email,
        subject=body.subject.strip(),
        body_text=final_body,
        status=EmailSendStatus.SIMULATED if result.simulated else EmailSendStatus.SENT,
        provider_message_id=result.provider_message_id,
    )
    db.add(sent)
    account.last_used_at = datetime.now(timezone.utc)

    if body.template_id:
        tpl = (
            await db.execute(
                select(EmailTemplate).where(
                    EmailTemplate.id == body.template_id,
                    EmailTemplate.firm_id == current_user.firm_id,
                )
            )
        ).scalar_one_or_none()
        if tpl:
            tpl.use_count += 1

    await db.flush()
    sent_id = sent.id
    event_id = event.id
    await db.commit()

    return EmailSendResult(
        status=EmailSendStatus.SIMULATED if result.simulated else EmailSendStatus.SENT,
        event_id=event_id,
        sent_email_id=sent_id,
        sends_today=sends_today + 1,
        daily_limit=account.daily_send_limit,
    )


# ── Sent archive (per company — the dossier's email history) ──────────────────


@router.get("/sent")
async def list_sent(
    db: SessionDep,
    current_user: CurrentUser,
    company_id: int = Query(...),
    limit: int = Query(default=20, ge=1, le=100),
):
    await _get_visible_company(db, current_user, company_id)
    result = await db.execute(
        select(SentEmail)
        .where(
            SentEmail.firm_id == current_user.firm_id,
            SentEmail.company_id == company_id,
        )
        .order_by(SentEmail.created_at.desc())
        .limit(limit)
    )
    items = [
        {
            "id": s.id,
            "to_email": s.to_email,
            "subject": s.subject,
            "body_text": s.body_text,
            "status": s.status,
            "created_at": s.created_at,
        }
        for s in result.scalars().all()
    ]
    return {"items": items, "total": len(items)}


# ── AI draft ──────────────────────────────────────────────────────────────────


@router.post("/draft", response_model=EmailDraftResult)
async def draft(body: EmailDraftBody, db: SessionDep, current_user: CurrentUser):
    """Draft a subject + body with AI from real CRM context. Fills the editor only."""
    if not email_drafter.drafting_available():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI drafting is not configured")

    company = await _get_visible_company(db, current_user, body.company_id)
    mandate = (
        await db.execute(select(Mandate).where(Mandate.id == company.mandate_id))
    ).scalar_one()
    sched = (
        await db.execute(
            select(OutreachSchedule).where(
                OutreachSchedule.company_id == company.id,
                OutreachSchedule.is_current.is_(True),
            )
        )
    ).scalar_one_or_none()

    contact: Contact | None = None
    if body.contact_id:
        contact = (
            await db.execute(select(Contact).where(Contact.id == body.contact_id))
        ).scalar_one_or_none()

    recent = (
        await db.execute(
            select(OutreachEvent)
            .where(OutreachEvent.company_id == company.id)
            .order_by(OutreachEvent.occurred_on.desc(), OutreachEvent.id.desc())
            .limit(3)
        )
    ).scalars().all()

    deal_type = {
        "SELL_SIDE": "sell-side M&A",
        "BUY_SIDE": "buy-side M&A",
        "CAPITAL_RAISE": "capital raise",
    }.get(mandate.type.value, "M&A")

    fu_done = await get_followups_done(db, sched.id) if sched else None

    context = {
        "email_kind": "first introduction"
        if body.kind == OutreachEventType.INITIAL_EMAIL
        else "follow-up",
        "company": company.company_name,
        "company_hq": company.hq,
        "why_this_company": company.rationale,
        "mandate_type": deal_type,
        "regarding": sched.regarding if sched else None,
        "contact_first_name": contact.contact_person.split()[0] if contact else None,
        "contact_full_name": contact.contact_person if contact else None,
        "contact_designation": contact.designation if contact else None,
        "followups_already_sent": fu_done,
        "days_since_last_touch": None,
        "recent_touches": [
            {
                "type": e.event_type.value,
                "date": e.occurred_on.isoformat(),
                "sentiment": e.sentiment.value if e.sentiment else None,
                "notes": (e.notes or "")[:200] or None,
            }
            for e in recent
        ],
        "sender_first_name": current_user.full_name.split()[0],
    }
    if recent:
        context["days_since_last_touch"] = (today_ist() - recent[0].occurred_on).days

    try:
        result = await email_drafter.draft_email(
            context, tone=body.tone, instructions=body.instructions
        )
    except email_drafter.DraftError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    return EmailDraftResult(**result)
