from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import CandidateScoreStatus

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.company_profile import CompanyProfile
    from app.models.firm import Firm
    from app.models.mandate import Mandate
    from app.models.sourcing_stage import SourcingStage
    from app.models.user import User


class SourcingCandidate(Base):
    """The funnel entity — one row per (mandate × profile) (SOURCING_LAYER_PLAN §1.3).

    Holds the pipeline position for *all* stages, including the pre-push
    Research/Shortlisted columns (which have no ``companies`` placement yet), so the
    kanban's first columns persist. ``company_id`` is NULL until the candidate is
    materialised into a placement at the Active-outreach ("push") transition.

    The AI score cache is *folded* onto this row (§2.1/§5.5): one score per
    (mandate, profile), keyed for cache-hits by ``inputs_hash``. Funnel position is
    single-sourced here — there is no ``companies.stage_id`` to drift against.

    A candidate row exists only when an analyst *acts* on a pool profile for a mandate
    (add / shortlist / score / push) — never the mandate × pool cartesian product.
    """

    __tablename__ = "sourcing_candidates"
    __table_args__ = (
        UniqueConstraint(
            "mandate_id", "profile_id", name="uq_sourcing_candidates_mandate_profile"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), nullable=False, index=True)
    mandate_id: Mapped[int] = mapped_column(
        ForeignKey("mandates.id"), nullable=False, index=True
    )
    profile_id: Mapped[int] = mapped_column(
        ForeignKey("company_profiles.id"), nullable=False, index=True
    )
    stage_id: Mapped[int] = mapped_column(
        ForeignKey("sourcing_stages.id"), nullable=False, index=True
    )
    # NULL until the "push" materialises the candidate into a per-mandate placement.
    company_id: Mapped[int | None] = mapped_column(
        ForeignKey("companies.id"), nullable=True, index=True
    )
    added_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    # ── Folded AI score cache (§2.1 / §5.5) ──────────────────────────────────
    fit_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    band: Mapped[str | None] = mapped_column(String(20), nullable=True)
    subscores: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    insufficient_data: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    inputs_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    score_status: Mapped[CandidateScoreStatus | None] = mapped_column(
        SAEnum(CandidateScoreStatus, native_enum=False), nullable=True
    )
    scored_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Analyst thumbs feedback on a score (ground truth for later eval, §5.6): UP / DOWN.
    score_feedback: Mapped[str | None] = mapped_column(String(10), nullable=True)

    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    firm: Mapped[Firm] = relationship("Firm")
    mandate: Mapped[Mandate] = relationship("Mandate")
    profile: Mapped[CompanyProfile] = relationship("CompanyProfile")
    stage: Mapped[SourcingStage] = relationship("SourcingStage")
    company: Mapped[Company | None] = relationship("Company")
    added_by: Mapped[User | None] = relationship("User")
