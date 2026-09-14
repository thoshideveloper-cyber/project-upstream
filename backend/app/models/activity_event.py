from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Enum as SAEnum, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ActivityObjectType, ActivityVerb

if TYPE_CHECKING:
    from app.models.firm import Firm
    from app.models.user import User


class ActivityEvent(Base):
    """Append-only audit trail — who changed what, in the firm's own words.

    Rows are only ever *displayed*, over an open-ended and growing object set, so they
    carry **snapshots** (``actor_name``, ``object_label``) rather than joins. A firm-wide
    feed page references dozens of objects the client never loaded, and after a project
    delete those objects no longer exist at all. A rename not propagating into history is
    correct for an append-only log, not a bug.

    Written by explicit ``services.activity.log(...)`` calls, never by session listeners:
    ``session.execute(delete(...))`` fires no ORM events, so a differ would silently miss
    the two most destructive paths in the app.
    """

    __tablename__ = "activity_events"
    __table_args__ = (
        # The three composite indexes *are* the three read surfaces.
        Index("ix_activity_events_project_created", "project_id", "created_at"),
        Index("ix_activity_events_firm_created", "firm_id", "created_at"),
        Index("ix_activity_events_company_created", "company_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), nullable=False)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    mandate_id: Mapped[int | None] = mapped_column(ForeignKey("mandates.id"), nullable=True)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True)

    actor_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    actor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    verb: Mapped[ActivityVerb] = mapped_column(
        SAEnum(ActivityVerb, native_enum=False), nullable=False
    )
    object_type: Mapped[ActivityObjectType] = mapped_column(
        SAEnum(ActivityObjectType, native_enum=False), nullable=False
    )
    object_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    object_label: Mapped[str | None] = mapped_column(String(255), nullable=True)

    meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    firm: Mapped[Firm] = relationship("Firm")
    actor: Mapped[User | None] = relationship("User")
