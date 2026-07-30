"""Pydantic schemas for the email pipeline (accounts, templates, send, draft)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import EmailProvider, EmailSendStatus, EmailTemplateKind, OutreachEventType


class EmailAccountRead(BaseModel):
    """Connection status — never exposes token material."""

    connected: bool
    provider: EmailProvider | None = None
    email_address: str | None = None
    display_name: str | None = None
    signature: str | None = None
    daily_send_limit: int = 50
    sends_today: int = 0
    ai_drafting: bool = False
    # Which connect options this install can offer.
    providers: dict[str, bool] = Field(default_factory=dict)


class EmailAccountUpdate(BaseModel):
    signature: str | None = None
    display_name: str | None = None
    daily_send_limit: int | None = Field(default=None, ge=1, le=200)


class EmailTemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int | None
    name: str
    kind: EmailTemplateKind
    subject: str
    body: str
    is_shared: bool
    use_count: int
    updated_at: datetime


class EmailTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kind: EmailTemplateKind = EmailTemplateKind.FOLLOW_UP
    subject: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1)
    is_shared: bool = False


class EmailTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    kind: EmailTemplateKind | None = None
    subject: str | None = Field(default=None, min_length=1, max_length=300)
    body: str | None = Field(default=None, min_length=1)
    is_shared: bool | None = None


class EmailSendBody(BaseModel):
    company_id: int
    to_email: str = Field(min_length=3, max_length=255)
    subject: str = Field(min_length=1, max_length=500)
    body: str = Field(min_length=1)
    contact_id: int | None = None
    # Only real sends: an email is an INITIAL_EMAIL or a FOLLOW_UP, never an outcome.
    event_type: OutreachEventType = OutreachEventType.FOLLOW_UP
    notes: str | None = None
    template_id: int | None = None


class EmailSendResult(BaseModel):
    status: EmailSendStatus
    event_id: int | None
    sent_email_id: int
    sends_today: int
    daily_limit: int


class EmailDraftBody(BaseModel):
    company_id: int
    contact_id: int | None = None
    kind: OutreachEventType = OutreachEventType.FOLLOW_UP
    tone: str = Field(default="direct", pattern="^(direct|warm|formal)$")
    instructions: str | None = Field(default=None, max_length=500)


class EmailDraftResult(BaseModel):
    subject: str
    body: str
