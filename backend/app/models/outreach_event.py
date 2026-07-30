from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, Enum as SAEnum, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ContactMode, OutreachEventType, Sentiment

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.contact import Contact
    from app.models.firm import Firm
    from app.models.outreach_schedule import OutreachSchedule
    from app.models.user import User


class OutreachEvent(Base):
    """Append-only outreach log — rows are never updated or deleted."""

    __tablename__ = "outreach_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), nullable=False, index=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False, index=True
    )
    schedule_id: Mapped[int | None] = mapped_column(
        ForeignKey("outreach_schedules.id"), nullable=True
    )
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("contacts.id"), nullable=True)
    event_type: Mapped[OutreachEventType] = mapped_column(
        SAEnum(OutreachEventType, native_enum=False), nullable=False
    )
    occurred_on: Mapped[date] = mapped_column(Date, nullable=False)
    regarding: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Per-touch context (§8-B): the event is the source of truth; the contact caches
    # its latest touch. mode = channel; sentiment = Positive/Negative/Neutral (BUG-12).
    mode: Mapped[ContactMode | None] = mapped_column(
        SAEnum(ContactMode, native_enum=False), nullable=True
    )
    sentiment: Mapped[Sentiment | None] = mapped_column(
        SAEnum(Sentiment, native_enum=False), nullable=True
    )
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    firm: Mapped[Firm] = relationship("Firm")
    company: Mapped[Company] = relationship("Company", back_populates="outreach_events")
    schedule: Mapped[OutreachSchedule | None] = relationship(
        "OutreachSchedule", back_populates="outreach_events"
    )
    contact: Mapped[Contact | None] = relationship("Contact", back_populates="outreach_events")
    owner: Mapped[User] = relationship("User", back_populates="owned_events")
