from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import ContactMode, OutreachEventType, Sentiment


class OutreachEventCreate(BaseModel):
    event_type: OutreachEventType
    occurred_on: date
    contact_id: int | None = None
    regarding: str | None = None
    notes: str | None = None
    mode: ContactMode | None = None
    sentiment: Sentiment | None = None


class OutreachEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    firm_id: int
    company_id: int
    schedule_id: int | None
    contact_id: int | None
    event_type: OutreachEventType
    occurred_on: date
    regarding: str | None
    notes: str | None
    mode: ContactMode | None = None
    sentiment: Sentiment | None = None
    owner_id: int
    created_at: datetime
