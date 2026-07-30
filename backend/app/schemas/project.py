from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProjectBase(BaseModel):
    name: str
    client_name: str


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = None
    client_name: str | None = None


class ProjectRead(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    firm_id: int
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
