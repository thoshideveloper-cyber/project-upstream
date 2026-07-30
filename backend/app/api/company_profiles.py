"""Company profiles router — the firm-wide Master List (Req A, §8-A / §9.6).

A profile is the shared, deduped company record enriched by every analyst. This is the
firm-wide master search surface: one row per company, with its per-engagement
placements (the mandates it appears in) summarised. Visibility-scoped: analysts only
see placements in their assigned mandates, and only profiles that have at least one
visible placement.
"""

from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import func, or_, select

from app.core.deps import CurrentUser, SessionDep, visible_mandate_ids
from app.models.company import Company
from app.models.company_category import CompanyCategoryVocab
from app.models.company_profile import CompanyProfile
from app.models.enums import CompanyStatus, MandateType, UserRole
from app.models.mandate import Mandate
from app.models.user import User
from app.services.profiles import compute_domain_key

router = APIRouter(prefix="/company-profiles", tags=["company-profiles"])


@router.get("")
async def list_profiles(
    db: SessionDep,
    current_user: CurrentUser,
    q: str | None = Query(default=None, description="Name / HQ / domain search"),
    scope: str = Query(default="visible", description="visible | firm (partner)"),
    group_by: str | None = Query(default=None, description="analyst → overlap grouping"),
    category_id: int | None = Query(default=None, description="Only profiles placed in this category"),
    engagement_type: str | None = Query(default=None, description="SELL_SIDE | BUY_SIDE | CAPITAL_RAISE"),
    status: str | None = Query(default=None, description="Only profiles with a placement in this status"),
    min_engagements: int | None = Query(default=None, ge=1, description="Worked in ≥N engagements"),
    sort: str = Query(default="name", description="name | engagements | revenue | headcount"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    include_archived: bool = Query(default=False),
):
    # Partner-only firm-wide scope ignores visibility (who's working whom).
    firm_scope = scope == "firm" and current_user.role == UserRole.PARTNER
    visible = None if firm_scope else await visible_mandate_ids(current_user, db)

    # Base placement filter: a profile qualifies if it has a non-archived placement in a
    # visible mandate. Facet filters (category/type/status) narrow *inclusion* only — a
    # profile's displayed placements always show its full visible footprint.
    placement_conditions = [
        Company.firm_id == current_user.firm_id,
        Company.profile_id.is_not(None),
    ]
    if not include_archived:
        placement_conditions.append(Company.archived_at.is_(None))
    if visible is not None:
        placement_conditions.append(Company.mandate_id.in_(visible))

    incl_stmt = select(Company.profile_id).where(*placement_conditions)
    if engagement_type and engagement_type in MandateType.__members__:
        incl_stmt = incl_stmt.join(Mandate, Mandate.id == Company.mandate_id).where(
            Mandate.type == MandateType[engagement_type]
        )
    if category_id:
        incl_stmt = incl_stmt.where(Company.category_id == category_id)
    if status and status in CompanyStatus.__members__:
        incl_stmt = incl_stmt.where(Company.status == CompanyStatus[status])

    visible_profile_ids = [row[0] for row in (await db.execute(incl_stmt.distinct())).all()]

    # Per-profile placement counts (for the "worked in ≥N" filter + engagements sort).
    count_map: dict[int, int] = {}
    if visible_profile_ids and (min_engagements or sort == "engagements"):
        count_rows = (
            await db.execute(
                select(Company.profile_id, func.count())
                .where(*placement_conditions, Company.profile_id.in_(visible_profile_ids))
                .group_by(Company.profile_id)
            )
        ).all()
        count_map = {pid: n for pid, n in count_rows}
        if min_engagements:
            visible_profile_ids = [
                pid for pid in visible_profile_ids if count_map.get(pid, 0) >= min_engagements
            ]

    if not visible_profile_ids:
        return {"items": [], "total": 0, "page": page, "page_size": page_size}

    prof_conditions = [
        CompanyProfile.firm_id == current_user.firm_id,
        CompanyProfile.id.in_(visible_profile_ids),
    ]
    if not include_archived:
        prof_conditions.append(CompanyProfile.archived_at.is_(None))
    if q:
        like = f"%{q}%"
        domain = compute_domain_key(q)
        clauses = [CompanyProfile.company_name.ilike(like), CompanyProfile.hq.ilike(like)]
        if domain:
            clauses.append(CompanyProfile.domain_key == domain)
        prof_conditions.append(or_(*clauses))

    if sort == "engagements":
        # Rank by placement count (desc); derived, so ordered in Python then paginated.
        matched_ids = [
            row[0]
            for row in (
                await db.execute(select(CompanyProfile.id).where(*prof_conditions))
            ).all()
        ]
        matched_ids.sort(key=lambda pid: (-count_map.get(pid, 0), pid))
        total = len(matched_ids)
        page_ids = matched_ids[(page - 1) * page_size : page * page_size]
        by_id = {
            p.id: p
            for p in (
                await db.execute(
                    select(CompanyProfile).where(CompanyProfile.id.in_(page_ids))
                )
            ).scalars().all()
        }
        profiles = [by_id[pid] for pid in page_ids if pid in by_id]
    else:
        order_by = {
            "revenue": CompanyProfile.revenue_inr_cr.desc(),
            "headcount": CompanyProfile.headcount.desc(),
        }.get(sort, CompanyProfile.company_name.asc())
        total = (
            await db.execute(
                select(func.count()).select_from(
                    select(CompanyProfile.id).where(*prof_conditions).subquery()
                )
            )
        ).scalar() or 0
        profiles = list(
            (
                await db.execute(
                    select(CompanyProfile)
                    .where(*prof_conditions)
                    .order_by(order_by)
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).scalars().all()
        )
    if not profiles:
        return {"items": [], "total": total, "page": page, "page_size": page_size}

    page_profile_ids = [p.id for p in profiles]

    # Batch: placements for this page, with mandate + category resolved (no N+1).
    placements = list(
        (
            await db.execute(
                select(Company).where(
                    Company.profile_id.in_(page_profile_ids), *placement_conditions[1:]
                )
            )
        ).scalars().all()
    )
    mandate_ids = {c.mandate_id for c in placements}
    cat_ids = {c.category_id for c in placements if c.category_id}
    mandates = (
        {
            m.id: m
            for m in (
                await db.execute(select(Mandate).where(Mandate.id.in_(mandate_ids)))
            ).scalars().all()
        }
        if mandate_ids
        else {}
    )
    cats = (
        {
            c.id: c
            for c in (
                await db.execute(
                    select(CompanyCategoryVocab).where(CompanyCategoryVocab.id.in_(cat_ids))
                )
            ).scalars().all()
        }
        if cat_ids
        else {}
    )

    # Resolve the analyst who added each placement (group-by-analyst / overlap view).
    analyst_ids = {c.created_by_id for c in placements if c.created_by_id}
    analysts = (
        {
            u.id: u
            for u in (
                await db.execute(select(User).where(User.id.in_(analyst_ids)))
            ).scalars().all()
        }
        if analyst_ids
        else {}
    )

    placements_by_profile: dict[int, list[dict]] = {}
    for c in placements:
        m = mandates.get(c.mandate_id)
        cat = cats.get(c.category_id) if c.category_id else None
        analyst = analysts.get(c.created_by_id) if c.created_by_id else None
        placements_by_profile.setdefault(c.profile_id, []).append(
            {
                "company_id": c.id,
                "mandate_id": c.mandate_id,
                "mandate_name": m.name if m else None,
                "client_name": m.client_name if m else None,
                "engagement_type": m.type.value if m else None,
                "category_name": cat.name if cat else None,
                "status": c.status.value if c.status else None,
                "analyst_id": c.created_by_id,
                "analyst_name": analyst.full_name if analyst else None,
            }
        )

    items = []
    for p in profiles:
        p_placements = placements_by_profile.get(p.id, [])
        analyst_names = {pl["analyst_name"] for pl in p_placements if pl["analyst_name"]}
        items.append(
            {
                "id": p.id,
                "company_name": p.company_name,
                "hq": p.hq,
                "website": p.website,
                "linkedin": p.linkedin,
                "headcount": p.headcount,
                "revenue_source": p.revenue_source,
                "revenue_inr_cr": str(p.revenue_inr_cr) if p.revenue_inr_cr is not None else None,
                "domain_key": p.domain_key,
                "placements": p_placements,
                "engagement_count": len(p_placements),
                # Flag cross-analyst overlap (same company worked by multiple analysts).
                "overlap": len(analyst_names) > 1,
            }
        )

    result = {"items": items, "total": total, "page": page, "page_size": page_size}

    if group_by == "analyst":
        by_analyst: dict[str, dict] = {}
        for it in items:
            for pl in it["placements"]:
                name = pl["analyst_name"] or "Unassigned"
                entry = by_analyst.setdefault(
                    name, {"analyst_name": name, "analyst_id": pl["analyst_id"], "profiles": 0}
                )
                entry["profiles"] += 1
        result["by_analyst"] = sorted(
            by_analyst.values(), key=lambda a: -a["profiles"]
        )
        result["scope"] = "firm" if firm_scope else "visible"

    return result
