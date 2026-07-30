from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import CompanyCategory, CompanyStatus, CompanyType, Source, SourceQuality

if TYPE_CHECKING:
    from app.models.company_category import CompanyCategoryVocab
    from app.models.company_profile import CompanyProfile
    from app.models.contact import Contact
    from app.models.firm import Firm
    from app.models.mandate import Mandate
    from app.models.outreach_event import OutreachEvent
    from app.models.outreach_schedule import OutreachSchedule
    from app.models.sourcing_layer import SourcingLayer
    from app.models.user import User


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), nullable=False, index=True)
    mandate_id: Mapped[int] = mapped_column(ForeignKey("mandates.id"), nullable=False, index=True)
    # Shared firm-wide record (interim bridge, §8-A). Static facts on this row are a
    # synced cache of the profile; the profile is the source of truth.
    profile_id: Mapped[int | None] = mapped_column(
        ForeignKey("company_profiles.id"), nullable=True, index=True
    )
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hq: Mapped[str | None] = mapped_column(String(255), nullable=True)
    type: Mapped[CompanyType] = mapped_column(
        SAEnum(CompanyType, native_enum=False), nullable=False
    )
    status: Mapped[CompanyStatus] = mapped_column(
        SAEnum(CompanyStatus, native_enum=False),
        nullable=False,
        default=CompanyStatus.NOT_CONTACTED,
    )
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    revenue_source: Mapped[str | None] = mapped_column(Text, nullable=True)
    revenue_inr_cr: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    headcount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    linkedin: Mapped[str | None] = mapped_column(String(500), nullable=True)
    relevant_investments: Mapped[str | None] = mapped_column(Text, nullable=True)
    bucket: Mapped[str | None] = mapped_column(String(100), nullable=True)  # legacy; backfill source only
    # Legacy enum — kept as a derived cache (single-writer from category_id) for
    # backward compat; category_id is the source of truth (Phase 2a §7.2).
    category: Mapped[CompanyCategory] = mapped_column(
        SAEnum(CompanyCategory, native_enum=False),
        nullable=False,
        default=CompanyCategory.OTHER,
    )
    # Axis 1 — firm-configurable category vocabulary (source of truth).
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("company_categories.id"), nullable=True, index=True
    )
    # Axis 2 — per-engagement sourcing layer / band (NULL → "Unsorted").
    sourcing_layer_id: Mapped[int | None] = mapped_column(
        ForeignKey("sourcing_layers.id"), nullable=True, index=True
    )
    source: Mapped[Source] = mapped_column(
        SAEnum(Source, native_enum=False), nullable=False, default=Source.PROPRIETARY
    )
    source_quality: Mapped[SourceQuality] = mapped_column(
        SAEnum(SourceQuality, native_enum=False), nullable=False, default=SourceQuality.MEDIUM
    )
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    firm: Mapped[Firm] = relationship("Firm", back_populates="companies")
    mandate: Mapped[Mandate] = relationship("Mandate", back_populates="companies")
    category_vocab: Mapped[CompanyCategoryVocab | None] = relationship("CompanyCategoryVocab")
    sourcing_layer: Mapped[SourcingLayer | None] = relationship("SourcingLayer")
    profile: Mapped[CompanyProfile | None] = relationship("CompanyProfile")
    created_by: Mapped[User | None] = relationship("User", back_populates="created_companies")
    contacts: Mapped[list[Contact]] = relationship("Contact", back_populates="company")
    outreach_schedules: Mapped[list[OutreachSchedule]] = relationship(
        "OutreachSchedule", back_populates="company"
    )
    outreach_events: Mapped[list[OutreachEvent]] = relationship(
        "OutreachEvent", back_populates="company"
    )
