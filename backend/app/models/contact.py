from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, Enum as SAEnum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ContactMode, Engagement, Sentiment

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.firm import Firm
    from app.models.outreach_event import OutreachEvent
    from app.models.user import User


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), nullable=False, index=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False, index=True
    )
    contact_person: Mapped[str] = mapped_column(String(255), nullable=False)
    designation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    linkedin: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    engagement: Mapped[Engagement | None] = mapped_column(
        SAEnum(Engagement, native_enum=False), nullable=True
    )
    date_connected: Mapped[date | None] = mapped_column(Date, nullable=True)
    mode: Mapped[ContactMode | None] = mapped_column(
        SAEnum(ContactMode, native_enum=False), nullable=True
    )
    poc_owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Typed sentiment cache of the latest touch (BUG-12); source of truth is the event.
    sentiment: Mapped[Sentiment | None] = mapped_column(
        SAEnum(Sentiment, native_enum=False), nullable=True
    )
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_contact_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    firm: Mapped[Firm] = relationship("Firm", back_populates="contacts")
    company: Mapped[Company] = relationship("Company", back_populates="contacts")
    poc_owner: Mapped[User | None] = relationship("User", back_populates="poc_contacts")
    outreach_events: Mapped[list[OutreachEvent]] = relationship(
        "OutreachEvent", back_populates="contact"
    )
