from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import SavedSearchScope

if TYPE_CHECKING:
    from app.models.firm import Firm
    from app.models.user import User


class SavedSearch(Base):
    """A saved pool query (SOURCING_LAYER_PLAN §3.3). PRIVATE to its owner or shared
    FIRM-wide. ``criteria`` is the filter payload the candidates search re-applies."""

    __tablename__ = "saved_searches"

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), nullable=False, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    scope: Mapped[SavedSearchScope] = mapped_column(
        SAEnum(SavedSearchScope, native_enum=False),
        nullable=False,
        default=SavedSearchScope.PRIVATE,
    )
    criteria: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    firm: Mapped[Firm] = relationship("Firm")
    owner: Mapped[User] = relationship("User")
