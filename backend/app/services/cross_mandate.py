"""Cross-mandate duplicate detection — advisory heuristic (X-01).

Normalises company names and domains, then checks whether another company
in the same firm (but a different mandate) looks like the same entity.

Matching tiers:
  - exact_domain   : registrable domain match (confidence = 1.0)
  - exact_name     : normalised name equality  (confidence = 1.0)
  - fuzzy_name     : rapidfuzz token_sort_ratio ≥ FUZZY_THRESHOLD
                     (confidence = ratio / 100, always < 1.0)

Advisory only — never blocks company creation.
Schedules are fetched in a SINGLE batched query (no N+1).
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

from rapidfuzz import fuzz
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.outreach_schedule import OutreachSchedule

# Suffixes stripped during normalisation
_SUFFIX_RE = re.compile(
    r"\b(pvt|private|ltd|limited|inc|incorporated|llp|llc|co|corp|corporation"
    r"|group|holdings|industries|enterprises|solutions|technologies|tech|india)\b",
    re.IGNORECASE,
)
_PUNCT_RE = re.compile(r"[^\w\s]")
_WS_RE = re.compile(r"\s+")

# Fuzzy threshold: 80/100 for token_set_ratio (subset-aware).
# token_set_ratio handles "Tata" ⊂ "Tata Sons" (→100) and typos like
# "Microsft"~"Microsoft" (→89) while keeping unrelated names apart.
_FUZZY_THRESHOLD = 80

# Cap candidate scan so the function stays O(1) on large books.
_CANDIDATE_CAP = 500


def normalise_name(name: str) -> str:
    s = name.lower()
    s = _PUNCT_RE.sub(" ", s)
    s = _SUFFIX_RE.sub(" ", s)
    s = _WS_RE.sub(" ", s).strip()
    return s


# Common two-label public suffixes: for these, the registrable domain is the last
# THREE labels (e.g. "eris.co.in"), not two — otherwise every ".co.in" company would
# collapse to the same "co.in" key and falsely merge.
_MULTI_TLDS = frozenset(
    {
        "co.in", "com.au", "co.uk", "org.uk", "co.jp", "com.br", "co.za",
        "org.in", "net.in", "gov.in", "ac.in", "co.nz", "com.sg", "com.hk",
    }
)


def extract_domain(url: str | None) -> str | None:
    if not url:
        return None
    try:
        parsed = urlparse(url if "://" in url else f"https://{url}")
        host = parsed.netloc or parsed.path
        host = re.sub(r"^www\.", "", host).lower().strip("/")
        # Drop any path/port that slipped through.
        host = host.split("/")[0].split(":")[0]
        parts = host.split(".")
        if len(parts) <= 2:
            return host or None
        last_two = ".".join(parts[-2:])
        if last_two in _MULTI_TLDS:
            return ".".join(parts[-3:])
        return last_two
    except Exception:
        return None


async def find_duplicates(
    db: AsyncSession,
    firm_id: int,
    mandate_id: int,
    company_name: str,
    website: str | None,
) -> list[dict]:
    """Return advisory warnings for companies in the same firm, different mandate,
    that match by domain, normalised name, or fuzzy name.

    Returns a list of dicts with keys:
        company_id, company_name, mandate_id, status, initial_date,
        confidence (0.0–1.0), match_type (exact_domain|exact_name|fuzzy_name)

    All schedule data is fetched in ONE batched query (no N+1).
    """
    norm_name = normalise_name(company_name)
    domain = extract_domain(website)

    # Fetch candidates — cap to avoid full-table scan on very large books
    result = await db.execute(
        select(Company)
        .where(
            Company.firm_id == firm_id,
            Company.mandate_id != mandate_id,
            Company.archived_at.is_(None),
        )
        .limit(_CANDIDATE_CAP)
    )
    candidates = result.scalars().all()

    # Score each candidate; track seen IDs so one company never appears twice
    matches: list[tuple[Company, float, str]] = []  # (company, confidence, match_type)
    seen_ids: set[int] = set()

    for c in candidates:
        if c.id in seen_ids:
            continue

        # Exact domain (highest precedence)
        if domain and extract_domain(c.website) == domain:
            matches.append((c, 1.0, "exact_domain"))
            seen_ids.add(c.id)
            continue

        c_norm = normalise_name(c.company_name)

        # Exact normalised name
        if norm_name and c_norm == norm_name:
            matches.append((c, 1.0, "exact_name"))
            seen_ids.add(c.id)
            continue

        # Fuzzy name (advisory, lower confidence).
        # token_set_ratio is subset-aware so "Tata" matches "Tata Sons",
        # and handles single-character typos via the underlying ratio.
        if norm_name and c_norm:
            score = fuzz.token_set_ratio(norm_name, c_norm)
            if score >= _FUZZY_THRESHOLD:
                matches.append((c, round(score / 100.0, 2), "fuzzy_name"))
                seen_ids.add(c.id)

    if not matches:
        return []

    # Batch-fetch schedules for ALL matched companies in ONE query
    match_ids = [c.id for c, _, _ in matches]
    sched_result = await db.execute(
        select(OutreachSchedule).where(
            OutreachSchedule.company_id.in_(match_ids),
            OutreachSchedule.is_current.is_(True),
        )
    )
    schedules: dict[int, OutreachSchedule] = {
        s.company_id: s for s in sched_result.scalars().all()
    }

    warnings: list[dict] = []
    for company, confidence, match_type in matches:
        sched = schedules.get(company.id)
        warnings.append(
            {
                "company_id": company.id,
                "company_name": company.company_name,
                "mandate_id": company.mandate_id,
                "status": company.status,
                "initial_date": (
                    sched.initial_date.isoformat()
                    if sched and sched.initial_date
                    else None
                ),
                "confidence": confidence,
                "match_type": match_type,
            }
        )

    return warnings
