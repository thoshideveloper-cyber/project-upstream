from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class SourcingLayerCreate(BaseModel):
    mandate_id: int
    name: str
    sort_order: int | None = None  # appended to the end if omitted

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Layer name is required")
        return v.strip()


class SourcingLayerUpdate(BaseModel):
    name: str | None = None
    sort_order: int | None = None


class SourcingLayerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    firm_id: int
    mandate_id: int
    name: str
    sort_order: int
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
