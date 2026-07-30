from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ScheduleStatus, StoppedReason

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.contact import Contact
    from app.models.firm import Firm
    from app.models.outreach_event import OutreachEvent


class OutreachSchedule(Base):
    __tablename__ = "outreach_schedules"
    __table_args__ = (
        # (company_id, cycle_number) must be unique; one-current-per-company
        # is enforced in the service layer (not by a partial index — SQLite-safe).
        UniqueConstraint("company_id", "cycle_number", name="uq_outreach_schedules_company_cycle"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), nullable=False, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    cycle_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("contacts.id"), nullable=True)
    status: Mapped[ScheduleStatus] = mapped_column(
        SAEnum(ScheduleStatus, native_enum=False),
        nullable=False,
        default=ScheduleStatus.AWAITING_INITIAL,
    )
    initial_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Days between follow-ups (fixed-anchor). Default 7; analyst-editable per schedule.
    cadence_interval_days: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    regarding: Mapped[str | None] = mapped_column(Text, nullable=True)
    stopped_reason: Mapped[StoppedReason | None] = mapped_column(
        SAEnum(StoppedReason, native_enum=False), nullable=True
    )
    stopped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    firm: Mapped[Firm] = relationship("Firm")
    company: Mapped[Company] = relationship("Company", back_populates="outreach_schedules")
    contact: Mapped[Contact | None] = relationship("Contact")
    outreach_events: Mapped[list[OutreachEvent]] = relationship(
        "OutreachEvent", back_populates="schedule"
    )
