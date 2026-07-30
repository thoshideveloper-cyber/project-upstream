"""Outbound email through the analyst's own mailbox (Gmail API / Microsoft Graph).

Deliverability model — why this never looks like bot mail:
- The message is sent BY the analyst's real account via the provider's own API, so
  Google/Microsoft sign SPF/DKIM/DMARC for their own domain. To the receiving
  server it is byte-for-byte an email the analyst wrote in Gmail/Outlook.
- It lands in the analyst's Sent folder; replies thread back to their inbox.
- Plain-text MIME, exactly one recipient, no tracking pixels, no link shorteners.
- A per-analyst daily cap (EmailAccount.daily_send_limit) keeps volume at the
  steady 1:1 pace providers expect from a human mailbox.

SANDBOX provider short-circuits the network call and reports SIMULATED — the whole
pipeline (compose → send → outreach event → archive) works in demo installs.
"""

from __future__ import annotations

import base64
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr

import httpx

from app.core import crypto
from app.core.config import settings
from app.models.email_account import EmailAccount
from app.models.enums import EmailProvider

logger = logging.getLogger("upstream.email")

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
MS_TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
MS_SEND_URL = "https://graph.microsoft.com/v1.0/me/sendMail"


class EmailSendError(RuntimeError):
    """Send failed for a reason the analyst can act on (message in .args[0])."""


@dataclass
class SendResult:
    simulated: bool
    provider_message_id: str | None = None


def build_mime(
    *, from_name: str | None, from_email: str, to_email: str, subject: str, body_text: str
) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = formataddr((from_name or from_email, from_email))
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body_text)
    return msg


async def _refresh_access_token(account: EmailAccount) -> str:
    """Exchange the stored refresh token for a live access token (cached until expiry)."""
    now = datetime.now(timezone.utc)
    if account.access_token_enc and account.token_expires_at:
        expires = account.token_expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires - timedelta(minutes=2) > now:
            token = crypto.decrypt(account.access_token_enc)
            if token:
                return token

    refresh = crypto.decrypt(account.refresh_token_enc or "")
    if not refresh:
        raise EmailSendError("Mailbox connection expired — reconnect your email account.")

    if account.provider == EmailProvider.GOOGLE:
        url = GOOGLE_TOKEN_URL
        data = {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "refresh_token": refresh,
            "grant_type": "refresh_token",
        }
    else:
        url = MS_TOKEN_URL.format(tenant=settings.ms_tenant)
        data = {
            "client_id": settings.ms_client_id,
            "client_secret": settings.ms_client_secret,
            "refresh_token": refresh,
            "grant_type": "refresh_token",
            "scope": "https://graph.microsoft.com/Mail.Send offline_access",
        }

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(url, data=data)
    if resp.status_code != 200:
        logger.warning("token refresh failed (%s): %s", account.provider, resp.text[:300])
        raise EmailSendError("Mailbox connection expired — reconnect your email account.")

    payload = resp.json()
    access_token = payload["access_token"]
    account.access_token_enc = crypto.encrypt(access_token)
    account.token_expires_at = now + timedelta(seconds=int(payload.get("expires_in", 3600)))
    # Microsoft rotates refresh tokens on use; keep the newest one.
    if payload.get("refresh_token"):
        account.refresh_token_enc = crypto.encrypt(payload["refresh_token"])
    return access_token


async def send_email(
    account: EmailAccount, *, to_email: str, subject: str, body_text: str
) -> SendResult:
    """Send one plain-text email from the analyst's mailbox. Raises EmailSendError."""
    if account.provider == EmailProvider.SANDBOX:
        return SendResult(simulated=True)

    access_token = await _refresh_access_token(account)
    headers = {"Authorization": f"Bearer {access_token}"}

    if account.provider == EmailProvider.GOOGLE:
        msg = build_mime(
            from_name=account.display_name,
            from_email=account.email_address,
            to_email=to_email,
            subject=subject,
            body_text=body_text,
        )
        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(GOOGLE_SEND_URL, headers=headers, json={"raw": raw})
        if resp.status_code not in (200, 202):
            logger.warning("gmail send failed: %s %s", resp.status_code, resp.text[:300])
            raise EmailSendError("Gmail rejected the send — try again or reconnect.")
        return SendResult(simulated=False, provider_message_id=resp.json().get("id"))

    # Microsoft Graph
    payload = {
        "message": {
            "subject": subject,
            "body": {"contentType": "Text", "content": body_text},
            "toRecipients": [{"emailAddress": {"address": to_email}}],
        },
        "saveToSentItems": True,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(MS_SEND_URL, headers=headers, json=payload)
    if resp.status_code != 202:
        logger.warning("graph send failed: %s %s", resp.status_code, resp.text[:300])
        raise EmailSendError("Outlook rejected the send — try again or reconnect.")
    return SendResult(simulated=False, provider_message_id=None)
