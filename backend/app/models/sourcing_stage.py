from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import SourcingStageKind

if TYPE_CHECKING:
    from app.models.firm import Firm


class SourcingStage(Base):
    """Firm-wide funnel vocabulary — the *new* meaning of "sourcing layer"
    (SOURCING_LAYER_PLAN §1/§2.1).

    Stages are firm-wide (not per-deal) so cross-mandate funnel analytics
    ("response-by-stage", "time-in-stage") share one vocabulary. Behaviour is derived
    from ``kind`` (RESEARCH·SHORTLIST·ACTIVE·ENGAGED·PASSED·CUSTOM), never free
    booleans, so a partner can rename/reorder without breaking transition logic.
    Managed like ``company_categories`` — partner-configurable, self-seeding defaults.
    """

    __tablename__ = "sourcing_stages"

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    kind: Mapped[SourcingStageKind] = mapped_column(
        SAEnum(SourcingStageKind, native_enum=False),
        nullable=False,
        default=SourcingStageKind.CUSTOM,
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    firm: Mapped[Firm] = relationship("Firm")
