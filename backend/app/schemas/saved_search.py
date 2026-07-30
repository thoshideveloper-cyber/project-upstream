from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.enums import SavedSearchScope


class SavedSearchCreate(BaseModel):
    name: str
    scope: SavedSearchScope = SavedSearchScope.PRIVATE
    criteria: dict = {}

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Name is required")
        return v.strip()


class SavedSearchUpdate(BaseModel):
    name: str | None = None
    scope: SavedSearchScope | None = None
    criteria: dict | None = None


class SavedSearchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    firm_id: int
    owner_id: int
    name: str
    scope: SavedSearchScope
    criteria: dict
    created_at: datetime
