from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.firm import Firm
    from app.models.mandate import Mandate


class SourcingLayer(Base):
    """Per-engagement, ordered priority/thesis band (Phase 2a §7.3 — the MVP feature).

    A sourcing layer's meaning is per-engagement (GAIL's *Direct / Secondary /
    Strategics* ≠ 22by7's thesis bands), so it belongs to a ``mandate`` and carries
    an explicit ``sort_order`` that gives the grid its band sequence. Companies point
    at a layer via ``companies.sourcing_layer_id`` (NULL → the "Unsorted" band).
    """

    __tablename__ = "sourcing_layers"

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), nullable=False, index=True)
    mandate_id: Mapped[int] = mapped_column(
        ForeignKey("mandates.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    firm: Mapped[Firm] = relationship("Firm")
    mandate: Mapped[Mandate] = relationship("Mandate")
