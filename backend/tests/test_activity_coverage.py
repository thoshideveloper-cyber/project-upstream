"""Route-inventory guard — every mutating endpoint is a decision, not an oversight.

The activity log is written by hand at curated call sites, which buys correctness on the
paths a session listener cannot see (bulk ``delete()`` statements fire no ORM events) at
the cost of completeness: nothing stops the next endpoint from quietly shipping without a
log line, and a feed that is silently missing a third of the app is worse than one that is
obviously missing all of it.

This test is that missing guarantee. It walks the live route table and asserts every
POST/PATCH/PUT/DELETE path is in exactly one of two sets: instrumented, or explicitly
declined with a written reason. A new mutating endpoint fails this suite until someone
makes the call. Adding a route to ``NOT_INSTRUMENTED`` is a legitimate answer — writing
nothing is not.
"""

from __future__ import annotations

from app.main import app

MUTATING = {"POST", "PATCH", "PUT", "DELETE"}


def _key(method: str, path: str) -> str:
    return f"{method} {path}"


# Sites that write an activity row today.
INSTRUMENTED: set[str] = {
    "POST /projects",
    "PATCH /projects/{project_id}",
    "DELETE /projects/{project_id}",
    "POST /projects/{project_id}/unarchive",
    "POST /projects/{project_id}/assignments",
    "DELETE /projects/{project_id}/assignments/{user_id}",
    "POST /projects/{project_id}/permanent-delete",
    "POST /mandates",
    "POST /mandates/{mandate_id}/assignments",
    "DELETE /mandates/{mandate_id}/assignments/{user_id}",
    "POST /companies",
    "POST /companies/{company_id}/events",
    "POST /sourcing/push",
    "POST /imports/csv/apply",
    "POST /imports/workbook/apply",
    "POST /tasks",
    "PATCH /tasks/{task_id}",
    "PATCH /tasks/{task_id}/status",
    "DELETE /tasks/{task_id}",
    "POST /tasks/{task_id}/unarchive",
}

# Deliberately not logged, each with the reason. These are answers, not a backlog —
# though several are honest "not yet"s and say so.
NOT_INSTRUMENTED: dict[str, str] = {
    # Security events belong in a security log: different retention, different audience,
    # and one that must survive a workspace reset (activity_events does not).
    "POST /auth/login": "security event, not book activity",
    "POST /auth/logout": "security event, not book activity",
    "POST /auth/refresh": "security event, not book activity",
    "POST /auth/signup": "creates the firm itself; nothing to attach a row to yet",
    # A field-level diff is what would make these useful, and COMPANY_STATUS_CHANGED
    # belongs on the PATCH rather than as a generic COMPANY_UPDATED. Deferred on purpose.
    "PATCH /companies/{company_id}": "needs a real field diff to be worth reading",
    "DELETE /companies/{company_id}": "deferred with the rest of the company diff work",
    "POST /companies/{company_id}/unarchive": "deferred with the company diff work",
    "PATCH /companies/{company_id}/schedule": "deferred; SCHEDULE_UPDATED not yet wired",
    "POST /companies/{company_id}/restart": "deferred; SCHEDULE_RESTARTED not yet wired",
    "POST /contacts": "deferred; contact churn would drown the feed before phrasing is tuned",
    "PATCH /contacts/{contact_id}": "deferred with the rest of contacts",
    "DELETE /contacts/{contact_id}": "deferred with the rest of contacts",
    "POST /contacts/{contact_id}/unarchive": "deferred with the rest of contacts",
    "PATCH /mandates/{mandate_id}": "deferred; needs a field diff like companies",
    "POST /mandates/{mandate_id}/archive": "deferred with the mandate diff work",
    "POST /mandates/{mandate_id}/unarchive": "deferred with the mandate diff work",
    # sent_emails is already its own durable log, with more detail than a feed row.
    "POST /email/send": "sent_emails is already the log for this",
    "POST /email/draft": "AI draft; nothing durable until the send",
    "POST /email/account/sandbox": "mailbox configuration, not book activity",
    "PATCH /email/account": "mailbox configuration, not book activity",
    "DELETE /email/account": "mailbox configuration, not book activity",
    "POST /email/templates": "firm configuration, not book activity",
    "PATCH /email/templates/{template_id}": "firm configuration, not book activity",
    "DELETE /email/templates/{template_id}": "firm configuration, not book activity",
    # Firm configuration — the vocabulary and funnel a firm decided on, not what it did.
    "POST /company-categories": "firm configuration, not book activity",
    "PATCH /company-categories/{category_id}": "firm configuration, not book activity",
    "DELETE /company-categories/{category_id}": "firm configuration, not book activity",
    "POST /sourcing-stages": "firm configuration, not book activity",
    "PATCH /sourcing-stages/{stage_id}": "firm configuration, not book activity",
    "DELETE /sourcing-stages/{stage_id}": "firm configuration, not book activity",
    "POST /sourcing-layers": "firm configuration, not book activity",
    "PATCH /sourcing-layers/{layer_id}": "firm configuration, not book activity",
    "DELETE /sourcing-layers/{layer_id}": "firm configuration, not book activity",
    "PATCH /data-sources/{config_id}": "firm configuration, not book activity",
    # A saved search is one analyst's private view, not a change to the book.
    "POST /saved-searches": "personal view state, not book activity",
    "PATCH /saved-searches/{search_id}": "personal view state, not book activity",
    "DELETE /saved-searches/{search_id}": "personal view state, not book activity",
    "POST /saved-searches/{search_id}/run": "a read; POST only because the filter body is large",
    # Nothing durable happens: preview/inspect/validate/score are read-shaped POSTs
    # (a body too big for a query string), and AI scoring is a cache refresh.
    "POST /imports/csv/preview": "preview only; nothing durable until apply",
    "POST /imports/csv/validate": "preview only; nothing durable until apply",
    "POST /imports/workbook/inspect": "preview only; nothing durable until apply",
    "POST /imports/workbook/preview": "preview only; nothing durable until apply",
    "POST /imports/ib-db": "seeds the profile pool, not the book",
    "POST /sourcing/score": "AI score cache refresh; not a change to the book",
    "POST /sourcing/score/eval": "offline scoring eval harness",
    "POST /sourcing/candidates/{candidate_id}/score-feedback": "tunes the scorer, not the book",
    # Candidate churn belongs in the feed eventually, with CANDIDATE_ADDED /
    # CANDIDATE_STAGE_CHANGED. Deferred until the shortlist stages earn their phrasing.
    "POST /sourcing/candidates": "deferred; CANDIDATE_ADDED not yet wired",
    "POST /sourcing/candidates/bulk": "deferred; CANDIDATE_ADDED not yet wired",
    "PATCH /sourcing-candidates/{candidate_id}/stage": "deferred; CANDIDATE_STAGE_CHANGED not wired",
    "POST /sourcing/engagements": "covered by MANDATE_CREATED once it routes through /mandates",
    # The reset destroys activity_events itself (it is book-tier), so a row recording it
    # would be deleted by the very action it records. Logged to the app logger instead.
    "POST /workspace/reset": "cannot log to a table the action truncates",
}


def _mutating_routes() -> set[str]:
    found: set[str] = set()
    for route in app.routes:
        path = getattr(route, "path", None)
        methods = getattr(route, "methods", None)
        if not path or not methods:
            continue
        for method in methods & MUTATING:
            found.add(_key(method, path))
    return found


def test_every_mutating_route_is_a_decision():
    """A new POST/PATCH/DELETE fails this test until someone decides about logging it."""
    routes = _mutating_routes()
    decided = INSTRUMENTED | set(NOT_INSTRUMENTED)
    undecided = sorted(routes - decided)
    assert not undecided, (
        "These mutating endpoints neither write an activity row nor appear in the "
        "NOT_INSTRUMENTED allowlist with a reason:\n  "
        + "\n  ".join(undecided)
        + "\n\nAdd each to INSTRUMENTED (and call activity.log at the site) or to "
        "NOT_INSTRUMENTED with a one-line reason."
    )


def test_the_allowlists_have_not_gone_stale():
    """Routes that were renamed or removed must not linger in either list.

    A stale entry is how an allowlist quietly stops guarding anything.
    """
    routes = _mutating_routes()
    ghosts = sorted((INSTRUMENTED | set(NOT_INSTRUMENTED)) - routes)
    assert not ghosts, (
        "These entries name routes that no longer exist:\n  " + "\n  ".join(ghosts)
    )


def test_no_route_is_in_both_lists():
    overlap = INSTRUMENTED & set(NOT_INSTRUMENTED)
    assert not overlap, f"Listed as both instrumented and declined: {sorted(overlap)}"


def test_every_declined_route_carries_a_reason():
    empty = sorted(k for k, v in NOT_INSTRUMENTED.items() if not v.strip())
    assert not empty, f"Declined without a reason: {empty}"
