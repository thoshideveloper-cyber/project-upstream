from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.contact import Contact
    from app.models.mandate import Mandate
    from app.models.project import Project
    from app.models.user import User


class Firm(Base):
    __tablename__ = "firms"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    follow_up_cap: Mapped[int] = mapped_column(Integer, default=4, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    users: Mapped[list[User]] = relationship("User", back_populates="firm")
    projects: Mapped[list[Project]] = relationship("Project", back_populates="firm")
    mandates: Mapped[list[Mandate]] = relationship("Mandate", back_populates="firm")
    companies: Mapped[list[Company]] = relationship("Company", back_populates="firm")
    contacts: Mapped[list[Contact]] = relationship("Contact", back_populates="firm")
