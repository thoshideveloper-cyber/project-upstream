from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import JSON, Enum as SAEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ImportRowAction

if TYPE_CHECKING:
    from app.models.import_batch import ImportBatch


class ImportRow(Base):
    """Per-row outcome of an import — the raw parsed row + resolved action.

    Persisted at *preview* time (raw only) so validate/apply re-use the parsed data
    without a re-upload; ``action``/``resolved_*_id``/``message`` are set at apply.
    Feeds the error-review step (filter to bad rows, download to fix & re-upload).

    A CSV row resolves to one profile. A workbook row (WB-1) resolves to a whole slice
    of the graph — profile *and* per-mandate company, its inline contact and its
    cadence — so it carries one ``resolved_*_id`` per entity kind plus the
    ``sheet_name`` it came from (a workbook batch spans several tabs).
    """

    __tablename__ = "import_rows"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(
        ForeignKey("import_batches.id"), nullable=False, index=True
    )
    row_index: Mapped[int] = mapped_column(Integer, nullable=False)
    # Workbook tab this row was parsed from (NULL for single-table CSV imports).
    sheet_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw: Mapped[dict] = mapped_column(JSON, nullable=False)
    resolved_profile_id: Mapped[int | None] = mapped_column(
        ForeignKey("company_profiles.id"), nullable=True
    )
    resolved_company_id: Mapped[int | None] = mapped_column(
        ForeignKey("companies.id"), nullable=True
    )
    resolved_contact_id: Mapped[int | None] = mapped_column(
        ForeignKey("contacts.id"), nullable=True
    )
    resolved_schedule_id: Mapped[int | None] = mapped_column(
        ForeignKey("outreach_schedules.id"), nullable=True
    )
    action: Mapped[ImportRowAction | None] = mapped_column(
        SAEnum(ImportRowAction, native_enum=False), nullable=True
    )
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    batch: Mapped[ImportBatch] = relationship("ImportBatch", back_populates="rows")
