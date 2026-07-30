from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ImportSource, ImportStatus

if TYPE_CHECKING:
    from app.models.firm import Firm
    from app.models.import_row import ImportRow


class ImportBatch(Base):
    """CSV / IB-DB ingest audit + idempotency envelope (SOURCING_LAYER_PLAN §2.1).

    Every import is one auditable row. ``file_hash`` + per-row upsert keys make a
    re-import of the same file idempotent (upserts profiles, never duplicates).
    """

    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), nullable=False, index=True)
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    source: Mapped[ImportSource] = mapped_column(
        SAEnum(ImportSource, native_enum=False), nullable=False, default=ImportSource.CSV
    )
    filename: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    mapping: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    row_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    skipped_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[ImportStatus] = mapped_column(
        SAEnum(ImportStatus, native_enum=False), nullable=False, default=ImportStatus.PENDING
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    firm: Mapped[Firm] = relationship("Firm")
    rows: Mapped[list[ImportRow]] = relationship(
        "ImportRow", back_populates="batch", cascade="all, delete-orphan"
    )
