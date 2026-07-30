"""CSV / IB-DB pool ingest — parse → map → validate → apply (SOURCING_LAYER_PLAN §3.2).

Canonical flow with delimiter/encoding auto-detection, fuzzy header→field mapping, a
dry-run dedup preview (reusing the profile block keys), and an *idempotent* upsert into
``company_profiles`` (block on domain_key then name_key) so a re-import never duplicates.
"""

from __future__ import annotations

import csv
import io
from decimal import Decimal, InvalidOperation

from rapidfuzz import fuzz
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company_profile import CompanyProfile
from app.models.enums import ImportRowAction
from app.services.profiles import compute_domain_key, compute_name_key, upsert_profile

# Target profile fields the CSV can populate: (field, label, required).
PROFILE_FIELDS: list[tuple[str, str, bool]] = [
    ("company_name", "Company name", True),
    ("website", "Website", False),
    ("hq", "HQ / location", False),
    ("linkedin", "LinkedIn", False),
    ("headcount", "Headcount", False),
    ("revenue_inr_cr", "Revenue (INR Cr)", False),
    ("revenue_source", "Revenue source", False),
]
REQUIRED_FIELDS = [f for f, _, req in PROFILE_FIELDS if req]

# Header synonyms used to fuzzy-suggest a mapping.
_FIELD_SYNONYMS: dict[str, list[str]] = {
    "company_name": ["company name", "company", "name", "target", "organisation", "organization", "account"],
    "website": ["website", "url", "domain", "web", "site"],
    "hq": ["hq", "headquarters", "location", "city", "geography", "region", "country"],
    "linkedin": ["linkedin", "linkedin url", "li"],
    "headcount": ["headcount", "employees", "employee count", "size", "staff", "team size"],
    "revenue_inr_cr": ["revenue inr cr", "revenue (inr cr)", "revenue", "turnover", "sales", "revenue cr"],
    "revenue_source": ["revenue source", "revenue note", "revenue basis", "source of revenue"],
}
_HEADER_MATCH_THRESHOLD = 78


# ── Parsing ───────────────────────────────────────────────────────────────────


def decode_bytes(raw: bytes) -> str:
    """Decode uploaded bytes, tolerating BOM / Windows encodings."""
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def detect_delimiter(sample: str) -> str:
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        return dialect.delimiter
    except csv.Error:
        first_line = sample.splitlines()[0] if sample.splitlines() else ""
        return max(",;\t|", key=lambda d: first_line.count(d)) if first_line else ","


def parse_csv(text: str) -> tuple[list[str], list[dict]]:
    """Return (headers, rows) — rows are dicts keyed by original header text."""
    sample = text[:4096]
    delimiter = detect_delimiter(sample)
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    headers = [h.strip() for h in (reader.fieldnames or [])]
    rows: list[dict] = []
    for raw_row in reader:
        rows.append({(k.strip() if k else k): (v if v is not None else "") for k, v in raw_row.items()})
    return headers, rows


def suggest_mapping(headers: list[str]) -> dict[str, str | None]:
    """Fuzzy-suggest a {profile_field: header} mapping. Greedy by best score; each
    header is used at most once."""
    used: set[str] = set()
    mapping: dict[str, str | None] = {}
    # Score every (field, header) pair, then assign greedily strongest-first.
    scored: list[tuple[int, str, str]] = []
    for field, synonyms in _FIELD_SYNONYMS.items():
        for header in headers:
            h = header.lower().strip()
            best = max((fuzz.token_set_ratio(h, syn) for syn in synonyms), default=0)
            scored.append((best, field, header))
    scored.sort(reverse=True)
    for score, field, header in scored:
        if field in mapping or header in used:
            continue
        if score >= _HEADER_MATCH_THRESHOLD:
            mapping[field] = header
            used.add(header)
    for field, _, _ in PROFILE_FIELDS:
        mapping.setdefault(field, None)
    return mapping


# ── Value coercion + per-row validation ───────────────────────────────────────


def _coerce(field: str, value: str):
    v = (value or "").strip()
    if v == "":
        return None, None
    if field == "headcount":
        cleaned = v.replace(",", "").replace(" ", "")
        try:
            return int(float(cleaned)), None
        except ValueError:
            return None, f"headcount '{value}' is not a number"
    if field == "revenue_inr_cr":
        cleaned = v.replace(",", "").replace("₹", "").replace(" ", "")
        try:
            return Decimal(cleaned), None
        except (InvalidOperation, ValueError):
            return None, f"revenue '{value}' is not a number"
    return v, None


def row_to_facts(raw: dict, mapping: dict[str, str | None]) -> tuple[dict, list[str]]:
    """Map one raw CSV row → profile facts, coercing types. Returns (facts, errors)."""
    facts: dict = {}
    errors: list[str] = []
    for field, _, _ in PROFILE_FIELDS:
        header = mapping.get(field)
        if not header:
            continue
        raw_val = raw.get(header, "")
        val, err = _coerce(field, raw_val if isinstance(raw_val, str) else str(raw_val))
        if err:
            errors.append(err)
        elif val is not None:
            facts[field] = val
    if not facts.get("company_name"):
        errors.append("company_name is required")
    return facts, errors


# ── Dry-run dedup preview ─────────────────────────────────────────────────────


async def dedup_preview(
    db: AsyncSession, firm_id: int, rows: list[dict], mapping: dict[str, str | None]
) -> dict:
    """Classify every row as CREATE / UPDATE / ERROR against existing profiles + within
    the file itself (intra-file merges). Writes nothing (Splink "possible link" review).
    """
    # Materialise facts + block keys per row.
    prepared: list[dict] = []
    domain_keys: set[str] = set()
    name_keys: set[str] = set()
    for i, raw in enumerate(rows):
        facts, errors = row_to_facts(raw, mapping)
        dk = compute_domain_key(facts.get("website"))
        nk = compute_name_key(facts.get("company_name") or "")
        prepared.append({"index": i, "facts": facts, "errors": errors, "dk": dk, "nk": nk})
        if not errors:
            if dk:
                domain_keys.add(dk)
            if nk:
                name_keys.add(nk)

    # Batch-load existing profiles that could match (one query per key kind).
    existing_by_domain: dict[str, CompanyProfile] = {}
    existing_by_name: dict[str, CompanyProfile] = {}
    if domain_keys:
        for p in (
            await db.execute(
                select(CompanyProfile).where(
                    CompanyProfile.firm_id == firm_id,
                    CompanyProfile.archived_at.is_(None),
                    CompanyProfile.domain_key.in_(domain_keys),
                )
            )
        ).scalars():
            if p.domain_key:
                existing_by_domain.setdefault(p.domain_key, p)
    if name_keys:
        for p in (
            await db.execute(
                select(CompanyProfile).where(
                    CompanyProfile.firm_id == firm_id,
                    CompanyProfile.archived_at.is_(None),
                    CompanyProfile.name_key.in_(name_keys),
                )
            )
        ).scalars():
            if p.name_key:
                existing_by_name.setdefault(p.name_key, p)

    counts = {"create": 0, "update": 0, "error": 0}
    intra: dict[tuple, list[int]] = {}
    clusters: list[dict] = []
    row_results: list[dict] = []
    seen_keys: dict[tuple, int] = {}

    for p in prepared:
        if p["errors"]:
            counts["error"] += 1
            row_results.append({"index": p["index"], "action": "ERROR", "message": "; ".join(p["errors"])})
            continue
        key = ("d", p["dk"]) if p["dk"] else ("n", p["nk"])
        matched = (
            (p["dk"] and existing_by_domain.get(p["dk"]))
            or existing_by_name.get(p["nk"])
        )
        # Intra-file duplicate → collapses onto the first row with the same key.
        first_seen = seen_keys.get(key)
        if first_seen is not None:
            intra.setdefault(key, [first_seen]).append(p["index"])
            counts["update"] += 1
            row_results.append({"index": p["index"], "action": "UPDATE", "message": "merges with row in this file"})
            continue
        seen_keys[key] = p["index"]
        if matched:
            counts["update"] += 1
            row_results.append(
                {"index": p["index"], "action": "UPDATE", "message": f"matches existing profile #{matched.id}"}
            )
        else:
            counts["create"] += 1
            row_results.append({"index": p["index"], "action": "CREATE", "message": None})

    for key, indices in intra.items():
        clusters.append({"key": key[1], "row_indices": indices})

    return {
        "counts": counts,
        "clusters": clusters,
        "rows": row_results,
        "total": len(rows),
    }


# ── Idempotent apply ──────────────────────────────────────────────────────────


async def apply_import(
    db: AsyncSession, *, batch, rows: list, mapping: dict[str, str | None]
) -> dict:
    """Upsert every valid row into ``company_profiles`` (idempotent) and record per-row
    outcomes on ``import_rows``. Re-applying the same file resolves to UPDATEs, never dups.
    """
    created = updated = skipped = 0
    for row in rows:
        facts, errors = row_to_facts(row.raw, mapping)
        if errors:
            row.action = ImportRowAction.ERROR
            row.message = "; ".join(errors)
            skipped += 1
            continue
        dk = compute_domain_key(facts.get("website"))
        nk = compute_name_key(facts.get("company_name") or "")
        pre_existing = None
        if dk:
            pre_existing = (
                await db.execute(
                    select(CompanyProfile.id).where(
                        CompanyProfile.firm_id == batch.firm_id,
                        CompanyProfile.domain_key == dk,
                        CompanyProfile.archived_at.is_(None),
                    )
                )
            ).scalar_one_or_none()
        if pre_existing is None and nk:
            pre_existing = (
                await db.execute(
                    select(CompanyProfile.id).where(
                        CompanyProfile.firm_id == batch.firm_id,
                        CompanyProfile.name_key == nk,
                        CompanyProfile.archived_at.is_(None),
                    )
                )
            ).scalar_one_or_none()

        profile = await upsert_profile(db, batch.firm_id, facts, enrich=True)
        row.resolved_profile_id = profile.id
        if pre_existing is not None:
            row.action = ImportRowAction.UPDATE
            row.message = None
            updated += 1
        else:
            row.action = ImportRowAction.CREATE
            row.message = None
            created += 1

    batch.created_count = created
    batch.updated_count = updated
    batch.skipped_count = skipped
    return {"created": created, "updated": updated, "skipped": skipped}


def template_csv() -> str:
    """A downloadable import template (header row keyed by the canonical field labels)."""
    labels = [label for _, label, _ in PROFILE_FIELDS]
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(labels)
    writer.writerow(["Acme Manufacturing Pvt Ltd", "acme.com", "Mumbai", "", "1200", "850.5", "FY24 filings"])
    return buf.getvalue()
