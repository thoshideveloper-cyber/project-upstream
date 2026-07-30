from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.firm import Firm


class CompanyCategoryVocab(Base):
    """Firm-configurable counterparty category (Phase 2a §7.2).

    Replaces the fixed ``CompanyCategory`` enum with a firm-scoped lookup so real
    Excel codes (PMS, Private Credit, Investment Bank, …) survive and firms can
    self-serve new ones without a migration. ``code`` is stable for deterministic
    colour/analytics mapping; ``name`` is the editable display label.
    """

    __tablename__ = "company_categories"
    __table_args__ = (
        UniqueConstraint("firm_id", "code", name="uq_company_categories_firm_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    firm: Mapped[Firm] = relationship("Firm")
