from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import ContactMode, Engagement, Sentiment


class ContactBase(BaseModel):
    company_id: int
    contact_person: str
    designation: str | None = None
    email: str | None = None
    phone: str | None = None
    linkedin: str | None = None
    reason: str | None = None
    engagement: Engagement | None = None
    date_connected: date | None = None
    mode: ContactMode | None = None
    poc_owner_id: int | None = None
    remark: str | None = None
    sentiment: Sentiment | None = None
    comments: str | None = None
    is_primary: bool = False


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    contact_person: str | None = None
    designation: str | None = None
    email: str | None = None
    phone: str | None = None
    linkedin: str | None = None
    reason: str | None = None
    engagement: Engagement | None = None
    date_connected: date | None = None
    mode: ContactMode | None = None
    poc_owner_id: int | None = None
    remark: str | None = None
    sentiment: Sentiment | None = None
    comments: str | None = None
    is_primary: bool | None = None


class ContactRead(ContactBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    firm_id: int
    last_contact_date: date | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
