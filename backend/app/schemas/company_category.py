from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class CompanyCategoryCreate(BaseModel):
    name: str
    code: str | None = None  # derived from name if omitted
    sort_order: int = 100

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Category name is required")
        return v.strip()


class CompanyCategoryUpdate(BaseModel):
    name: str | None = None
    sort_order: int | None = None


class CompanyCategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    firm_id: int
    name: str
    code: str
    sort_order: int
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
