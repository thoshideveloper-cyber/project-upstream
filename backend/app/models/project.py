from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.firm import Firm
    from app.models.mandate import Mandate


class Project(Base):
    """Groups one or more mandates under a single client engagement.

    A firm may have multiple mandates for the same client (e.g., sell-side +
    buy-side), and a Project is the parent entity that unifies them under one
    client name for the partner overview and the analyst's project book.
    """

    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Who opened this project. Lets an analyst see their own project before it has any
    # engagement (mandate-assignment visibility alone would hide a fresh, empty project).
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    firm: Mapped[Firm] = relationship("Firm", back_populates="projects")
    mandates: Mapped[list[Mandate]] = relationship("Mandate", back_populates="project")
