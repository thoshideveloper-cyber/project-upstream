from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import EmailTemplateKind

if TYPE_CHECKING:
    from app.models.firm import Firm
    from app.models.user import User


class EmailTemplate(Base):
    """Reusable outreach email template, firm-shared or personal.

    Subject/body may carry ``{{first_name}} {{full_name}} {{company}} {{designation}}
    {{deal}} {{sender_name}} {{firm}}`` variables. Substitution happens in the compose
    editor (the analyst always sees and edits the exact text that will be sent —
    no hidden merge at send time). Soft delete only (archived_at).
    """

    __tablename__ = "email_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), nullable=False, index=True)
    # NULL owner = firm-shared starter template; otherwise personal to the owner.
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    kind: Mapped[EmailTemplateKind] = mapped_column(
        SAEnum(EmailTemplateKind, native_enum=False),
        nullable=False,
        default=EmailTemplateKind.FOLLOW_UP,
    )
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    use_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    firm: Mapped[Firm] = relationship("Firm")
    owner: Mapped[User | None] = relationship("User")
