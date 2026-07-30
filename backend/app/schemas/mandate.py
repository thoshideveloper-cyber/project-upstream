from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.enums import MandateStatus, MandateType


class MandateBase(BaseModel):
    client_name: str
    name: str
    type: MandateType
    status: MandateStatus = MandateStatus.ACTIVE
    project_id: int | None = None
    exchange_rate: Decimal | None = None
    exchange_rate_date: date | None = None
    lead_owner_id: int | None = None


class MandateCreate(MandateBase):
    firm_id: int


class MandateUpdate(BaseModel):
    client_name: str | None = None
    name: str | None = None
    type: MandateType | None = None
    status: MandateStatus | None = None
    exchange_rate: Decimal | None = None
    exchange_rate_date: date | None = None
    lead_owner_id: int | None = None


class MandateRead(MandateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    firm_id: int
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
