from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import CandidateScoreStatus


class SourcingCandidateStageUpdate(BaseModel):
    stage_id: int


class SourcingCandidateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    firm_id: int
    mandate_id: int
    profile_id: int
    stage_id: int
    company_id: int | None
    added_by_id: int | None
    fit_score: int | None
    band: str | None
    subscores: dict | None
    rationale: str | None
    insufficient_data: bool
    model: str | None
    prompt_version: str | None
    score_status: CandidateScoreStatus | None
    score_feedback: str | None
    scored_at: datetime | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
