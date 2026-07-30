"""SL-8 — AI ranking: egress allow-list, mock scoring + cache, Groq rotation, degrade."""

from __future__ import annotations

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.company_profile import CompanyProfile
from app.models.enums import CandidateScoreStatus, SourcingStageKind
from app.models.sourcing_candidate import SourcingCandidate
from app.services.providers.base import CandidateFacts, MandateThesis
from app.services.providers.groq import GroqRankingProvider
from app.services.scoring import (
    ALLOWED_CANDIDATE_KEYS,
    assert_egress_safe,
    build_candidate_facts,
    compute_inputs_hash,
    revenue_band,
)

PARTNER = {"email": "partner@test.com", "password": "Passw0rd!"}


async def _login(client: AsyncClient, creds: dict) -> None:
    resp = await client.post("/auth/login", json=creds)
    assert resp.status_code == 200, resp.text


# ── Egress allow-list (§5.7) ──────────────────────────────────────────────────


def test_build_candidate_facts_only_allow_listed_keys():
    from types import SimpleNamespace

    profile = SimpleNamespace(
        id=1, company_name="Acme", hq="Mumbai", website="acme.com",
        headcount=500, revenue_inr_cr=300,
    )
    facts = build_candidate_facts(profile)
    payload = assert_egress_safe(facts)
    assert set(payload).issubset(ALLOWED_CANDIDATE_KEYS)
    # No PII / internal fields present.
    for banned in ("email", "phone", "contact_person", "notes", "analyst", "client_name"):
        assert banned not in payload
    assert payload["has_website"] is True
    assert payload["revenue_band"] == "250-1000"


def test_allow_list_matches_candidate_fields():
    """Drift guard: every CandidateFacts field is consciously on the allow-list, so a
    new field can't silently start leaving the firm without updating §5.7's list."""
    from dataclasses import fields

    assert {f.name for f in fields(CandidateFacts)} == set(ALLOWED_CANDIDATE_KEYS)


def test_assert_egress_safe_rejects_extra_keys(monkeypatch):
    """If a field ever escapes the allow-list, the guard hard-fails the send."""
    import app.services.scoring as scoring

    monkeypatch.setattr(scoring, "ALLOWED_CANDIDATE_KEYS", frozenset({"profile_id"}))
    with pytest.raises(ValueError):
        scoring.assert_egress_safe(CandidateFacts(profile_id=1, company_name="X"))


def test_revenue_is_banded_not_exact():
    assert revenue_band(None) is None
    assert revenue_band(10) == "<50"
    assert revenue_band(9000) == "5000+"


# ── Scoring endpoint (mock provider, AI off) ──────────────────────────────────


async def _profiles(db: AsyncSession, firm_id: int) -> list[CompanyProfile]:
    ps = [
        CompanyProfile(
            firm_id=firm_id, company_name="Rich Co", name_key="rich", domain_key="rich.com",
            website="rich.com", hq="Mumbai", headcount=800, revenue_inr_cr=500,
        ),
        CompanyProfile(
            firm_id=firm_id, company_name="Sparse Co", name_key="sparse",
        ),
    ]
    db.add_all(ps)
    await db.commit()
    for p in ps:
        await db.refresh(p)
    return ps


@pytest.mark.asyncio
async def test_score_with_mock_creates_and_caches(
    client: AsyncClient, partner, mandate, db_session
):
    await _login(client, PARTNER)
    profiles = await _profiles(db_session, mandate.firm_id)
    ids = [p.id for p in profiles]

    resp = await client.post(
        "/sourcing/score", json={"mandate_id": mandate.id, "profile_ids": ids}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["provider"] == "mock_ranking"
    assert body["scored"] == 2
    assert body["cached"] == 0

    # Candidates created (at RESEARCH) with scores.
    cands = (
        await db_session.execute(
            select(SourcingCandidate).where(SourcingCandidate.mandate_id == mandate.id)
        )
    ).scalars().all()
    assert len(cands) == 2
    assert all(c.score_status == CandidateScoreStatus.OK for c in cands)
    sparse = next(c for c in cands if c.profile_id == profiles[1].id)
    assert sparse.insufficient_data is True

    # Second call → all cache hits (same inputs_hash), no re-score.
    resp = await client.post(
        "/sourcing/score", json={"mandate_id": mandate.id, "profile_ids": ids}
    )
    assert resp.json()["cached"] == 2
    assert resp.json()["scored"] == 0


@pytest.mark.asyncio
async def test_score_status_and_feedback(client: AsyncClient, partner, mandate, db_session):
    await _login(client, PARTNER)
    profiles = await _profiles(db_session, mandate.firm_id)
    await client.post(
        "/sourcing/score",
        json={"mandate_id": mandate.id, "profile_ids": [p.id for p in profiles]},
    )
    resp = await client.get(f"/sourcing/score/status?mandate_id={mandate.id}")
    assert resp.json()["OK"] == 2
    assert resp.json()["total"] == 2

    cand = (
        await db_session.execute(
            select(SourcingCandidate).where(SourcingCandidate.mandate_id == mandate.id)
        )
    ).scalars().first()
    resp = await client.post(
        f"/sourcing/candidates/{cand.id}/score-feedback", json={"vote": "up"}
    )
    assert resp.status_code == 200
    await db_session.refresh(cand)
    assert cand.score_feedback == "UP"


@pytest.mark.asyncio
async def test_score_degraded_marks_failed(
    client: AsyncClient, partner, mandate, db_session, monkeypatch
):
    """A provider failure marks candidates FAILED and returns 202 (degraded, not broken)."""
    await _login(client, PARTNER)
    profiles = await _profiles(db_session, mandate.firm_id)

    class _Raiser:
        key = "mock_ranking"

        async def score(self, thesis, candidates):
            raise RuntimeError("provider down")

    import app.api.sourcing as sourcing_api

    async def _fake_resolver(db, firm_id):
        return _Raiser()

    monkeypatch.setattr(sourcing_api, "_resolve_ranking_provider", _fake_resolver)
    resp = await client.post(
        "/sourcing/score",
        json={"mandate_id": mandate.id, "profile_ids": [p.id for p in profiles]},
    )
    assert resp.status_code == 202
    body = resp.json()
    assert body["failed"] == 2
    assert body["degraded"] is True


# ── Groq provider (mocked HTTP — no live Groq in CI) ───────────────────────────


def _groq_response(profile_ids: list[int]) -> httpx.Response:
    import json as _json

    scores = [
        {
            "profile_id": pid,
            "fit_score": 75,
            "band": "GOOD",
            "subscores": {"sector": 70, "size": 80, "geography": 70, "type": 80},
            "rationale": "Solid fit on provided facts.",
            "insufficient_data": False,
            "evidence": ["sector match"],
        }
        for pid in profile_ids
    ]
    content = _json.dumps({"scores": scores})
    return httpx.Response(
        200,
        json={
            "choices": [{"message": {"content": content}}],
            "usage": {"total_tokens": 123},
        },
    )


@pytest.mark.asyncio
async def test_groq_key_rotation_on_429(monkeypatch):
    monkeypatch.setattr(settings, "groq_api_key", "key1")
    monkeypatch.setattr(settings, "groq_api_key_2", "key2")
    monkeypatch.setattr(settings, "groq_api_key_3", None)

    calls = {"n": 0, "keys": []}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        calls["keys"].append(request.headers.get("Authorization"))
        if calls["n"] == 1:
            return httpx.Response(429, json={"error": "rate_limited"})
        return _groq_response([1])

    transport = httpx.MockTransport(handler)
    real_client = httpx.AsyncClient

    def _client_factory(*args, **kwargs):
        kwargs["transport"] = transport
        return real_client(*args, **kwargs)

    monkeypatch.setattr("app.services.providers.groq.httpx.AsyncClient", _client_factory)

    provider = GroqRankingProvider()
    thesis = MandateThesis(mandate_type="SELL_SIDE", side="SELL_SIDE")
    facts = [CandidateFacts(profile_id=1, company_name="Acme", hq="Mumbai", headcount=100)]
    results = await provider.score(thesis, facts)

    assert calls["n"] == 2  # rotated after the 429
    assert calls["keys"][0] != calls["keys"][1]  # different keys used
    assert results[0].fit_score == 75
    assert results[0].band == "GOOD"


@pytest.mark.asyncio
async def test_groq_not_configured_raises(monkeypatch):
    monkeypatch.setattr(settings, "groq_api_key", None)
    monkeypatch.setattr(settings, "groq_api_key_2", None)
    monkeypatch.setattr(settings, "groq_api_key_3", None)
    from app.services.providers.groq import GroqNotConfigured

    provider = GroqRankingProvider()
    with pytest.raises(GroqNotConfigured):
        await provider.score(
            MandateThesis(mandate_type="SELL_SIDE", side="SELL_SIDE"),
            [CandidateFacts(profile_id=1, company_name="X")],
        )


def test_inputs_hash_stable_and_sensitive():
    thesis = MandateThesis(mandate_type="SELL_SIDE", side="SELL_SIDE")
    facts = CandidateFacts(profile_id=1, company_name="Acme", hq="Mumbai")
    h1 = compute_inputs_hash(thesis, facts, "m")
    h2 = compute_inputs_hash(thesis, facts, "m")
    assert h1 == h2
    facts2 = CandidateFacts(profile_id=1, company_name="Acme", hq="Delhi")
    assert compute_inputs_hash(thesis, facts2, "m") != h1
