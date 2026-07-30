from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.enums import CompanyCategory, CompanyStatus, CompanyType, Source, SourceQuality


class InlineContact(BaseModel):
    """Optional inline primary contact captured on the add-company form (§7.4)."""

    contact_person: str
    designation: str | None = None
    email: str | None = None
    phone: str | None = None
    linkedin: str | None = None


class CompanyBase(BaseModel):
    company_name: str
    mandate_id: int
    hq: str | None = None
    # Type is DERIVED from mandate.type when omitted (BUG-7); kept as a read field.
    type: CompanyType | None = None
    status: CompanyStatus = CompanyStatus.NOT_CONTACTED
    rationale: str | None = None
    revenue_source: str | None = None
    revenue_inr_cr: Decimal | None = None
    headcount: int | None = None
    website: str | None = None
    linkedin: str | None = None
    relevant_investments: str | None = None
    bucket: str | None = None  # legacy; backfill source only, not written by the UI
    # Legacy enum — derived cache; category_id is the source of truth.
    category: CompanyCategory = CompanyCategory.OTHER
    category_id: int | None = None
    sourcing_layer_id: int | None = None
    source: Source = Source.PROPRIETARY
    source_quality: SourceQuality = SourceQuality.MEDIUM


class CompanyCreate(CompanyBase):
    # One or two inline primary contacts, matching the Excel "final" sheets (§7.4).
    contacts: list[InlineContact] | None = None
    # Follow-up cadence for the auto-created cycle-1 schedule. Analyst-editable;
    # None → the schedule's 7-day default (see OutreachSchedule.cadence_interval_days).
    cadence_interval_days: int | None = None


class CompanyUpdate(BaseModel):
    company_name: str | None = None
    hq: str | None = None
    type: CompanyType | None = None
    status: CompanyStatus | None = None
    rationale: str | None = None
    revenue_source: str | None = None
    revenue_inr_cr: Decimal | None = None
    headcount: int | None = None
    website: str | None = None
    linkedin: str | None = None
    relevant_investments: str | None = None
    bucket: str | None = None
    category: CompanyCategory | None = None
    category_id: int | None = None
    sourcing_layer_id: int | None = None
    source: Source | None = None
    source_quality: SourceQuality | None = None


class CompanyRead(CompanyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    firm_id: int
    profile_id: int | None = None
    created_by_id: int | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
