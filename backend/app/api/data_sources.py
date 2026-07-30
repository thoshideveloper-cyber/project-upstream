"""Data-source providers router (SOURCING_LAYER_PLAN §4.5).

Partner-managed enable/disable of enrichment/ranking providers. Secrets never surface —
they live in ``.env``; only non-secret config is stored/returned.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, PartnerDep, SessionDep
from app.models.data_source_config import DataSourceConfig
from app.services.providers.registry import seed_firm_data_sources

router = APIRouter(prefix="/data-sources", tags=["data-sources"])


def _serialize(c: DataSourceConfig) -> dict:
    return {
        "id": c.id,
        "provider_key": c.provider_key,
        "kind": c.kind.value,
        "enabled": c.enabled,
        "config": c.config or {},
    }


@router.get("")
async def list_data_sources(db: SessionDep, current_user: CurrentUser):
    """List the firm's provider configs (self-seeds the defaults on first read)."""
    stmt = (
        select(DataSourceConfig)
        .where(DataSourceConfig.firm_id == current_user.firm_id)
        .order_by(DataSourceConfig.kind, DataSourceConfig.id)
    )
    rows = (await db.execute(stmt)).scalars().all()
    if not rows:
        await seed_firm_data_sources(db, current_user.firm_id)
        await db.commit()
        rows = (await db.execute(stmt)).scalars().all()
    return {"items": [_serialize(c) for c in rows], "total": len(rows)}


class DataSourceUpdate(BaseModel):
    enabled: bool


@router.patch("/{config_id}")
async def update_data_source(
    config_id: int, body: DataSourceUpdate, db: SessionDep, current_user: PartnerDep
):
    cfg = (
        await db.execute(
            select(DataSourceConfig).where(
                DataSourceConfig.id == config_id,
                DataSourceConfig.firm_id == current_user.firm_id,
            )
        )
    ).scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=404, detail="Data source not found")
    cfg.enabled = body.enabled
    await db.commit()
    await db.refresh(cfg)
    return _serialize(cfg)
