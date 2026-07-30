from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import ScheduleStatus, StoppedReason


class OutreachScheduleBase(BaseModel):
    cadence_interval_days: int = 7
    regarding: str | None = None


class OutreachScheduleUpdate(BaseModel):
    cadence_interval_days: int | None = None
    regarding: str | None = None


class OutreachScheduleRead(OutreachScheduleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    firm_id: int
    company_id: int
    cycle_number: int
    is_current: bool
    contact_id: int | None
    status: ScheduleStatus
    initial_date: date | None
    stopped_reason: StoppedReason | None
    stopped_at: datetime | None
    created_at: datetime
    updated_at: datetime
