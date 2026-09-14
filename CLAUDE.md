# Project Upstream — CLAUDE.md

## What this is
A multi-tenant CRM for M&A / investment-banking deal sourcing. It productises three
spreadsheets (Master List, Email Schedule, Contact List) into one connected system.
Greenfield build. Full spec in `plan.md` — read the relevant section before each task.

## Domain glossary
- Firm: the IB firm using the CRM (tenant boundary — everything is firm-scoped).
- Mandate: a deal/engagement (sell-side / buy-side / capital-raise).
- Company (Target/Buyer/Investor): a Master List row, linked to a mandate.
- Contact: a person at a company (firm-scoped, reusable across mandates later).
- Outreach: emails/touches stored as an APPEND-ONLY event log (never columns).
- Cadence: the follow-up schedule, computed from a FIXED anchor = the initial-email date.
- Task: DECLARED work — the counterpart to the work cadence derives. Attached to a project /
  engagement / company / contact, or PERSONAL (owner-only, invisible even to a partner).
- Activity: an APPEND-ONLY audit log of who changed what, written by explicit
  `services.activity.log(...)` calls inside the mutation's own transaction. Never a POST.

## Stack (do not substitute)
- Backend: FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, Alembic, JWT in httpOnly cookies
  (python-jose + passlib[bcrypt]), pytest. DB = SQLite (dev) / PostgreSQL (prod) via DATABASE_URL.
- Frontend: Next.js 16 (App Router) + React 19 + TS, Tailwind v4, shadcn/ui, TanStack Query,
  React Hook Form + Zod, recharts, lucide-react. Vitest + RTL + Playwright for tests. Use the
  frontend-design skill if available; else plan.md §7.3 tokens are authoritative.

## Setup deviations from plan.md (agreed during setup, 2026-06-06)
- **Next.js 16** (+ React 19, Tailwind v4) instead of plan.md §3/§11's "14". `create-next-app@latest`
  now resolves to 16; App Router unchanged, shadcn/ui + TanStack Query compatible (user-approved).
- `bcrypt` pinned `>=4.0.1,<4.1` because passlib 1.7.4 breaks against bcrypt ≥ 4.1.
- Alembic runs migrations through a SYNC driver (`pysqlite`/`psycopg2`) via
  `settings.sync_database_url`; the app engine stays async. One `DATABASE_URL` drives both.
- Async DB driver URLs: `sqlite+aiosqlite:///./upstream.db` dev / `postgresql+asyncpg://` prod.

## Non-negotiable rules
1. Outreach is an append-only event log — never store follow-up dates as columns, never
   mutate/delete an event to "edit history".
2. Cadence (next-due, days-remaining, overdue) is COMPUTED server-side per plan.md §5.2 with
   `today_ist()` (Asia/Kolkata, see `app/core/time.py`); the frontend never recomputes it.
3. A schedule is AWAITING_INITIAL until the first INITIAL_EMAIL is logged (which sets
   initial_date and activates it). initial_date is immutable once set. The clock never ticks
   before the first email is sent.
4. Status RESPONDED/BOUNCED/DECLINED (or a RESPONSE/BOUNCE event) STOPS the cadence.
5. Everything is firm-scoped; analysts see only assigned mandates, partners see all — reuse
   the visibility helper for every list endpoint.
6. SOFT DELETE only (archived_at); default queries exclude archived. There are exactly
   TWO deliberate exceptions, both irreversible, both name-confirmed: `POST /workspace/reset`
   (partner-only; clears the book tier) and `POST /projects/{id}/permanent-delete`
   (NO role gate — visibility only; the project must already be archived, → 409). Nothing
   else in the app hard-deletes.
7. Primary contact is DERIVED from contacts.is_primary (≤1 per company). No primary_contact_id.
8. Auth = httpOnly Secure cookies (no tokens in JS/localStorage); refresh tokens rotate and are
   revocable. Never return password hashes. Secrets only in .env.

## Conventions
- JSON snake_case; ISO-8601 dates; list responses use the §6.2 summary envelope.
- One SQLAlchemy model per file; Pydantic schemas mirror them.
- Backend: pytest per phase. Frontend: Vitest for components + Playwright for critical paths.
- After each phase, update PROGRESS.md and verify that phase's acceptance checklist.

## Data model of a deployment (agreed 2026-08-06)
A **firm is the workspace** — the tenant boundary and the unit of isolation. Every firm has
exactly three tiers, and knowing which tier something is in answers most questions:
1. **Configuration** — users, category vocabulary, funnel stages, data sources, mailboxes.
2. **The company database** (`company_profiles`) — standing research. The ONE thing that
   ships pre-filled: `app/data/company_pool.py`, 164 real organisations with verified
   name/HQ/domain/segment/sector and deliberately NO revenue or headcount. Planted per firm
   by `services/pool.seed_firm_pool` from `/auth/signup` and `app.seed.bootstrap`.
3. **The book** — projects, companies, contacts, schedules, the outreach log, import
   batches, tasks and the activity log. Never seeded. It arrives only from workbooks an
   analyst uploads at `/import`, and `POST /workspace/reset` (partner-only, name-confirmed)
   clears exactly this tier so the same sheets can be re-imported. That reset is the first
   of the two deliberate exceptions to rule 6 below; permanently deleting a project is the
   second.

`app/seed/seed.py` (Faker) is a local dev toy and refuses to run against a non-SQLite
database. Never make it part of a deploy.

## Run
- Backend: `cd backend && uvicorn app.main:app --reload` (docs at /docs).
- Init: `cd backend && python -m app.seed.bootstrap --reset` (firm + users + real company
  database, empty book). `python -m app.seed.seed --reset` for a Faker demo book instead.
- Frontend: `cd frontend && npm run dev`.
- Logins printed by whichever init script you ran (analyst + partner).
