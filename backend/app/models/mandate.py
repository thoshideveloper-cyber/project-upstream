from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import MandateStatus, MandateType

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.firm import Firm
    from app.models.mandate_assignment import MandateAssignment
    from app.models.project import Project
    from app.models.user import User


class Mandate(Base):
    __tablename__ = "mandates"

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), nullable=False, index=True)
    # project_id nullable=True in model; NOT NULL enforced by migration after backfill
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id"), nullable=True, index=True
    )
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[MandateType] = mapped_column(SAEnum(MandateType, native_enum=False), nullable=False)
    status: Mapped[MandateStatus] = mapped_column(
        SAEnum(MandateStatus, native_enum=False), nullable=False, default=MandateStatus.ACTIVE
    )
    exchange_rate: Mapped[Decimal | None] = mapped_column(Numeric(15, 4), nullable=True)
    exchange_rate_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    lead_owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    follow_up_cap: Mapped[int | None] = mapped_column(Integer, nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    firm: Mapped[Firm] = relationship("Firm", back_populates="mandates")
    project: Mapped[Project | None] = relationship("Project", back_populates="mandates")
    lead_owner: Mapped[User | None] = relationship("User", back_populates="led_mandates")
    assignments: Mapped[list[MandateAssignment]] = relationship(
        "MandateAssignment", back_populates="mandate"
    )
    companies: Mapped[list[Company]] = relationship("Company", back_populates="mandate")
