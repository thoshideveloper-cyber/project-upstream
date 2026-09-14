from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import TaskPriority, TaskScope, TaskStatus

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.contact import Contact
    from app.models.firm import Firm
    from app.models.mandate import Mandate
    from app.models.project import Project
    from app.models.user import User


class Task(Base):
    """A piece of declared work — the counterpart to the cadence engine's derived work.

    Attachment is four nullable real FKs plus a stored ``scope``, not a generic
    ``object_id``: tasks get filtered, joined and cascaded, and a polymorphic id would
    make "tasks on this project" four unindexable OR-branches and force RBAC
    post-filtering in Python (which makes ``total`` in the list envelope a lie).

    ``project_id`` is denormalised onto every row so the sidebar counts are one
    ``GROUP BY project_id`` and the project delete cascade is one predicate. That is safe
    because neither hop is ever reassigned — ``MandateUpdate`` carries no ``project_id``
    and nothing assigns ``company.mandate_id``. A canary test pins the invariant.
    """

    __tablename__ = "tasks"
    __table_args__ = (
        Index("ix_tasks_project_status", "project_id", "status"),
        Index("ix_tasks_assignee_status_due", "assignee_id", "status", "due_date"),
        # SQLite does not enforce FKs here (no PRAGMA foreign_keys=ON anywhere in the
        # backend) but it *does* enforce CHECK, so this is the stronger guard.
        CheckConstraint(
            "(scope = 'PERSONAL' AND project_id IS NULL AND mandate_id IS NULL "
            "AND company_id IS NULL AND contact_id IS NULL) "
            "OR (scope <> 'PERSONAL' AND project_id IS NOT NULL)",
            name="ck_tasks_scope_consistent",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), nullable=False, index=True)
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id"), nullable=True, index=True
    )
    mandate_id: Mapped[int | None] = mapped_column(
        ForeignKey("mandates.id"), nullable=True, index=True
    )
    company_id: Mapped[int | None] = mapped_column(
        ForeignKey("companies.id"), nullable=True, index=True
    )
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("contacts.id"), nullable=True)
    scope: Mapped[TaskScope] = mapped_column(
        SAEnum(TaskScope, native_enum=False), nullable=False
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(
        SAEnum(TaskStatus, native_enum=False), nullable=False, default=TaskStatus.BACKLOG
    )
    priority: Mapped[TaskPriority] = mapped_column(
        SAEnum(TaskPriority, native_enum=False), nullable=False, default=TaskPriority.MEDIUM
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    assignee_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    firm: Mapped[Firm] = relationship("Firm")
    project: Mapped[Project | None] = relationship("Project")
    mandate: Mapped[Mandate | None] = relationship("Mandate")
    company: Mapped[Company | None] = relationship("Company")
    contact: Mapped[Contact | None] = relationship("Contact")
    # Both target users.id, so both need an explicit foreign_keys=.
    assignee: Mapped[User | None] = relationship("User", foreign_keys=[assignee_id])
    created_by: Mapped[User | None] = relationship("User", foreign_keys=[created_by_id])
