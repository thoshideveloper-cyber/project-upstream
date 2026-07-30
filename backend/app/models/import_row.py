from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import JSON, Enum as SAEnum, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ImportRowAction

if TYPE_CHECKING:
    from app.models.import_batch import ImportBatch


class ImportRow(Base):
    """Per-row outcome of an import — the raw parsed row + resolved action.

    Persisted at *preview* time (raw only) so validate/apply re-use the parsed data
    without a re-upload; ``action``/``resolved_profile_id``/``message`` are set at apply.
    Feeds the error-review step (filter to bad rows, download to fix & re-upload).
    """

    __tablename__ = "import_rows"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(
        ForeignKey("import_batches.id"), nullable=False, index=True
    )
    row_index: Mapped[int] = mapped_column(Integer, nullable=False)
    raw: Mapped[dict] = mapped_column(JSON, nullable=False)
    resolved_profile_id: Mapped[int | None] = mapped_column(
        ForeignKey("company_profiles.id"), nullable=True
    )
    action: Mapped[ImportRowAction | None] = mapped_column(
        SAEnum(ImportRowAction, native_enum=False), nullable=True
    )
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    batch: Mapped[ImportBatch] = relationship("ImportBatch", back_populates="rows")
