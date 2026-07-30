from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.firm import Firm


class CompanyProfile(Base):
    """Firm-wide shared company record — the "single source of truth" (Phase 2a §8-A).

    The interim bridge for Requirement A: static facts (name, HQ, website, headcount,
    revenue) live here once and are enriched by *every* analyst; the per-mandate
    ``companies`` rows point at a profile via ``profile_id`` and keep their static facts
    as a synced cache (so the grid/read shape is unchanged). ``name_key``/``domain_key``
    are normalised dedup keys. No FK moves on schedules/events/contacts — an imperfect
    dedupe is recoverable, not a broken-cadence outage.
    """

    __tablename__ = "company_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), nullable=False, index=True)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hq: Mapped[str | None] = mapped_column(String(255), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    linkedin: Mapped[str | None] = mapped_column(String(500), nullable=True)
    headcount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    revenue_source: Mapped[str | None] = mapped_column(Text, nullable=True)
    revenue_inr_cr: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    name_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    domain_key: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    firm: Mapped[Firm] = relationship("Firm")
