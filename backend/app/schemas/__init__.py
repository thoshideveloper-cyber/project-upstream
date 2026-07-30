"""Pydantic v2 request/response schemas — one module per entity."""

from app.schemas.company import CompanyCreate as CompanyCreate
from app.schemas.company import CompanyRead as CompanyRead
from app.schemas.company import CompanyUpdate as CompanyUpdate
from app.schemas.company_category import CompanyCategoryCreate as CompanyCategoryCreate
from app.schemas.company_category import CompanyCategoryRead as CompanyCategoryRead
from app.schemas.company_category import CompanyCategoryUpdate as CompanyCategoryUpdate
from app.schemas.contact import ContactCreate as ContactCreate
from app.schemas.contact import ContactRead as ContactRead
from app.schemas.contact import ContactUpdate as ContactUpdate
from app.schemas.firm import FirmCreate as FirmCreate
from app.schemas.firm import FirmRead as FirmRead
from app.schemas.mandate import MandateCreate as MandateCreate
from app.schemas.mandate import MandateRead as MandateRead
from app.schemas.mandate import MandateUpdate as MandateUpdate
from app.schemas.outreach_event import OutreachEventCreate as OutreachEventCreate
from app.schemas.outreach_event import OutreachEventRead as OutreachEventRead
from app.schemas.outreach_schedule import OutreachScheduleRead as OutreachScheduleRead
from app.schemas.outreach_schedule import OutreachScheduleUpdate as OutreachScheduleUpdate
from app.schemas.project import ProjectCreate as ProjectCreate
from app.schemas.project import ProjectRead as ProjectRead
from app.schemas.project import ProjectUpdate as ProjectUpdate
from app.schemas.saved_search import SavedSearchCreate as SavedSearchCreate
from app.schemas.saved_search import SavedSearchRead as SavedSearchRead
from app.schemas.saved_search import SavedSearchUpdate as SavedSearchUpdate
from app.schemas.sourcing_candidate import (
    SourcingCandidateRead as SourcingCandidateRead,
)
from app.schemas.sourcing_candidate import (
    SourcingCandidateStageUpdate as SourcingCandidateStageUpdate,
)
from app.schemas.sourcing_layer import SourcingLayerCreate as SourcingLayerCreate
from app.schemas.sourcing_layer import SourcingLayerRead as SourcingLayerRead
from app.schemas.sourcing_layer import SourcingLayerUpdate as SourcingLayerUpdate
from app.schemas.sourcing_stage import SourcingStageCreate as SourcingStageCreate
from app.schemas.sourcing_stage import SourcingStageRead as SourcingStageRead
from app.schemas.sourcing_stage import SourcingStageUpdate as SourcingStageUpdate
from app.schemas.user import UserCreate as UserCreate
from app.schemas.user import UserRead as UserRead
from app.schemas.user import UserUpdate as UserUpdate
from app.schemas.user import UserWithFirm as UserWithFirm

__all__ = [
    "FirmCreate", "FirmRead",
    "ProjectCreate", "ProjectRead", "ProjectUpdate",
    "UserCreate", "UserRead", "UserUpdate", "UserWithFirm",
    "MandateCreate", "MandateRead", "MandateUpdate",
    "CompanyCreate", "CompanyRead", "CompanyUpdate",
    "CompanyCategoryCreate", "CompanyCategoryRead", "CompanyCategoryUpdate",
    "SourcingLayerCreate", "SourcingLayerRead", "SourcingLayerUpdate",
    "SourcingStageCreate", "SourcingStageRead", "SourcingStageUpdate",
    "SourcingCandidateRead", "SourcingCandidateStageUpdate",
    "SavedSearchCreate", "SavedSearchRead", "SavedSearchUpdate",
    "ContactCreate", "ContactRead", "ContactUpdate",
    "OutreachScheduleRead", "OutreachScheduleUpdate",
    "OutreachEventCreate", "OutreachEventRead",
]
