from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.enums import SourcingStageKind


class SourcingStageCreate(BaseModel):
    name: str
    kind: SourcingStageKind = SourcingStageKind.CUSTOM
    sort_order: int | None = None

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Stage name is required")
        return v.strip()


class SourcingStageUpdate(BaseModel):
    name: str | None = None
    kind: SourcingStageKind | None = None
    sort_order: int | None = None


class SourcingStageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    firm_id: int
    name: str
    kind: SourcingStageKind
    sort_order: int
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
