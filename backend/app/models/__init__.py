"""Import every model so Alembic autogenerate sees them on Base.metadata."""

from app.models.company import Company as Company
from app.models.company_category import CompanyCategoryVocab as CompanyCategoryVocab
from app.models.company_profile import CompanyProfile as CompanyProfile
from app.models.contact import Contact as Contact
from app.models.data_source_config import DataSourceConfig as DataSourceConfig
from app.models.email_account import EmailAccount as EmailAccount
from app.models.email_template import EmailTemplate as EmailTemplate
from app.models.firm import Firm as Firm
from app.models.import_batch import ImportBatch as ImportBatch
from app.models.import_row import ImportRow as ImportRow
from app.models.mandate import Mandate as Mandate
from app.models.mandate_assignment import MandateAssignment as MandateAssignment
from app.models.outreach_event import OutreachEvent as OutreachEvent
from app.models.outreach_schedule import OutreachSchedule as OutreachSchedule
from app.models.project import Project as Project
from app.models.refresh_token import RefreshToken as RefreshToken
from app.models.saved_search import SavedSearch as SavedSearch
from app.models.sent_email import SentEmail as SentEmail
from app.models.sourcing_candidate import SourcingCandidate as SourcingCandidate
from app.models.sourcing_layer import SourcingLayer as SourcingLayer
from app.models.sourcing_stage import SourcingStage as SourcingStage
from app.models.user import User as User

__all__ = [
    "Firm",
    "Project",
    "User",
    "RefreshToken",
    "Mandate",
    "MandateAssignment",
    "Company",
    "CompanyCategoryVocab",
    "CompanyProfile",
    "SourcingLayer",
    "SourcingStage",
    "SourcingCandidate",
    "Contact",
    "OutreachSchedule",
    "OutreachEvent",
    "ImportBatch",
    "ImportRow",
    "SavedSearch",
    "DataSourceConfig",
    "EmailAccount",
    "EmailTemplate",
    "SentEmail",
]
