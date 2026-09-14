from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import TaskPriority, TaskScope, TaskStatus


class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    notes: str | None = None
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: date | None = None
    assignee_id: int | None = None


class TaskCreate(TaskBase):
    """Create a task on at most one thing.

    The caller names the attachment it actually has -- "on company 12" -- and the service
    derives the rest of the chain through ``services.scope.resolve_scope``. Sending two
    would let the caller assert a chain that contradicts the database, so it is a 422
    rather than a silent precedence rule.
    """

    project_id: int | None = None
    mandate_id: int | None = None
    company_id: int | None = None
    contact_id: int | None = None
    status: TaskStatus = TaskStatus.BACKLOG

    @model_validator(mode="after")
    def _at_most_one_attachment(self) -> TaskCreate:
        given = [
            name
            for name, value in (
                ("project_id", self.project_id),
                ("mandate_id", self.mandate_id),
                ("company_id", self.company_id),
                ("contact_id", self.contact_id),
            )
            if value is not None
        ]
        if len(given) > 1:
            raise ValueError(
                "Attach a task to exactly one thing (got "
                + ", ".join(given)
                + "). The rest of the chain is derived."
            )
        return self


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    notes: str | None = None
    priority: TaskPriority | None = None
    due_date: date | None = None
    assignee_id: int | None = None
    status: TaskStatus | None = None


class TaskStatusUpdate(BaseModel):
    """The one field anyone who can see a task may change -- that is what makes it a board."""

    status: TaskStatus


class AttachedTo(BaseModel):
    type: str
    id: int
    label: str | None = None


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    firm_id: int
    scope: TaskScope
    project_id: int | None
    mandate_id: int | None
    company_id: int | None
    contact_id: int | None
    title: str
    notes: str | None
    status: TaskStatus
    priority: TaskPriority
    due_date: date | None
    assignee_id: int | None
    created_by_id: int | None
    completed_at: datetime | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime

    # Filled by the service from batched lookups, never by ORM lazy-load: touching an
    # unloaded relationship on an async session raises.
    assignee_name: str | None = None
    created_by_name: str | None = None
    project_name: str | None = None
    attached_to: AttachedTo | None = None
    is_overdue: bool = False


class TaskSummary(BaseModel):
    total: int
    open: int
    overdue: int
    due_today: int
    due_this_week: int
    by_status: dict[str, int]
    by_priority: dict[str, int]
    assigned_to_me: int
    by_project: list[dict] | None = None
