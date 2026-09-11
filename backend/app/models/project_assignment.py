from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class ProjectAssignment(Base):
    """Explicit membership of a project — grants access to the project, not its mandates.

    Widening ``visible_mandate_ids`` from here would turn a project assignment into a
    backdoor to every engagement's companies (CLAUDE.md rule 5). The consequence is
    deliberate and pinned by a test: an assigned-but-unmandated analyst sees the project
    shell, its tasks and its activity, with an empty engagements list.
    """

    __tablename__ = "project_assignments"
    # Named on purpose. ``mandate_assignments`` leaves its unique unnamed, and the whole
    # story of revision d5a7c9e1f3b8 is an unnamed SQLite constraint that could not be
    # dropped.
    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_assignments_project_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    project: Mapped[Project] = relationship("Project")
    user: Mapped[User] = relationship("User")
