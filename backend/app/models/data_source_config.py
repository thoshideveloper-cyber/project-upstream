from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    Boolean,
    Enum as SAEnum,
    ForeignKey,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import DataSourceKind

if TYPE_CHECKING:
    from app.models.firm import Firm


class DataSourceConfig(Base):
    """Pluggable-provider registry/config (SOURCING_LAYER_PLAN §2.1 / §5.1).

    Selects which enrichment/ranking provider a firm uses. Secrets never live here —
    they stay in ``.env``; ``config`` holds only non-secret settings.
    """

    __tablename__ = "data_source_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), nullable=False, index=True)
    provider_key: Mapped[str] = mapped_column(String(100), nullable=False)
    kind: Mapped[DataSourceKind] = mapped_column(
        SAEnum(DataSourceKind, native_enum=False), nullable=False
    )
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    firm: Mapped[Firm] = relationship("Firm")
