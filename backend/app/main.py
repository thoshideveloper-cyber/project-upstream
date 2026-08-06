"""FastAPI application entry point."""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.analytics import router as analytics_router
from app.api.auth import router as auth_router
from app.api.companies import router as companies_router
from app.api.company_categories import router as company_categories_router
from app.api.company_profiles import router as company_profiles_router
from app.api.contacts import router as contacts_router
from app.api.data_sources import router as data_sources_router
from app.api.email import router as email_router
from app.api.imports import router as imports_router
from app.api.mandates import router as mandates_router
from app.api.my_book import router as my_book_router
from app.api.projects import router as projects_router
from app.api.saved_searches import router as saved_searches_router
from app.api.schedule import router as schedule_router
from app.api.sourcing import router as sourcing_router
from app.api.sourcing_candidates import router as sourcing_candidates_router
from app.api.sourcing_layers import router as sourcing_layers_router
from app.api.sourcing_stages import router as sourcing_stages_router
from app.api.users import router as users_router
from app.api.workbook_imports import router as workbook_imports_router
from app.core.config import settings

app = FastAPI(
    title="Project Upstream API",
    description="M&A deal-sourcing CRM backend.",
    version="0.1.0",
)

# Read CORS origins from environment variable or config default
raw_origins = os.getenv("CORS_ORIGINS", "")
if raw_origins:
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
else:
    origins = settings.cors_origins_list

# Safeguard: ensure localhost is always available for local development
if "http://localhost:3000" not in origins:
    origins.append("http://localhost:3000")
if "http://localhost:3002" not in origins:
    origins.append("http://localhost:3002")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    max_age=3600,
)

app.include_router(auth_router)
app.include_router(mandates_router)
app.include_router(projects_router)
app.include_router(companies_router)
app.include_router(company_categories_router)
app.include_router(company_profiles_router)
app.include_router(sourcing_layers_router)
app.include_router(sourcing_stages_router)
app.include_router(sourcing_candidates_router)
app.include_router(sourcing_router)
app.include_router(saved_searches_router)
# Workbook first: /imports/workbook/* must not be swallowed by /imports/{batch_id}.
app.include_router(workbook_imports_router)
app.include_router(imports_router)
app.include_router(my_book_router)
app.include_router(data_sources_router)
app.include_router(contacts_router)
app.include_router(schedule_router)
app.include_router(email_router)
app.include_router(analytics_router)
app.include_router(users_router)


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok"}
