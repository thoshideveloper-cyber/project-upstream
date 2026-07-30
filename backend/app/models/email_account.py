from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import EmailProvider

if TYPE_CHECKING:
    from app.models.firm import Firm
    from app.models.user import User


class EmailAccount(Base):
    """One connected sending mailbox per user (Gmail / Outlook via OAuth, or Sandbox).

    OAuth tokens are encrypted at rest (see ``app/core/crypto.py``); they are never
    returned by the API. Sending goes through the provider's own API from the
    analyst's real mailbox — that is the deliverability model (provider-signed
    SPF/DKIM, mail in the analyst's Sent folder, replies thread to their inbox).
    """

    __tablename__ = "email_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, unique=True, index=True
    )
    provider: Mapped[EmailProvider] = mapped_column(
        SAEnum(EmailProvider, native_enum=False), nullable=False
    )
    email_address: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Encrypted OAuth material (empty for SANDBOX).
    refresh_token_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    access_token_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Per-analyst outbound signature, appended to every send.
    signature: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Daily pacing cap — steady low volume is what keeps 1:1 mail out of spam.
    daily_send_limit: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    firm: Mapped[Firm] = relationship("Firm")
    user: Mapped[User] = relationship("User")
