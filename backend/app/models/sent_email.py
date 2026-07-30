from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import EmailSendStatus

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.contact import Contact
    from app.models.firm import Firm
    from app.models.outreach_event import OutreachEvent
    from app.models.user import User


class SentEmail(Base):
    """Archive of every email sent from the desk — append-only, like the event log.

    Each successful send is paired with the OutreachEvent it created, so the
    cadence machine stays the single source of truth and the full message text
    remains reviewable from the company dossier.
    """

    __tablename__ = "sent_emails"

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False, index=True
    )
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("contacts.id"), nullable=True)
    event_id: Mapped[int | None] = mapped_column(
        ForeignKey("outreach_events.id"), nullable=True
    )
    to_email: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[EmailSendStatus] = mapped_column(
        SAEnum(EmailSendStatus, native_enum=False), nullable=False
    )
    provider_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    firm: Mapped[Firm] = relationship("Firm")
    user: Mapped[User] = relationship("User")
    company: Mapped[Company] = relationship("Company")
    contact: Mapped[Contact | None] = relationship("Contact")
    event: Mapped[OutreachEvent | None] = relationship("OutreachEvent")
