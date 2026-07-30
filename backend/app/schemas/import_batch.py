from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import ImportRowAction, ImportSource, ImportStatus


class ImportValidateRequest(BaseModel):
    batch_id: int
    mapping: dict[str, str | None]


class ImportApplyRequest(BaseModel):
    batch_id: int
    mapping: dict[str, str | None]


class ImportRowRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    row_index: int
    raw: dict
    resolved_profile_id: int | None
    action: ImportRowAction | None
    message: str | None


class ImportBatchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    firm_id: int
    uploaded_by: int | None
    source: ImportSource
    filename: str | None
    file_hash: str | None
    mapping: dict | None
    row_count: int
    created_count: int
    updated_count: int
    skipped_count: int
    status: ImportStatus
    created_at: datetime
