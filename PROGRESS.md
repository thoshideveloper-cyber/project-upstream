# PROGRESS — Project Upstream

Tracks build status, one section per phase. Updated at the end of every phase.

---

## Decisions log
**Plan upgraded to v2 (2026-06-06)** — adopted in full: cookie-based auth, schedule
lifecycle `AWAITING_INITIAL → ACTIVE → STOPPED` with nullable `initial_date`, IST date
math (`today_ist()`), soft-delete (`archived_at`), derived primary contact (no
`primary_contact_id`), `/benchmark`, filter-aware summary envelope, refresh-token
rotation, vertical-slice phasing (Phase 0 now includes the design system + app shell).

Locked choices (incl. two agreed deviations from v2 plan text):
- Auth libs: **python-jose + passlib[bcrypt]** (per v2), `bcrypt` pinned `<4.1` to avoid
  the passlib break.
- DB: async engine, `sqlite+aiosqlite` dev / `postgresql+asyncpg` prod; Alembic via sync driver.
- Cadence: v2 semantics — schedule `AWAITING_INITIAL` until first `INITIAL_EMAIL` (sets
  `initial_date`, activates); fixed-anchor follow-ups; all math in IST.
- Frontend: **Next.js 15** (deviation from v2's "14", per explicit user choice).
- UI: build to plan.md §7.3 tokens (no external design skill available here).
- Seed: no-op without `--reset`.

---

## Phase 0 — Scaffold + design system + shell (v2)  ✅ complete
**Goal:** monorepo skeleton + tooling + frontend design system & app shell; `/health` only.

Backend
- [x] Folder structure (`backend/`, `frontend/`) per plan.md §4
- [x] FastAPI `GET /health`, `pyproject.toml` (§3 deps), `.env.example`, ruff/black
- [x] Async SQLAlchemy engine reading `DATABASE_URL` (`sqlite+aiosqlite` dev)
- [x] `app/core/time.py` with `today_ist()` (Asia/Kolkata)
- [x] CORS with `allow_credentials` + explicit origin; cookie settings in config/.env
- [x] Alembic initialised (sync-migration env via `settings.sync_database_url`)
- [x] `python-jose + passlib[bcrypt]` installed and verified (bcrypt 4.0.1, no passlib break)

Frontend (Next.js 16 + React 19 + Tailwind v4)
- [x] Next.js 16 (App Router, TS) + Tailwind v4 + shadcn/ui (base-nova) + TanStack Query provider + Toaster
- [x] `lib/api.ts` typed client — `credentials: 'include'`, 401 → `/login`; `types/index.ts`
- [x] Design system per §7.3: `StatusBadge` + `CadenceBadge` (exact colour map), `StatCard`,
      `DataTable` wrapper (loading/error/empty states), `EmptyState`, `TableSkeleton`, `PageHeader`
- [x] Left sidebar + top bar shell (role-gated nav via static placeholder `useAuth`) + placeholder
      `/dashboard`; public `/login` placeholder; `/` → `/dashboard` redirect
- [x] `.env.local.example` (`NEXT_PUBLIC_API_URL`); Vitest config + sample test; Playwright config + smoke spec

Root / verify
- [x] `CLAUDE.md`, `README.md`, `PROGRESS.md`, `plan.md`, `docker-compose.yml`, `.gitignore`, `git init` (branch `main`)
- [x] Backend: `pytest` green (1 test); `alembic upgrade head` clean; `/health` → 200
- [x] Frontend: `npm run build` ✅ (typecheck clean, 4 routes); `npm test` ✅ (6 tests);
      `npm run dev` serves `/dashboard` (200, shell renders), `/` 307→/dashboard, `/login` 200 — no console errors

### Environment notes
- **Node 20.18.0** lacks `require(ESM)` (needs 20.19+). Vitest's jsdom deps are ESM-only, so the
  `test` scripts set `NODE_OPTIONS=--experimental-require-module` via `cross-env`. `npm test` just works;
  upgrading to Node ≥ 20.19 makes the flag unnecessary. (`next build`/`dev` are unaffected.)
- `vitest.config.mts` (not `.ts`) so Vitest 4 loads it as ESM.
- Playwright browsers need a one-time `npx playwright install` before `npm run test:e2e`.

### How to run
- Backend: `cd backend && ./.venv/Scripts/python -m uvicorn app.main:app --reload` (docs `/docs`, health `/health`).
  Tests: `./.venv/Scripts/python -m pytest`. Migrate: `./.venv/Scripts/python -m alembic upgrade head`.
- Frontend: `cd frontend && npm run dev` (http://localhost:3000). Tests: `npm test`. Build: `npm run build`.
- Env: copy `backend/.env.example`→`backend/.env` and `frontend/.env.local.example`→`frontend/.env.local`.

---

## Phase 1 — Data model + seed (F-01) ✅ complete

**Goal:** all SQLAlchemy models, Alembic migration, Pydantic schemas, Faker seed.

Backend
- [x] `app/models/enums.py` — all 12 enums (UserRole, MandateType, MandateStatus, CompanyType,
      CompanyStatus, Source, SourceQuality, Engagement, ContactMode, ScheduleStatus,
      OutreachEventType, StoppedReason)
- [x] 8 SQLAlchemy 2.0 model files (one per entity): firm, user, refresh_token, mandate,
      mandate_assignment, company, contact, outreach_schedule, outreach_event
      — all FKs, unique constraints, firm_id on every table, archived_at on
      companies/contacts/mandates, users.token_version, nullable initial_date on schedule,
      AWAITING_INITIAL default; outreach_events has no updated_at (append-only)
- [x] `app/models/__init__.py` imports all models for Alembic autogenerate
- [x] Alembic initial migration generated + applied (`alembic upgrade head` clean)
- [x] Pydantic v2 schemas (Read / Create / Update) for all 8 entities in `app/schemas/`
- [x] `app/seed/seed.py`: 1 firm, 5 users, 4 mandates, 124 companies, 263 contacts, 124
      schedules, 277 events; realistic schedule mix (27 AWAITING / 67 ACTIVE / 30 STOPPED);
      8 deliberate cross-mandate duplicate names; demo logins printed; idempotent without
      `--reset`

**Acceptance criteria verified:**
- `alembic upgrade head` ✅ (all 9 tables created)
- `python -m app.seed.seed --reset` ✅ (clean, re-runnable)
- AWAITING_INITIAL schedules: 27 — none have initial_date set ✅
- All 11 RESPONDED companies have a RESPONSE event ✅
- Every company has exactly 1 primary contact ✅
- 8 cross-mandate duplicate company names across different mandates ✅
- All Pydantic schemas validate from ORM objects ✅
- `pytest` 1/1 ✅ (health check still passes)

**Demo logins** (password for all: `Passw0rd!`):
| Role | Email |
|------|-------|
| PARTNER | partner@upstream.test |
| ANALYST | analyst1@upstream.test |
| ANALYST | analyst2@upstream.test |
| ASSOCIATE | associate1@upstream.test |
| ASSOCIATE | associate2@upstream.test |

**How to run seed:**
```bash
cd backend
python -m app.seed.seed --reset   # wipe + re-seed
python -m app.seed.seed           # add data only (skips if firm exists)
```
## Phase 2 — Auth + roles + firm scoping (F-02/03/04) ✅ complete

**Goal:** cookie-based auth end-to-end + RBAC + first clickable app.

Backend
- [x] `app/core/security.py` — bcrypt hashing, JWT encode/decode, httpOnly cookie helpers,
      refresh-token generation + SHA-256 hashing
- [x] `app/core/deps.py` — `get_current_user` (reads access cookie, checks token_version),
      `require_role(*roles)`, `PartnerOnly`, `visible_mandate_ids(user, db)` (None for partner,
      list[int] for analyst/associate via mandate_assignments)
- [x] `app/api/auth.py` — POST /auth/signup (firm + PARTNER), POST /auth/login,
      POST /auth/refresh (rotation: revoke old, store new hashed), POST /auth/logout
      (revoke + clear cookies), GET /auth/me
- [x] `app/main.py` — auth router mounted
- [x] `tests/conftest.py` — in-memory SQLite (StaticPool) + async client fixtures
- [x] `tests/test_auth.py` — 18 tests: signup, login, wrong creds, /me, cookie required,
      refresh rotation, old-token rejection, token_version bump, logout + revoke,
      partner=None mandates, analyst=assigned only, analyst firm scoped

Frontend
- [x] `/app/login/page.tsx` — React Hook Form + Zod, POST /auth/login, redirect to /dashboard
      on success, field-level validation errors, server error banner
- [x] `/hooks/use-auth.ts` — TanStack Query GET /auth/me, retry:false, 5 min staleTime
- [x] `/app/(app)/layout.tsx` — client-side auth guard: spinner while loading, null (redirect)
      if no session, shell if authenticated
- [x] Topbar + Sidebar null-safe for `user: CurrentUser | null`
- [x] `tests/e2e/login.spec.ts` — Playwright tests: partner/analyst login, wrong password,
      unauthenticated redirect

**Acceptance criteria verified:**
- pytest 19/19 ✅ (18 auth + 1 health)
- Vitest 6/6 ✅ (design system tests unchanged)
- TypeScript typecheck clean ✅
- All auth scenarios: signup, login, wrong creds, refresh rotation, old token rejected,
  token_version bump, logout revokes session ✅
- Analyst firm-scoped: `visible_mandate_ids` returns only assigned mandates ✅
- Partner: `visible_mandate_ids` returns None (= all mandates) ✅
## Phase 3 — Master List API + Companies UI (C-01/02/03/05, X-01) ✅ complete

**Goal:** companies CRUD + cadence-field summary envelope + cross-mandate dupe detection + `/companies` table + `/companies/[id]` detail page.

Backend
- [x] `app/services/cross_mandate.py` — `normalise_name` (strip suffixes/punctuation), `extract_domain` (registrable domain), `find_duplicates` (advisory warning list, X-01)
- [x] `app/api/companies.py` — full router:
  - `_cadence_fields` computes next_due_date / days_remaining / is_overdue server-side (never stored)
  - `_compute_summary` aggregates responded_pct / overdue_count / needs_initial_count / by_status over entire filtered set (not just the page)
  - GET `/companies` with q/status/type/bucket/mandate_id/source/sort/page/page_size/include_archived + summary envelope (C-01/02)
  - POST `/companies` → creates Company + AWAITING_INITIAL schedule + duplicate warnings (C-03/04, X-01)
  - GET `/companies/check-duplicate`
  - GET `/companies/{id}` — full detail with contacts/schedule/events/warnings
  - PATCH `/companies/{id}` — partial update; RESPONDED/BOUNCED/DECLINED status → stops schedule (E-04); `await db.refresh(company)` after commit (server-side `onupdate` fix)
  - DELETE `/companies/{id}` — soft delete (archived_at)
- [x] Firm scoping + analyst visibility enforced on every list/get endpoint
- [x] `tests/test_companies.py` — 15 tests: create+auto-schedule, cross-mandate warning, get/not-found, update, stop-on-respond, soft-delete, list envelope, status filter, name search, summary full-set pagination, analyst visibility, check-duplicate

Frontend
- [x] `types/index.ts` extended — Company, CompanyListResponse, CompanySummary, CompanyDetail, Contact, OutreachEvent, OutreachSchedule, DuplicateWarning, PrimaryContact, Source
- [x] `hooks/use-companies.ts` — useCompanies (with filter QS builder), useCompany, useArchiveCompany, useUpdateCompany
- [x] `app/(app)/companies/page.tsx` — filter-aware stat strip (total / needs-initial / overdue / responded-pct), search + status + type selects + archived toggle, DataTable with Source dot / Type-Bucket / StatusBadge / CadenceBadge / PrimaryContact / HQ columns, pagination
- [x] `app/(app)/companies/[id]/page.tsx` — back + archive actions, header with badges, DuplicateWarning banner, Overview tab (company details + schedule card + notes), Contacts tab, Timeline tab
- [x] `tests/companies-filter.test.tsx` — 5 Vitest unit tests for cadenceStateFromSchedule mapping (AWAITING/STOPPED/overdue/due_soon/upcoming)

**Acceptance criteria verified:**
- pytest 34/34 ✅ (19 auth + 15 companies)
- Vitest 11/11 ✅ (status-badge + companies-filter)
- TypeScript typecheck clean ✅
- GET /companies returns summary envelope with full-set aggregates (not page-only) ✅
- POST /companies creates AWAITING_INITIAL schedule automatically ✅
- PATCH status=RESPONDED stops the schedule ✅
- Soft-delete: archived company excluded from default list, visible with include_archived ✅
- Analyst only sees companies in assigned mandates ✅
- Cross-mandate duplicate warning fires on name/domain match ✅
## Phase 4 — Cadence engine end-to-end (E-01..E-07, C-04 finalize, E-06) ✅ complete

**Goal:** cadence engine fully wired — schedule lifecycle, event logging, work queues, frontend schedule page.

Backend
- [x] `app/services/cadence.py` — `compute_cadence` (fixed-anchor §5.2), `activate_schedule` (AWAITING→ACTIVE, sets immutable initial_date), `stop_schedule`, `pause_schedule` (MANUAL), `resume_schedule`, `EVENT_STOP_MAP` / `EVENT_STATUS_MAP`
- [x] `app/api/companies.py` extended — GET/PATCH `/companies/{id}/schedule`; GET/POST `/companies/{id}/events` (INITIAL_EMAIL activates; RESPONSE/BOUNCE stops + flips status; FOLLOW_UP advances counter; updates contact.last_contact_date)
- [x] `app/api/schedule.py` — GET `/schedule/needs-initial`, `/schedule/due?window=7` (overdue first), `/schedule/overdue`, `/schedule/stats`; all firm+visibility-scoped
- [x] `tests/test_cadence.py` — 14 tests covering cadence math, lifecycle transitions, append-only events, queues, pause/resume

Frontend
- [x] `hooks/use-schedule.ts` — useNeedsInitial, useDue, useOverdue, useScheduleStats, useLogEvent, usePatchSchedule
- [x] `components/features/log-outreach-dialog.tsx` — event-type select + date picker + notes; span.contents trigger wrapper (avoids @base-ui asChild limitation)
- [x] `app/(app)/schedule/page.tsx` — stats strip; grouped sections (Needs first outreach / Overdue / Due today / Due this week) with "Log outreach" per row
- [x] `app/(app)/companies/[id]/page.tsx` — Cadence tab (state, initial date read-only, interval, next due, pause/resume) + Log outreach dialog in tab bar

**Acceptance criteria verified:**
- pytest 48/48 ✅ (34 prior + 14 cadence)
- Vitest 11/11 ✅; TypeScript clean ✅
- compute_cadence matches §5.2 exactly; initial_date immutable once set ✅
- INITIAL_EMAIL activates; RESPONSE stops cadence + flips status; FOLLOW_UP advances counter ✅
- /schedule/due overdue-first; pause→MANUAL; resume→ACTIVE ✅
## Phase 5 — Contacts end-to-end (L-01/02/03) ✅ complete

**Goal:** contacts CRUD (firm-scoped) + primary-contact toggle + touch history + contact list + profile pages.

Backend
- [x] `app/api/contacts.py` — full router:
  - `_get_contact` — firm-scoped, archived-aware lookup
  - `_unset_primary` — enforces ≤1 primary per company (unsets others)
  - GET `/contacts` with q/company_id/engagement/include_archived filters, firm-scoped
  - POST `/contacts` — validates company in firm; is_primary toggle (unsets existing primary); 201
  - GET `/contacts/{id}` — profile + chronological touch history (outreach_events where contact_id=id, asc)
  - PATCH `/contacts/{id}` — partial update; is_primary toggle unsets others; `db.refresh()` after commit
  - DELETE `/contacts/{id}` — soft delete (archived_at = now())
- [x] `app/main.py` — contacts router mounted
- [x] `tests/test_contacts.py` — 14 tests: CRUD, primary toggling (exclusive per company), create-primary unsets existing, primary reflected on company list, touch history assembly (L-03), last_contact_date update on event, soft delete (excluded from default list, visible with include_archived, DB row preserved), firm scoping, auth required

Frontend
- [x] `types/index.ts` extended — ContactDetail (Contact + events[]), ContactListResponse
- [x] `hooks/use-contacts.ts` — useContacts (filters: q/company_id/engagement/include_archived), useContact, useCreateContact, useUpdateContact, useArchiveContact; all mutators invalidate contacts/company/companies queries
- [x] `components/features/contact-dialog.tsx` — create/edit dialog (RHF + Zod); engagement select; is_primary checkbox; span.contents trigger wrapper; coerces empty engagement/email to null
- [x] `app/(app)/contacts/page.tsx` — search input + engagement filter + archived toggle; contact list with Primary badge + last-contact date; links to contact detail
- [x] `app/(app)/contacts/[id]/page.tsx` — profile card (details grid) + touch history timeline; Edit + Archive actions
- [x] `app/(app)/companies/[id]/page.tsx` Contacts tab — "Add contact" button + inline Edit button per contact; uses ContactDialog
- [x] `tests/contact-form.test.tsx` — 8 Vitest unit tests: engagement options correctness, default values, payload coercion (empty engagement/email → null)

**Acceptance criteria verified:**
- pytest 62/62 ✅ (48 prior + 14 contacts)
- Vitest 19/19 ✅ (11 prior + 8 contact-form)
- TypeScript typecheck clean ✅
- POST /contacts creates contact; is_primary=True unsets existing primary for same company ✅
- PATCH /contacts/{id} is_primary toggle unsets others ✅
- GET /contacts/{id} returns chronological outreach_events where contact_id=id (L-03) ✅
- Logging outreach event with contact_id updates contact.last_contact_date ✅
- Soft delete: archived_at set, excluded from default list, visible with include_archived ✅
- All contacts endpoints are firm-scoped; 401 without auth ✅
## Phase 6 — Dashboard + Analytics end-to-end (A-01/A-02 + benchmark + sources) ✅ complete

**Goal:** analytics service + API, mandate benchmark, wired dashboard, analytics page, company benchmark strip.

Backend
- [x] `app/services/analytics.py` — `get_overview` (total, by_status, responded_pct, due_this_week, overdue, needs_initial, active_mandates), `get_response_by_bucket` (A-01, group by bucket), `get_by_analyst` (A-02, by owner_id, events+initial+responses), `get_sources` (group by source×source_quality). "Responded" = `status==RESPONDED` (status stays in sync with events).
- [x] `app/services/benchmark.py` — `get_benchmark`: mandate_response_rate, mandate_avg_touches_to_response, mandate_avg_days_to_response, this_company_touches, this_company_days_to_response (§5.4 exact)
- [x] `app/api/analytics.py` — GET /analytics/overview, /response-by-bucket, /by-analyst (partner only via `require_role`), /sources; all firm+visibility-scoped
- [x] `app/api/companies.py` — appended GET `/companies/{id}/benchmark` (delegates to benchmark service)
- [x] `app/main.py` — analytics router mounted
- [x] `tests/test_analytics.py` — 12 tests: overview coherence, needs-initial count, responded_pct, auth guard, bucket response rate, by-analyst 200 for partner/403 for analyst, event counts, sources structure, benchmark fields, benchmark 404

Frontend
- [x] `hooks/use-analytics.ts` — useAnalyticsOverview, useResponseByBucket, useByAnalyst, useSources, useBenchmark(companyId)
- [x] `app/(app)/dashboard/page.tsx` — KPI strip (total/responded/needs-initial/due-this-week/overdue), status-mix donut (recharts), response-by-bucket bar chart, due-this-week mini-list linked to /schedule; all wired to live API
- [x] `app/(app)/analytics/page.tsx` — response-by-bucket bar chart, source-quality table, by-analyst table (rendered only for PARTNER role)
- [x] `app/(app)/companies/[id]/page.tsx` — BenchmarkStrip component inserted above DuplicateBanner; shows touches/mandate-avg and days-to-response

**Acceptance criteria verified:**
- pytest 74/74 ✅ (62 prior + 12 analytics)
- Vitest 19/19 ✅; TypeScript typecheck clean ✅
- /analytics/overview coherent vs test data; responded_pct > 0 after logging RESPONSE ✅
- /analytics/response-by-bucket groups correctly; response rate > 0 after response event ✅
- /analytics/by-analyst → 200 for partner, 403 for analyst ✅
- /analytics/sources returns rows with source/source_quality/total/response_rate ✅
- /companies/{id}/benchmark returns mandate_response_rate + this_company_touches ✅
- Dashboard renders live KPI cards + charts; analytics page role-gates by-analyst ✅
## Phase 7 — Mandates mgmt + soft-delete UI + polish + deploy ✅ complete

**Goal:** finish mandates end-to-end, soft-delete/unarchive UX everywhere, polish (404/error,
toasts), Playwright critical paths, and deploy docs — closing the §12 Definition of Done.

Backend
- [x] `app/api/mandates.py` — GET `/mandates` (visibility-scoped + per-mandate stats), POST (partner),
      GET `/mandates/{id}` (stats + assignments + lead owner), PATCH (partner), POST `/{id}/archive`
      + `/{id}/unarchive` (partner), GET `/{id}/companies`, POST `/{id}/assignments` + DELETE
      `/{id}/assignments/{user_id}` (partner) — assigning changes the analyst's visible book
- [x] `app/api/users.py` — GET `/users` (firm-scoped) for assignment / lead-owner pickers
- [x] `app/core/deps.py` — added reusable `PartnerDep` annotated dependency
- [x] Unarchive endpoints: POST `/companies/{id}/unarchive`, POST `/contacts/{id}/unarchive` (DoD: restorable)
- [x] `app/main.py` — mandates + users routers mounted
- [x] `tests/test_mandates.py` — 18 tests (scoping, CRUD, role gating, assignment→visibility,
      archive/unarchive, users); + unarchive tests in test_companies/test_contacts

Frontend
- [x] `hooks/use-mandates.ts` + `hooks/use-users.ts`; types: Mandate/MandateListItem/MandateDetail/FirmUser
- [x] `components/features/mandate-dialog.tsx` — create/edit (RHF + Zod, lead-owner picker)
- [x] `app/(app)/mandates/page.tsx` — role-scoped list, stat columns, archived toggle, partner-only create
- [x] `app/(app)/mandates/[id]/page.tsx` — stats, companies mini-list, **assignments management**
      (partner add/remove), edit + archive/unarchive
- [x] `app/(app)/settings/page.tsx` — firm + cadence config + team (closes the nav 404)
- [x] **Create-company dialog** (`components/features/company-dialog.tsx` + `useCreateCompany`) wired into
      `/companies` header — was missing from Phase 3; needed for the create→needs-initial critical path.
      Surfaces cross-mandate duplicate warnings as a toast
- [x] Unarchive (Restore) actions on company + contact detail pages; `/companies?mandate_id=` deep-link filter
- [x] `app/not-found.tsx` (404) + `app/(app)/error.tsx` (error boundary); toasts on create/edit/archive/restore
- [x] Playwright: `tests/e2e/cadence.spec.ts` (create→needs-initial→log initial→due→RESPONSE→stopped),
      `tests/e2e/mandates.spec.ts` (create→archive→restore)
- [x] `tests/mandates.test.tsx` — 3 Vitest unit tests (type/status labels, pct formatting)
- [x] README — full Deploy section (Vercel + Railway/Render, `SameSite=None;Secure` split-origin cookies,
      engine swap via `DATABASE_URL`, daily backups F-04) + Testing section

**Acceptance criteria verified:**
- pytest **94/94** ✅ (74 prior + 18 mandates + 2 unarchive)
- Vitest **22/22** ✅ (19 prior + 3 mandates); TypeScript clean ✅; `npm run build` ✅ (13 routes)
- Mandate list role-scoped; partner assigns an analyst → that mandate enters the analyst's visible book (test) ✅
- Archive/unarchive works across companies/contacts/mandates; archived hidden by default, restorable ✅
- Nav has no dead links (Mandates + Settings now real); 404 + error pages present ✅
- Playwright critical-path specs written (run with both servers + seeded DB) ✅

---

## ✅ BUILD COMPLETE — Definition of Done (§12)

All seven phases (0–7) are done. On a freshly seeded DB:
- Seed → firm + partner/analysts + assignments + ~120 companies + contacts + realistic schedule mix
  + cross-mandate dupes + one primary each; demo logins work.
- Cookie auth; analyst sees only assigned mandates, partner sees all; refresh rotation + logout-everywhere.
- Companies: search/filter/sort/paginate, filter-aware stat strip, archived toggle, create dialog.
- Adding a company auto-creates an AWAITING_INITIAL schedule + warns on cross-mandate dup.
- Work queue (needs-initial + due-this-week, overdue first); initial outreach activates cadence;
  RESPONSE stops it + flips status; cadence numbers match §5.2.
- Company detail: all fields, append-only timeline, contacts (primary flagged), cadence (initial read-only),
  benchmark strip, dup banner.
- Contacts list + profile with chronological touch history; exclusive primary toggle.
- Dashboard + Analytics: scoped stats, response-by-bucket, source quality, partner-only by-analyst.
- Soft delete only; archived hidden by default + restorable everywhere.
- pytest 94 + Vitest 22 green; Playwright critical paths written; frontend builds clean; deploy documented.

### How to demo
1. **Seed:** `cd backend && python -m app.seed.seed --reset` (prints demo logins).
2. **Run:** backend `uvicorn app.main:app --reload`; frontend `npm run dev`.
3. **Log in** as `partner@upstream.test / Passw0rd!` → Dashboard (firm-wide KPIs + charts).
4. **Companies** → search/filter; **New company** → opens its detail (now in *Needs first outreach*).
5. **Log outreach** (Initial email) → cadence activates; **Schedule** shows it under due/overdue queues.
6. Log a **Response** → status flips to Responded, cadence stops (Cadence tab shows stopped reason).
7. **Contacts** → open a profile → chronological touch history; toggle a primary contact.
8. **Mandates** (partner) → open one → assign/unassign an analyst, archive/restore.
9. **Analytics** → response-by-bucket, source quality, by-analyst (partner only).
10. Re-login as `analyst1@upstream.test / Passw0rd!` to see the scoped-down book.

---

## Phase 8 — Slice 1: Schema foundation + cadence multi-cycle (async-tinkering-robin.md)  ✅ complete

**Goal:** Harden the data model so "work like the analyst works" features (project book, cold restart,
follow-up cap) can be built on solid foundations without breaking the existing MVP.

### Schema additions (all additive, non-destructive)

| Entity | Change | Rationale |
|--------|--------|-----------|
| `firms` | `follow_up_cap INT DEFAULT 4` | firm-level cap, overridable per mandate |
| `mandates` | `project_id FK → projects`, `follow_up_cap INT NULL` | links mandate to project; nullable override |
| `companies` | `category CompanyCategory` (non-native enum, default OTHER) | replaces free-text `bucket` for analytics |
| `outreach_schedules` | `cycle_number INT`, `is_current BOOL`, `contact_id FK`, old `UNIQUE(company_id)` → `UNIQUE(company_id, cycle_number)` | multi-cycle restart support |
| `projects` (NEW) | firm_id, name, client_name, timestamps, soft-delete | groups mandates by client; two-sided (sell+buy) |
| `enums` | `CompanyCategory` (6 values), `StoppedReason.EXHAUSTED` | cold-cadence derived state |

### Key decisions

**A1 — Multi-cycle is_current:** All 7 call sites in `companies.py`, plus `analytics.py`,
`cross_mandate.py`, `benchmark.py` were patched to filter `OutreachSchedule.is_current.is_(True)`.
This prevents `MultipleResultsFound` crashes and double-counting on restarted companies.

**A2 — Benchmark cycle scoping:** `benchmark.py` now fetches current-cycle `schedule_id` per peer
first, then scopes all event queries to those IDs — old-cycle touches don't inflate counts.

**A3 — Analytics double-count guard:** `analytics.py` `get_overview()` adds `is_current.is_(True)`
to schedule aggregate queries.

**A4 — bucket→category cutover:** `list_companies` filter and `get_response_by_bucket` analytics now
group/filter by `Company.category` (typed enum). Old `bucket` column preserved (not read).

**B4 — Project backfill:** Migration groups mandates by `(firm_id, client_name)` to create one
Project per client — byte-for-byte match required, documented in seed spec comments.

**Migration detail:** `c1d2e3f4a5b6` (down_revision `a1b2c3d4e5f6`). Uses `batch_alter_table` for
SQLite compatibility. Discovers the old unnamed `UNIQUE(company_id)` constraint dynamically via
`inspect().get_unique_constraints()` at migration time — works on both SQLite and PostgreSQL.

**Test fix:** The `.env` file had `COOKIE_SECURE=true; COOKIE_SAMESITE=none` (prod settings).
HTTPX doesn't send `Secure` cookies over `http://test`, breaking all 94 pre-existing tests.
Fixed by adding an `autouse` monkeypatch fixture in `conftest.py` that forces dev cookie settings
for the test session.

### Seed changes
- 5 mandates (Medanta now two-sided: sell + buy)
- 3+ explicit `Project` objects (Medanta, IndInfra, GreenGrow, Minda)
- All companies seeded with `CompanyCategory` enum (no more random free-text bucket)
- **Zephyr Diagnostics (Cold):** EXHAUSTED schedule (4 follow-ups hit, cadence cold)
- **Horizon Biotech (Restarted):** 2 cycles — cycle 1 EXHAUSTED (is_current=False), cycle 2
  AWAITING_INITIAL (is_current=True, new contact)

### Acceptance criteria

- [x] `alembic upgrade head` clean (SQLite + PostgreSQL compatible)
- [x] `python -m app.seed.seed --reset` seeds Projects, all 5 mandates, EXHAUSTED + RESTARTED demos
- [x] pytest **106/106** ✅ (94 prior + 12 new Slice-1 tests)
- [x] Exactly one `is_current=True` schedule per active company enforced in service layer
- [x] `log_event` on restarted company writes to cycle 2, not cycle 1
- [x] `needs_initial_count` does not double-count companies with 2 AWAITING schedules
- [x] Benchmark `this_company_touches` counts only current-cycle events
- [x] `company.category` defaults to `OTHER`, filter and update work
- [x] `StoppedReason.EXHAUSTED` enum value present
- [x] Pre-existing 94 tests all still green (no MVP regressions)

---

## Phase 8 — Slice 2: Cadence cycle engine + cold + restart  ✅ complete

**Goal:** Wire the multi-cycle schema into real behaviour: auto-stop at cap, cold badge, restart
endpoint, cold work queue.

### Backend changes

**`services/cadence.py`:**
- `effective_cap(firm, mandate)` → `mandate.follow_up_cap ?? firm.follow_up_cap ?? 4`
- `compute_cadence` now returns `is_cold` (True when STOPPED + EXHAUSTED) and `cycle_number`
- `restart_cycle(db, company, new_contact_id, owner_id)` — asserts current cycle is STOPPED,
  demotes it (`is_current=False`), creates a new cycle row (`cycle_number+1, AWAITING_INITIAL,
  is_current=True`), appends a NOTE event. Never mutates past events.

**`api/companies.py`:**
- `_cadence_fields` now includes `is_cold` and `cycle_number` in all responses
- `log_event` FOLLOW_UP handler: after flush, counts followups_done; if `>= effective_cap` and
  company not already stopped, calls `stop_schedule(EXHAUSTED)`
- `GET /companies/{id}/cycles` — all cycles for a company, ordered by cycle_number
- `POST /companies/{id}/restart` (body: `{contact_id}`) — calls `restart_cycle`; returns new cycle

**`api/schedule.py`:**
- `GET /schedule/cold` — current-cycle STOPPED+EXHAUSTED companies, firm+visibility-scoped

### Tests (17 new)
- Unit: `effective_cap` resolves mandate > firm > hard-default 4; `compute_cadence` is_cold flag
- HTTP: FOLLOW_UP auto-exhausts at cap; mandate cap overrides firm cap; RESPONSE before cap stays RESPONDED
- HTTP: restart opens cycle 2 (fresh AWAITING_INITIAL, new contact, null initial_date); old events intact (+NOTE); rejects restart on active cycle
- HTTP: `GET /cycles` returns history in order with correct is_current flags
- HTTP: `/schedule/cold` includes EXHAUSTED, excludes RESPONDED, excludes restarted, analyst-scoped

### Acceptance criteria
- [x] `effective_cap` unit tests (mandate override, firm default, hard default 4)
- [x] `compute_cadence` returns `is_cold=True` iff STOPPED+EXHAUSTED; `cycle_number` always present
- [x] FOLLOW_UP at cap → EXHAUSTED; company detail `is_cold=True`
- [x] `mandate.follow_up_cap` overrides firm cap (integration test)
- [x] RESPONSE before cap → RESPONDED, not EXHAUSTED; `is_cold=False`
- [x] `POST /restart` on active cycle → 400
- [x] After restart: cycle_number=2, AWAITING_INITIAL, old events intact, NOTE appended
- [x] `GET /cycles` returns both cycles in order
- [x] `/schedule/cold` scoped correctly; restarted company leaves cold queue
- [x] pytest **123/123** ✅ (106 prior + 17 Slice-2 tests)

---

## Phase 8 — Slice 3: Project APIs + Project view (FE)  ✅ complete

**Goal:** REST API for projects + the analyst's project book (FE list + detail with sell/buy/raise sections).

### Backend — `api/projects.py`

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `GET /projects` | All (scoped) | Partner → all firm projects; analyst → projects containing ≥1 assigned mandate. Paginated + archived toggle + `?q=` search |
| `POST /projects` | Partner | Creates project under firm |
| `GET /projects/{id}` | All (scoped) | Returns mandates grouped by type (SELL_SIDE/BUY_SIDE/CAPITAL_RAISE), each with headline stats (total_companies, responded, response_rate, overdue_count, cold_count, needs_initial_count). Aggregate `headline` across all visible mandates |
| `PATCH /projects/{id}` | Partner | Updates name/client_name |
| `DELETE /projects/{id}` | Partner | Soft-archive (sets archived_at) |
| `POST /projects/{id}/unarchive` | Partner | Clears archived_at |

Registered in `main.py` alongside other routers.

### Backend tests (14 new)
- Scoping: partner sees all; analyst sees project only if mandate assigned; cross-firm isolation
- CRUD: create returns 201 with firm_id; analyst create → 403
- Detail: engagements grouped by type; headline stats; cold_count from EXHAUSTED schedules
- Analyst: 404 for unassigned project
- PATCH: updates name only; analyst → 403
- Archive/unarchive: excluded by default; visible with `include_archived`; analyst archive → 403

### Frontend

**`types/index.ts`:** Added `Project`, `MandateEngagementStats`, `ProjectHeadline`, `ProjectDetail`

**`hooks/use-projects.ts`:** `useProjects`, `useProject`, `useCreateProject`, `useUpdateProject`, `useArchiveProject`

**`app/(app)/projects/page.tsx`:** Project book list — mandate count, active/archived badge, create dialog (partner-only), archive/restore action, click → detail

**`app/(app)/projects/[id]/page.tsx`:** Project detail — headline stats (companies, response rate, overdue, cold, engagements), sell-side/buy-side/capital-raise sections with per-mandate stat rows, link to `/companies?mandate_id=`, edit + archive (partner-only)

**`components/layout/nav.ts`:** Added "Projects" entry (FolderOpen icon) between Dashboard and Companies

**`tests/projects.test.ts`:** 11 Vitest unit tests — TYPE_LABELS, responseRateLabel, groupEngagementsByType, computeHeadline (aggregation, zero-companies edge case)

### Acceptance criteria
- [x] `GET /projects` partner sees all, analyst sees only assigned-mandate projects
- [x] `POST /projects` analyst → 403; partner → 201 with correct firm_id
- [x] `GET /projects/{id}` groups mandates by type; headline sums correctly; cold_count uses EXHAUSTED
- [x] Analyst gets 404 for project where no mandate is assigned to them
- [x] `PATCH` and `DELETE` analyst → 403; partner succeeds
- [x] Archive/unarchive round-trip; archived excluded from default list
- [x] pytest **137/137** ✅ (123 prior + 14 Slice-3 tests)
- [x] Vitest **33/33** ✅ (22 prior + 11 Slice-3 tests)
- [x] `npm run build` clean — `/projects` and `/projects/[id]` compile without TypeScript errors
- [x] "Projects" visible in sidebar for all roles

---

## Phase 8 — Slice 4: Working grid (FE, the heart)  ✅ complete

**Goal:** Dense working grid for each mandate, grouped by CompanyCategory with inline "log a touch" and inline add-company.

### Backend changes (Slice 4)
- Confirmed: `GET /companies?mandate_id=&category=` already returns `is_cold` and `cycle_number` in cadence fields (from Slice 2); category filter supported.
- No new backend endpoints needed for the grid — all data comes from existing `/companies` API.

### Frontend changes

**`types/index.ts`:**
- Added `CompanyCategory` union type (6 values matching backend enum)
- Added `category: CompanyCategory`, `is_cold: boolean`, `cycle_number: number | null` to `Company`

**`hooks/use-companies.ts`:**
- Added `category` to `CompanyFilters` and `buildQS`

**`app/(app)/projects/[id]/grid/page.tsx`** (new):
- Dense table grouped by `CompanyCategory` (collapsible sections via `CategorySection`)
- Sticky column headers
- Columns: Company, HQ, Status (`StatusBadge`), Cadence (`CadenceBadge`), Next due, Days remaining (server-computed, marked ↻), Primary contact, Log action
- `cadenceTooltip()` explains WHY a badge is overdue, cold, or awaiting — rendered as HTML `title` on the badge
- Cold companies: badge overrides to "Cold" with Snowflake icon; tooltip says "Restart the cadence to re-engage"
- Inline "Log" button per row — opens `LogOutreachDialog` without leaving the grid
- `InlineAddRow` per category section: click "Add company to X" → inline form with name/type/HQ; posts via `useCreateCompany` with the category pre-filled, stays in grid
- `data-testid` attributes on grid, rows, add buttons, and name input for Playwright
- Empty state and loading skeleton

**`app/(app)/projects/[id]/page.tsx`:**
- "Grid view →" link on each mandate card (links to `/projects/[id]/grid?mandate_id=X`)
- "Table view" link alongside (links to `/companies?mandate_id=X`)

**`tests/grid.test.ts`** (new — 11 Vitest tests):
- `groupByCategory`: correct bucket placement, empty input, multiple in same category, missing category defaults to OTHER
- `cadenceTooltip`: cold mentions restart, overdue names due date, awaiting prompts INITIAL_EMAIL, upcoming shows date, cold overrides overdue
- `cadenceStateFromSchedule` for cold/stopped + inline log availability

**`tests/e2e/grid.spec.ts`** (new — Playwright):
- Add company inline → appears in grid
- Log initial email via grid "Log" button → cadence ticks (badge changes from "Needs first outreach" to active)

### Acceptance criteria
- [x] Grid page renders at `/projects/[id]/grid?mandate_id=X`; companies grouped by category
- [x] Each category section is collapsible (ChevronRight toggle)
- [x] Sticky table headers
- [x] "Log" button per row opens `LogOutreachDialog` inline
- [x] "Add company" inline form per category; posts `category` = section's category
- [x] Cadence badge tooltip explains overdue / cold reason
- [x] Cold companies display as "Cold" badge + Snowflake icon (not "Stopped")
- [x] Days remaining labelled as server-computed (↻)
- [x] pytest **146/146** ✅ (no regressions)
- [x] Vitest **44/44** ✅ (33 prior + 11 grid tests)
- [x] `npm run build` clean — 16 routes

---

## Phase 8 — Slice 5: Partner overview  ✅ complete

**Goal:** Firm-wide per-project + per-engagement health analytics, partner-gated.

### Backend changes

**`services/analytics.py`:**
- Added `get_project_analytics(db, firm_id)`:
  - Fetches all non-archived projects for the firm (ordered by name)
  - For each project, loads its mandates; for each mandate computes: `total_companies`, `responded`, `response_rate`, `overdue_count` (batched follow-up count, no N+1), `cold_count` (EXHAUSTED current-cycle schedules), `needs_initial_count`
  - Returns per-project headline aggregated across mandates + per-engagement list

**`api/analytics.py`:**
- Added `GET /analytics/projects` (partner-gated via `PartnerDep`): calls `get_project_analytics`, returns `{"items": [...]}`

### Frontend changes

**`types/index.ts`:**
- Added `EngagementAnalytics`, `ProjectAnalyticsHeadline`, `ProjectAnalyticsItem`, `ProjectAnalyticsResponse`

**`hooks/use-analytics.ts`:**
- Added `useProjectAnalytics()` hook

**`app/(app)/analytics/projects/page.tsx`** (new):
- Collapsible `ProjectCard` per project: headline bar (companies, response rate, overdue, cold, needs-first-touch), expandable per-mandate `EngagementRow` with type badge + stats + "Grid →" deep-link
- `AnalystTable`: reuses `useByAnalyst()` data (events / initial emails / responses / conversion per analyst)
- Error state: shows "Access denied — partner role required" on 403
- Loading skeleton

**`components/layout/nav.ts`:**
- Added "Project health" nav entry (`/analytics/projects`, partner-only) using `BarChart3` icon

### Backend tests (`tests/test_slice5.py` — 9 new tests)
- Partner → 200 with `items` list
- Analyst → 403
- Created project appears in list
- Each item has `headline` + `engagements` with required fields
- `total_companies` and `needs_initial_count` match created companies
- `responded` + `response_rate` reflect actual RESPONSE events
- `cold_count` increments when EXHAUSTED (cap=1 shortcut)
- Engagement list has one entry per mandate with correct `id`, `name`, `type`
- Empty project (no mandates) has zero headline without crashing

### Acceptance criteria
- [x] `GET /analytics/projects` → 200 for PARTNER, 403 for ANALYST
- [x] Per-project headline: total_companies, responded, response_rate, overdue_count, cold_count, needs_initial_count all correct
- [x] Per-engagement list: one entry per mandate, numbers match headline sum
- [x] Empty project returns zero headline (no crash)
- [x] Frontend: `/analytics/projects` visible in sidebar for PARTNER only
- [x] Loading and error states handled
- [x] pytest **146/146** ✅
- [x] Vitest **44/44** ✅
- [x] `npm run build` clean — 16 routes including `/analytics/projects`

---

## Phase 8 — Slice 6: Fuzzy cross-mandate dedup  ✅ complete

**Goal:** Replace exact-only cross-mandate duplicate detection with fuzzy matching, fix the N+1
schedule query, add confidence scores to warnings, and surface nudges in the grid and company detail.

### Backend changes

**`pyproject.toml`:** Added `rapidfuzz>=3.6` dependency.

**`services/cross_mandate.py`** (full rewrite):
- Uses `rapidfuzz.fuzz.token_set_ratio` — subset-aware, handles "Tata" ⊂ "Tata Sons" (score=100)
  and single-char typos like "Microsft" ~ "Microsoft" (score≈89)
- Threshold: 80/100 (catches variants; excludes unrelated names)
- Match tiers:
  - `exact_domain` (confidence=1.0) — registrable domain equality
  - `exact_name` (confidence=1.0) — normalised name equality
  - `fuzzy_name` (confidence=score/100, <1.0) — token_set_ratio above threshold
- **Single batched schedule query**: after scoring all candidates, one `WHERE company_id IN (...)`
  fetches all schedules (no N+1 per candidate)
- Candidate cap: 500 rows to bound scan cost on large books
- Each warning now returns `confidence` (float 0–1) and `match_type` string

### Frontend changes

**`types/index.ts`:** `DuplicateWarning` gains `confidence: number` and
`match_type: "exact_name" | "exact_domain" | "fuzzy_name"` fields.

**`app/(app)/companies/[id]/page.tsx`:** `DuplicateBanner` upgraded:
- Renders a `ConfidencePill` per warning showing match type + percentage (e.g., `similar name · 87%`)
- "Advisory only" disclaimer line below the list
- Clickable company name links to the matched company detail

**`app/(app)/projects/[id]/grid/page.tsx`:** Inline-add nudge system:
- `InlineAddRow.onAdded` now passes `(companyName, warnings[])` to parent
- `CategorySection` stores pending nudges in local state
- `DupNudgeBanner` renders below the category rows with dismissible × button,
  showing company link, mandate ID, and confidence pill
- Error state added to the grid (was missing): shows "Failed to load" + retry button
- `flex-wrap` on top bar and summary strip for mobile degradation

### Tests (`tests/test_slice6.py` — 17 new tests)
- Unit: `normalise_name` strips suffixes + punctuation + whitespace
- Unit: `extract_domain` strips www, handles bare domain, null/empty
- ORM: exact name, exact domain, fuzzy typo ("Microsft"), fuzzy subsidiary ("Tata" ~ "Tata Sons")
- ORM: unrelated names no match; same-mandate excluded; archived excluded
- ORM: batch schedule fetch populates `initial_date` correctly
- ORM: multiple matches all returned without error
- HTTP: POST /companies returns 201 even with fuzzy match (advisory, non-blocking);
  response includes `confidence` + `match_type` in warnings
- HTTP: GET /companies/check-duplicate returns fuzzy match with `confidence` field

### Acceptance criteria
- [x] Fuzzy catches "Microsft" ~ "Microsoft" (typo variant)
- [x] Fuzzy catches "Tata" ~ "Tata Sons" (subsidiary variant after suffix stripping)
- [x] Exact name match → confidence=1.0, match_type="exact_name"
- [x] Exact domain match → confidence=1.0, match_type="exact_domain"
- [x] Same-mandate and archived companies excluded
- [x] Advisory: POST /companies with fuzzy match → 201 (non-blocking)
- [x] Single batched schedule query — schedule data present in warnings
- [x] `DuplicateBanner` shows confidence pill + advisory disclaimer
- [x] Grid shows `DupNudgeBanner` after inline-add with warnings (dismissible)
- [x] pytest **163/163** ✅ (146 prior + 17 Slice-6 tests)
- [x] Vitest **44/44** ✅; `npm run build` clean — 16 routes

---

## Phase 8 — Slice 7: Polish + design rationale  ✅ complete

**Goal:** DESIGN.md written, optimistic TanStack updates on grid actions, all new views have
complete loading/empty/error states, mobile degradation, no dead nav links.

### Deliverables

**`DESIGN.md`** (new file):
- Financial tool rationale: Bloomberg/Affinity/Linear/Stripe as inspiration
- Dense, calm, trustworthy aesthetic; keyboard-first
- Semantic status colour table (exact plan.md §7.3 map)
- Typography: system font, tabular-nums, label/value split
- Layout: persistent sidebar, top bar with role badge, mobile degradation strategy
- Working grid design rationale (why `<table>` over cards, sticky headers, category sections)
- Cadence column design ("↻" computed marker, badge + tooltip pattern)
- Fuzzy nudge framing (inline vs toast, advisory disclaimer)
- Component conventions: loading skeleton / empty / error states
- Optimistic updates strategy

**Optimistic TanStack updates:**
- `useLogEvent` (`hooks/use-schedule.ts`):
  - `onMutate`: cancel in-flight queries; immediately update `["company", companyId]` cache
    — INITIAL_EMAIL flips `schedule_status → "ACTIVE"`, RESPONSE/BOUNCE flips `status + schedule_status`
  - `onError`: rollback to snapshotted previous state
  - `onSettled`: full invalidation to sync server truth
- `useUpdateCompany` (`hooks/use-companies.ts`):
  - `onMutate`: cancel in-flight detail query; immediately merge patch data into company cache
  - `onError`: rollback on failure

**Loading/empty/error state audit (all new views):**
| View | Loading | Empty | Error |
|------|---------|-------|-------|
| `/projects` | DataTable skeleton ✅ | EmptyState + CTA ✅ | DataTable error ✅ |
| `/projects/[id]` | Pulse skeleton ✅ | "No mandates" dashed box ✅ | "Project not found" ✅ |
| `/projects/[id]/grid` | Pulse skeleton ✅ | "No companies yet" ✅ | "Failed to load" + retry ✅ |
| `/analytics/projects` | Pulse skeleton ✅ | "No projects yet" + link ✅ | 403 "access denied" ✅ |

**Mobile degradation:**
- Grid top bar: `flex-wrap` — breadcrumb + company count reflow at narrow widths
- Grid summary strip: `flex-wrap` — stat pills wrap rather than overflow
- Project detail stat grid: `grid-cols-2 sm:grid-cols-4 lg:grid-cols-5` already responsive
- DataTable (shadcn Table): inherits horizontal scroll on narrow screens

**Nav audit (no dead links):** All 9 nav items in `nav.ts` have real pages (Dashboard, Projects,
Companies, Schedule, Contacts, Mandates, Analytics, Project health, Settings). ✅

### Acceptance criteria
- [x] `DESIGN.md` written with financial tool rationale + plan.md §7.3 reference
- [x] `useLogEvent` has optimistic cache update + rollback on error
- [x] `useUpdateCompany` has optimistic cache update + rollback on error
- [x] All 4 new views have loading/empty/error states
- [x] Grid has error state with retry button (was missing)
- [x] No dead nav links
- [x] Mobile: grid top bar + summary strip use `flex-wrap`
- [x] pytest **163/163** ✅ (no regressions from Slice 7 changes)
- [x] Vitest **44/44** ✅
- [x] `npm run build` clean — 16 routes

---

## Phase 2a — "Work Like the Analyst Works" refinement (MVP)

Implemented `PHASE2_REFINEMENT_PLAN.md` §11 Phase 2a (the shippable MVP) end-to-end, plus
the low-risk §11 Phase 2c BUG-10 analytics fix. Phase 2b (converge to a single master
`Company` + `engagement_placements`, the high-risk FK cutover) is **intentionally deferred**
per the plan's own sequencing ("End of 2a = the MVP. Ship, demo, gather feedback before 2b").

### Slice A1 — Two-axis classification (backend + migration + seed)
- `company_categories` firm-configurable vocabulary (`CompanyCategoryVocab`) — seeded with
  Strategic, Private Equity, VC, Family Office, **PMS, Private Credit, Investment Bank,
  Holding/Corporate**, Other. `FINANCIAL_SPONSOR` folds into Private Equity.
- `sourcing_layers` per-engagement ordered bands (`SourcingLayer`), seeded per mandate type.
- `companies.category_id` + `companies.sourcing_layer_id` FKs; legacy `category` enum kept as a
  single-writer derived cache; `bucket` preserved as backfill source only.
- Routers: `/company-categories` (list open, mutations partner-only), `/sourcing-layers`
  (visibility-scoped per engagement). Category admin surfaced in Settings.
- `CompanyType` dropped from the add form — **derived** from `mandate.type` (BUG-7).
- Migration `d2f1a3b4c5d6`: seeds vocab per firm, maps enum→category_id, best-effort seeds
  layers from distinct `bucket` per mandate. `upgrade→downgrade→upgrade` clean on SQLite.

### Slice A2 — Shared company profiles (the interim bridge, Req A)
- `company_profiles` firm-wide shared record + `companies.profile_id`; static-fact edits write
  the profile and **propagate to every engagement** (a colleague's Trunorth revenue edit shows
  everywhere). No FK moves on schedules/events/contacts — imperfect dedupe is recoverable.
- `/company-profiles` = firm-wide **Master List** (one row per company + its placements),
  visibility-scoped. Migration `e3a2b4c6d7e8` dedupes by domain/name key. Read-only dry-run
  report at `scripts/dedupe_report.py`. Fixed `extract_domain` false-merge on `.co.in` etc.

### Slice A3 — Unified grid + one add path (BUG-2/6/8/9/11)
- Grid rewritten: **nested Sourcing-layer band → Category sub-group → rows** with a Group-by
  control [Band→Category | Category | Status | None]. "Table view" link removed.
- One `<AddCompany>` component (dialog everywhere, incl. grid per-band and Master List) with
  Excel parity: hq, headcount, rationale, relevant investments, live exchange-rate revenue
  conversion, category + sourcing layer (+ new), optional inline primary contact(s), and a
  warm/duplicate nudge at the name field. Legacy `CompanyDialog` deleted.
- Backend list path: batched cadence enrichment (BUG-9), single filtered subquery (BUG-11),
  new `category_id`/`sourcing_layer_id`/`unsorted` filters. Company detail shows Category +
  Sourcing layer (not `bucket`) + shared-profile note.

### Slice A4 — Response → contact capture (Req B, BUG-1/5/12)
- `Sentiment` enum; `outreach_events.{mode,sentiment}` (source of truth) + `contacts.sentiment`
  cache. Migration `f4b3c5d7e9a0`.
- `POST /companies/{id}/events` captures **who** responded (pick existing / create inline,
  matched by email/name), Mode, Sentiment, Comments; sets `event.contact_id`; refreshes the
  contact's latest-touch cache.
- `recompute_status` single-writer projects status from the event log (BUG-1); **COLD stays a
  derived cadence state, never a status**.
- Response dialog upgraded; firm-wide Contacts list shows company/category/POC/sentiment tags
  and filters by sentiment / engagement / POC.

### Phase 2c — Analytics correctness (BUG-10)
- Response-rate **by category** and **by sourcing layer** (`/analytics/response-by-category`,
  `/analytics/response-by-layer`), correctly named; `/response-by-bucket` kept as a deprecated
  backward-compat shim. Dashboard + Analytics pages + `use-analytics.ts` updated.

### Verification
- Backend **pytest 186/186** ✅ (incl. new `test_slice_a1/a2/a4`; updated analytics tests).
- Frontend **vitest 49/49** ✅, `tsc --noEmit` clean, eslint clean on changed files.
- Alembic `upgrade → downgrade → upgrade` clean on SQLite through `f4b3c5d7e9a0`.
- Seed refreshed (136 companies → 113 shared profiles, categories + layers populated).

---

## Sourcing Layer — research→active funnel + firm-wide pool + Push + AI ranking  ✅ complete
**Goal:** `SOURCING_LAYER_PLAN.md` implemented in full (SL-1 → SL-9): MVP **and** every
"later" item (pluggable providers + Groq AI ranking). Backend-first per slice; each ends green.

### Data model (all additive + reversible; MIG-1..MIG-4, single linear head `d0f2b4c5e6a7`)
- `sourcing_stages` (firm-wide funnel vocabulary, `kind`-driven) + `sourcing_candidates`
  (mandate × profile — the funnel entity, **folded AI score cache**, unique `(mandate,profile)`).
  Funnel position lives on the candidate, **not** `companies.stage_id` (no drift). MIG-1 seeds
  the 5 default stages per firm + **backfills** candidate rows from existing placements (audit line).
- `import_batches` (+ `import_rows`) — CSV/IB-DB ingest audit + idempotency (MIG-2).
- `saved_searches` — PRIVATE/FIRM pool queries (MIG-3).
- `data_source_configs` — pluggable-provider registry (MIG-4; seeds mock + disabled Groq per firm).
- New enums: `SourcingStageKind, CandidateScoreStatus, SavedSearchScope, ImportSource,
  ImportStatus, ImportRowAction, DataSourceKind`. **COLD stays a derived cadence state**, never a stage.

### Slices
- **SL-1** Funnel stages + candidates; `/sourcing-stages` (partner, invariants: ≤1 ACTIVE,
  exactly 1 PASSED, RESEARCH/SHORTLIST sort before ACTIVE); `PATCH /sourcing-candidates/{id}/stage`
  with transition side-effects (→ACTIVE materialises the placement + cycle-1 `AWAITING_INITIAL`);
  RESPONSE→auto-Engaged hook in `log_event`. Old "sourcing layer" **deprecated** → "thesis bands"
  (`/sourcing-layers` marked deprecated, dropped from nav). Settings **Manage sourcing stages** panel.
- **SL-2** Pool ingest: CSV **4-step wizard** (Upload→Map→Validate&dedup→Apply) + IB-DB one-shot +
  `scripts/import_ib_db.py` (dry-run). Delimiter/encoding auto-detect, fuzzy header→field mapping,
  dry-run dedup preview, **idempotent `upsert_profile`** (re-import → 0 dupes), error-row download.
- **SL-3** `GET /sourcing/candidates` firm-wide pool search + per-mandate candidate overlay +
  **batched** warm history (visibility-scoped detail); saved searches CRUD + run; CSV export;
  workspace list view + candidate cards (progressive disclosure).
- **SL-4** **Push to Project + Side** — one `push_to_mandate` service, full resolution matrix
  (one/several/none-partner/none-analyst/already-present, all visibility-scoped), type derived from
  side, `<PushToDialog>` + "Push & log initial email"; `POST /sourcing/engagements` (partner).
- **SL-5** Kanban over `sourcing_candidates` (drag-to-advance, WIP counts, **drag→Active = explicit
  confirm**); list row-select + bulk shortlist bar with **Undo**.
- **SL-6** `GET /my-book` (placements grouped by project, attention-sorted overdue→due-soon→awaiting,
  batched cadence); `/company-profiles?scope=firm&group_by=analyst` partner overlap view; Master List
  My-book / Firm-wide tabs.
- **SL-7** Provider seam (`services/providers/` Protocols + per-firm registry), `MockRankingProvider`
  + `MockEnrichmentProvider`; `/data-sources` (partner enable/disable) + Settings panel.
- **SL-8** Groq AI ranking behind the seam: thin httpx client (key rotation on 429, model fallback
  chain, strict JSON schema, daily budget); **`build_candidate_facts` egress allow-list** (§5.7 — no
  PII leaves, unit-guarded); `POST /sourcing/score` (batched + `inputs_hash` cache, 202 degraded),
  `/score/status`, thumbs feedback capture. `httpx` moved to **runtime** deps; `GROQ_*`/`sourcing_ai_*`
  declared in `config.py` (off by default). AI is advisory (sorts, never gates); degrades to unscored.
- **SL-9** Funnel analytics (`/sourcing/funnel-analytics`: by-stage, response-by-stage, pool coverage,
  AI-fit-vs-outcome) + analytics page; formal eval `POST /sourcing/score/eval` (Cohen's κ + Spearman,
  dependency-free).

### Non-negotiables honoured
Append-only outreach; server-computed cadence with `today_ist()`; `AWAITING_INITIAL` + immutable
`initial_date` (clock starts only on `INITIAL_EMAIL`); RESPONDED/BOUNCED/DECLINED stop the clock;
COLD derived; firm-scoped + `visible_mandate_ids()` on every list/detail; soft-delete only;
additive up→down→up migrations; dry-run dedup before every apply; Groq secrets only in `.env`.

### Verification
- Backend **pytest 254/254** ✅ (186 baseline + 68 new across `test_sl1..sl9` + `test_migrations`).
- Frontend **vitest 62/62** ✅, `tsc --noEmit` clean.
- Alembic full chain `upgrade head → downgrade base → upgrade head` clean on SQLite; single head.
- Seed refreshed (default stages + mock/Groq data-source rows per firm).

## Email pipeline — Outreach desk sends real email (2026-07-18)

The Schedule page's second redesign pass: the desk now *sends* the outreach it schedules.

- **EM-1 Mailbox connection** — `email_accounts` (1/user): Gmail (Gmail API) / Outlook (MS Graph)
  via OAuth authorization-code (signed-state JWT, tokens Fernet-encrypted at rest via
  `core/crypto.py`), plus **Sandbox** provider (simulated sends, full pipeline) so demo installs
  work with zero OAuth config. `/email/account` + `/email/oauth/{provider}/start|callback`.
- **EM-2 Deliverability model** — sends go through the analyst's OWN mailbox (provider-signed
  SPF/DKIM, mail in their Sent folder, replies thread back — never a relay/bot fingerprint);
  plain-text MIME, one recipient per message, per-analyst daily pacing cap (429 past limit),
  deliberately **no bulk send**. Client-side "send health" lint (personalization/length/links/
  subject spam-triggers) in the compose sheet.
- **EM-3 Send + log coupling** — `POST /email/send` sends then logs the `INITIAL_EMAIL`/`FOLLOW_UP`
  through the same cadence primitives as the manual path (activate / exhaustion-check /
  `recompute_status`); full message archived in append-only `sent_emails` linked to its event.
- **EM-4 Templates** — `email_templates` (personal + firm-shared, soft-delete, use counts),
  `{{variable}}` substitution live in the editor (reverse-substitution on "Save as template");
  4 seeded firm starters; Settings manager card.
- **EM-5 AI drafting** — `POST /email/draft` (Groq, strict JSON, key rotation + model fallback)
  from real CRM context (cadence state, recent touches, contact, mandate type, regarding);
  fills the editor only — the analyst always edits and sends.
- **EM-6 Desk integration** — compose sheet (envelope header + mono cadence-truth strip), sender
  chip with paced count, row/lead primary actions become "Send …" when connected (log-only path
  preserved in the split menu), Focus Mode sends, schedule rows carry `primary_contact`
  (batched, no N+1) for prefill + row identity. Settings: account + signature + daily limit.

### Verification
- Backend **pytest 266/266** ✅ (incl. 9 new `test_email.py`); migration `e5a7c9d1b3f5` upgrades clean.
- Frontend **vitest 63/63** ✅, `tsc --noEmit` clean, `next build` clean.
- Live E2E (Playwright): connect sandbox → compose → template → **real Groq draft** → send →
  201 + toast + row clear + cadence recompute → focus-mode send path → settings cards. Light+dark.
- Seed fix: contact emails now use `extract_domain(website)` (was `name@https://www…`).

---

## Track L — L1: Landing theme + copy foundation (docs/ui-upgrade-study.md §8) ✅ complete

**Goal:** Give the `marketing/` landing a working light/dark toggle with a *deliberately designed*
light hero (never auto-inverted), and a loss-aversion copy pass on the hero — per the L1 phase in
`docs/ui-upgrade-study.md`.

### Frontend (`marketing/`)
- [x] `components/marketing/theme-toggle.tsx` — new nav toggle; reuses the localStorage-backed
      `components/theme.ts` store (persists across reloads, syncs across tabs); mounted-guarded so
      the Sun/Moon glyph never mismatches the pre-paint `THEME_INIT_SCRIPT` during hydration.
- [x] `site-nav.tsx` — toggle wired into the desktop actions and beside the mobile hamburger.
- [x] `app/page.tsx` — removed the hardcoded `className="dark"` wrapper that forced the whole
      landing dark regardless of the `<html>` theme class; the toggle now actually drives the theme.
- [x] **Light hero designed on purpose** (not auto-invert):
  - `globals.css` `.mkt-grid` dots now track `--foreground` via `color-mix` → light graphite on
    paper, light specks on obsidian.
  - Daylight override softens the ambient amber `.mkt-spot` (0.11 alpha, more blur) so amber warms
    the paper instead of muddying it.
  - New `.mkt-elev` elevation helper: a soft, believable paper shadow in Daylight, the deep obsidian
    drop in dark — replaces the harsh `oklch(0 0 0 / 0.8)` slab on the hero desk + product shots.
  - Light `--muted-foreground` darkened to `oklch(0.44 …)` for ≥4.5:1 on warm paper.
  - Theme-agnostic surface overlays: `bg-white/[…]` → `bg-foreground/[…]` in hero pill, CTAGhost,
    feature tabs, security proof icons; window-chrome dots → `bg-muted-foreground/25`.
- [x] **Loss-aversion hero copy:** headline now leads with the loss we prevent —
      *"Deals don't die in the pitch. They die in the follow-up no one sent."* — with a relief lede
      naming both fears (a slipped date costing the fee; the relationship walking out when an analyst
      leaves). Features/Security copy already loss/benefit-led (kept).

### Acceptance criteria (L1 "Done")
- [x] Toggle works + persists across reloads (localStorage store; verified via persisted-theme reload)
- [x] Both themes designed on purpose; light hero is amber-on-paper with softened glows, not inverted
- [x] Contrast ≥4.5:1 both themes (light muted ink darkened; dark unchanged/compliant)
- [x] Hero copy leads with the loss we prevent
- [x] `tsc --noEmit` clean · `next build` clean (static prerender) · zero console errors
- [x] Screenshot proof: dark + light, desktop (1440) + mobile (390) — all four intentional, no overflow

---

## Track P — P1: Command palette (⌘K) (docs/ui-upgrade-study.md §8) ✅ complete

**Goal:** A global, keyboard-first command palette for the product app (`frontend/`) — jump-to
(page / project / engagement / company / contact) + quick actions (log outreach, new company),
per the P1 phase in `docs/ui-upgrade-study.md`. No route regressions.

### Frontend (`frontend/`)
- [x] `lib/command-palette.ts` (new) — pure, React-free helpers so the matching + keyboard-index
      logic is unit-testable in isolation: `matches` (token-AND substring), `itemMatches`,
      `filterGroups` (drops empty groups), `flattenGroups` (ordered flat list for arrow nav),
      `moveIndex` (wrapping, safe on empty).
- [x] `components/features/command-palette.tsx` (new) — the palette, mounted once in the app shell:
  - Opens on **⌘K / Ctrl-K** (global keydown) and via a **custom event** (`command-palette:open`)
    fired by the top-bar button. Built on the `@base-ui/react` Dialog primitive (portal + focus
    trap + Escape), top-anchored, Obsidian-Amber skin.
  - **Jump-to:** Pages (role-filtered via `visibleNav`), Projects + Engagements (small cached lists,
    client-filtered), Companies + Contacts (server-side search via `useCompanies`/`useContacts`,
    debounced 180 ms, enabled only at ≥2 chars). Data queries mount only while the palette is open.
  - **Quick actions:** "New company" → opens the `AddCompanyForm` dialog (firm-wide, engagement
    picker), routes to the new company on save; "Log outreach…" → switches the palette into a
    company-pick mode, then opens `LogOutreachDialog` for the chosen company. Launched dialogs live
    in the always-mounted parent so they survive the palette closing.
  - **Keyboard-first + a11y:** `role=combobox`/`listbox`/`option`, `aria-activedescendant`,
    ArrowUp/Down (wrap) · Home/End · Enter to select · Escape (backs out of log-pick first, then
    closes); active row scrolled into view; footer key hints; autofocused input.
- [x] `components/layout/topbar.tsx` — discoverable "Search… ⌘K" trigger button (fires the open
      event); icon-only below `sm`.
- [x] `app/(app)/layout.tsx` — `<CommandPalette />` mounted inside the authenticated shell.
- [x] `hooks/use-contacts.ts` — added an optional `{ enabled }` arg (mirrors `useContacts`'s sibling
      `useCompanies`) so the palette doesn't fetch all contacts until there's a query. Additive,
      backward-compatible.
- [x] `tests/command-palette.test.ts` (new) — 21 Vitest unit tests for the helpers (matching AND
      semantics, field folding, empty-group drop, flatten order, index wrapping/empty).
- [x] `tests/e2e/command-palette.spec.ts` (new) — Playwright: keyboard-open + focus + jump-to-page,
      Escape-close, New-company quick action, top-bar-button open.

### Acceptance criteria ("Done": keyboard-first, accessible, no route regressions)
- [x] `tsc --noEmit` clean · `npm run build` clean — **20 routes**, no new/removed routes (palette
      is a shell-level component, not a route)
- [x] Vitest **76/76** ✅ (55 prior + 21 palette)
- [x] Live proof on a seeded local stack (analyst1): ⌘K opens with the input focused; "sch" returns
      the Schedule page **and** Bosch India (server search); "tata" returns Tata Power Company · Mumbai;
      Enter on "Schedule" navigates to `/schedule`; top-bar button opens the palette; zero page errors.
      Screenshots captured (open + search), on-brand amber highlight + hairline chrome.
- [x] Keyboard-first (arrows/Home/End/Enter/Escape) + ARIA combobox/listbox/option semantics
- [x] No backend changes; cadence never recomputed client-side; firm-scoping/visibility unchanged
      (search reuses the existing scoped `/companies` + `/contacts` endpoints)

---

## Track L — L2: Problem + Stats (docs/ui-upgrade-study.md §8) ✅ complete

**Goal:** Add the two missing above-the-fold persuasion beats to the `marketing/` landing — a
**Problem/agitation** section (§3.3) and a **Stats band** (§3.5) with a Number-Ticker count-up —
on-brand (Obsidian-Amber), and reduced-motion-safe, per the L2 phase in `docs/ui-upgrade-study.md`.

### Frontend (`marketing/`)
- [x] `components/marketing/problem.tsx` (new) — "drift ledger" of four concrete status-quo pains,
      each agitating then resolving in a single amber relief line (the spreadsheet-vs-Upstream
      comparison baked into every card): Master List drifts out of sync · a follow-up slips unnoticed ·
      the partner's pipeline isn't real · relationships walk out with the analyst. 2×2 bento
      (`sm:grid-cols-2`), `hover-lift` cards, muted icon chip, Cormorant sub-heads, `→` amber tick.
      Static → wrapped in `<Reveal>`.
- [x] `components/marketing/stats.tsx` (new) — full-width band (`border-y`) of four seed-true figures
      (136 companies · 403 outreach events · 137 live schedules · 7% reply rate) as an instrument-panel
      readout: big Cormorant `tabular-nums`, mono amber labels, hairline dividers (`lg:` only),
      honesty footnote ("replaced with your own aggregates on day one").
  - **`Ticker`** — self-contained count-up: server-renders the final value (accessible + no-JS
    correct), on first scroll into view (IntersectionObserver, threshold 0.4) snaps to 0 and climbs
    (easeOutCubic, 1200ms, staggered `i*90ms`). Honors `prefers-reduced-motion` via a `matchMedia`
    early-return that never resets — the true figure just stays put. Not wrapped in `<Reveal>` (its
    own observer drives the animation; avoids the blur/transform fighting the count-up).
- [x] `app/page.tsx` — wired in the §6.1 sequence: Hero → **Problem** → Logos → **Stats** → Features.

### Acceptance criteria (L2 "Done": both live, on-brand, reduced-motion-safe)
- [x] Problem + Stats live in the correct sequence; Obsidian-Amber identity (one amber accent, hairlines,
      Cormorant/Outfit/JetBrains-Mono voice) — verified by screenshot
- [x] Stats count-up animates on scroll into view; reduced-motion path shows the true figure immediately
      (no reset); numbers are `tabular-nums`
- [x] `tsc --noEmit` clean · `next build` clean (static prerender, 2 routes) · **zero console errors**
      across all four theme/viewport captures
- [x] Screenshot proof — dark + light, desktop (1440) + mobile (390): both themes deliberate (light is
      graphite-on-paper, not inverted); mobile Problem stacks single-column, Stats collapses to 2×2
      (dividers drop below `lg`); no horizontal overflow

---

## Track P — P2: DataTable pattern (docs/ui-upgrade-study.md §8) ✅ complete

**Goal:** Bring the P2 "DataTable" capabilities — URL-persisted list state, column visibility,
sticky headers, row-selection + bulk actions, tabular numerals — to the product app's list
surfaces (`frontend/`), per the P2 phase in `docs/ui-upgrade-study.md`.

**Scope decision (user-approved): _retrofit, don't replace._** P2 as written says "pilot a generic
DataTable on the Master List, then Contacts + Schedule" — but all three were already redesigned into
bespoke, non-generic forms the user approved (Master List = registry grid, Contacts = split-view
rolodex, Schedule = outreach desk), and memory records that generic-table versions of two were
*explicitly rejected*. So we added the missing power-table behaviours **into** those designs via a
shared reusable layer, with zero visual regression — rather than regressing approved work.

### Shared layer (new, framework-agnostic + unit-tested)
- [x] `lib/table-url-state.ts` — pure URL⇄typed-state core: `stringParam`/`intParam`/`boolParam`/
      `enumParam` codecs + `decodeState`/`encodeQuery`. Params at their default are omitted (clean URL);
      foreign params (`?deal`, OAuth flags) are preserved on every write.
- [x] `lib/selection.ts` — pure `Set<number>` selection helpers: `toggle`, `toggleMany` (per-group
      select-all), `allSelected`, `selectedCount`, `pruneSelection` (drops ids that left the view).
- [x] `hooks/use-table-url-state.ts` — SSR-safe React binding (first render = defaults for hydration
      parity, mount effect reads the real `?query`); writes via `history.replaceState` (no nav/scroll
      jump); optional `{ ready }` gate. Spec must be module-level (stable ref).
- [x] `hooks/use-column-visibility.ts` — localStorage-backed visible-column set, hydration-safe,
      intersected with the currently-declared columns (stale keys can't resurrect).
- [x] `components/features/column-toggle.tsx` — show/hide menu on the proven `DropdownMenuItem`
      primitive (manual check indicator, `closeOnClick={false}`). Locked columns disabled+checked.
- [x] `components/features/bulk-bar.tsx` — floating `role="toolbar"` selection bar (live count, Clear,
      action slot); `animate-in slide-in` that `prefers-reduced-motion` neutralises.

### Master List (pilot) — `app/(app)/master/page.tsx`, both tabs
- [x] **URL-persisted state**: My-book (`q/scope/lens/sort`) and Firm-database
      (`q/category_id/engagement_type/status/min_engagements/sort/page/by`) — the firm params keep the
      exact names Analytics deep-links already emit, so `/master?...&status=RESPONDED` drill-throughs
      still land. Saved views (localStorage) now apply via the URL patcher.
- [x] **Column visibility**: My-book (Category/HQ/Rev/Next touch) and Firm-DB (Worked by/Rev/Staff/Deals),
      Company + Status locked; persisted per-table. `colCount` recomputed for every `colSpan` cell
      (project ledger rows, search banner, empty states) so the registry never mis-spans.
- [x] **Row selection + bulk actions**: a select column (checkbox appears on hover / stays once any row
      is picked) + a header select-all over exactly the displayed set; `BulkBar` → **Export selected**
      (My-book + Firm) and **Archive selected** (My-book, `useArchiveCompany`, confirm). Selection prunes
      when the filter/search set changes.
- [x] **Sticky header**: the table scrolls in its own `max-h-[calc(100vh-13rem)] overflow-auto` box so
      the column header pins (per-cell hairline survives `border-collapse`); satisfies §7 "wide content
      scrolls in its own box, no horizontal body scroll".
- [x] Signature preserved: registry ledger rows, **coverage cells**, deal chips, status dots, CSV export,
      by-analyst overlay all intact.

### Rolled to Contacts + Schedule (each in its own idiom)
- [x] **Contacts** (`contacts/page.tsx`): filters `q/view/mine/arch` moved into the URL (shareable +
      reload-stable); the `?c=` selected-person + keyboard nav keep their existing sync. Selection/bulk
      intentionally **not** forced onto the rolodex button-rows (would regress the approved list form);
      bulk lives on the columnar Master List where it belongs.
- [x] **Schedule** (`schedule/page.tsx`): scope/search/sort mirrored to the URL (`?seg/q/sort`, custom
      `seg` codec for the mixed band+day-offset horizon; mandate stays on `?deal`). The desk already had
      row-selection + bulk-log + sticky section headers, so only URL-persistence was missing.

### Verification
- [x] `tsc --noEmit` clean · `eslint` clean · `next build` clean — **17 routes**, all prerender.
- [x] Vitest **90/90** ✅ (76 prior + 14 new: `table-url-state` 8 + `selection` 6).
- [x] Live proof on a seeded local stack (partner + analyst1), **zero console errors**: Firm-DB select-all
      → bulk Export bar; Columns menu (Company locked); **sticky header pins** when the table box scrolls;
      My-book registry + coverage cells intact with select-all → Export/**Archive** bar; URLs persist
      (`?view=firm-wide`, `?q=a` on Contacts, `?seg=late` on Schedule). Screenshots captured.
- [x] Bug found + fixed mid-verify: `DropdownMenuLabel` (base-ui `Menu.GroupLabel`) throws #31 unless
      inside a `Menu.Group` → replaced with a plain styled header in `ColumnToggle`.

---

## Track L — L3: Mechanism (docs/ui-upgrade-study.md §8) ✅ complete

**Goal:** Show the mechanism instead of claiming it — upgrade Features with an **Animated Beam**
("three sheets → one system", §3.6) and add the **How-it-works** 3-step section (§3.7), per the L3
phase in `docs/ui-upgrade-study.md`.

### Frontend (`marketing/`)
- [x] `components/marketing/animated-beam.tsx` (new) — a measured beam overlay (Magic-UI's
      AnimatedBeam idea, rebuilt on tokens with no framer-motion, which the marketing app doesn't
      carry). Positions come from `getBoundingClientRect` on the live nodes, not hard-coded
      geometry, so the same beams follow the layout when it flips from a column on mobile to a row
      on desktop. Re-measures on `ResizeObserver` (container + every node), `window.resize`, and
      `document.fonts.ready` (Cormorant/Outfit swapping in resizes the cards). Each connector picks
      its axis from the dominant centre-to-centre delta — a horizontal S-curve side by side, a
      vertical one stacked — and leaves/arrives at the facing edge. `aria-hidden` (decorative);
      the SVG fades in only once measured, so there's no pre-paint flash.
- [x] `components/marketing/mechanism.tsx` (new) — `SheetsToSystem`: three spreadsheet nodes
      (`master_list.xlsx` · `email_schedule.xlsx` · `contact_list.xlsx`, each labelled with what it
      holds) converging on the Upstream mark. Amber packets travel each rail into the hub, staggered
      420 ms apart. Row of three → hub below on mobile; column of three → hub on the right at `sm+`.
      Beams are painted behind the nodes (svg first + positioned cards) — no negative z-index, so no
      stacking-context trap.
- [x] `components/marketing/features.tsx` — the diagram now sits directly under
      "Three spreadsheets. One source of truth.", before the tab bar: the claim, then its proof.
- [x] `components/marketing/how-it-works.tsx` (new) — §3.7 stepper: `01 Import your sheets` ·
      `02 Log the initial email` (sets the immutable anchor) · `03 The cadence runs itself` (IST,
      server-side, auto-stopping). Each step carries a mono **when** kicker (Day one · 30 minutes /
      The first send / Every morning after) so the three read as a timeline at a glance. Horizontal
      rail + 3-up at `md+`; vertical rail + stacked at mobile.
- [x] `app/page.tsx` — wired in the §6.1 sequence: … → Features → **How it works** → Security → …
- [x] `app/globals.css` — `.mkt-beam-rail` / `.mkt-beam-pulse` (dash travels a `pathLength="1"`
      normalised path, so one dash length works at every breakpoint) and `.mkt-step-rail`
      (draws left→right off the existing `.reveal-shown` hook — one signature motion per section).

### Reduced motion + accessibility
- [x] **Reduced-motion fallback:** packets park and the rails read as static amber traces; the
      how-it-works rail starts fully drawn (`<Reveal>` skips its observer under reduced motion, so
      `.reveal-shown` never lands and the draw-in would never fire). Verified in a
      `reducedMotion: "reduce"` browser: `animation-name: none`, `stroke-dasharray: none`,
      rail `transform: none` at full 1088 px width.
  - Gotcha: the overrides had to be declared **after** the base rules — a media query adds no
      specificity, so the existing `@media (prefers-reduced-motion)` block higher in the file lost
      to the later `.mkt-beam-pulse` declaration (measured live before the fix: dash still applied,
      rail stuck at `scaleX(0)` = invisible).
- [x] **Contrast ≥4.5:1, both themes** — audited the new text against its composited background in
      a real browser: all 7 targets pass (dark 4.83–17.89, light 7.20–15.52). Two fixes it forced:
  - dark `--muted-foreground` lifted `oklch(0.52 → 0.58 0.012 265)` — it was **3.76:1** on obsidian
    (site-wide, pre-existing); now 4.83 on `--background`, 4.72 on `--card`. Affects every muted
    line on the landing, all in the improving direction.
  - step numerals are ink, not amber: amber-on-paper is 3.03:1 at 12 px, so the accent moved to the
    chip's ring (`border-primary/40`) and the figure itself is `text-foreground`.
  - **Known, out of scope (flag for L5):** `Eyebrow` (amber at 11 px) is ~3.0:1 in Daylight on every
    section — a pre-existing brand-accent issue that needs a dedicated darker "amber ink" token,
    not a one-section patch.

### Acceptance criteria (L3 "Done": beam animates with a reduced-motion fallback; steps read at a glance)
- [x] Beam animates (3 rails + 3 packets measured at every breakpoint: 286 px horizontal at 1440,
      vertical convergence at 390) with the static-trace reduced-motion fallback verified
- [x] The three steps read at a glance — mono when-kicker + display title + one-line rationale, 3-up
      on desktop, rail-connected stack on mobile
- [x] `tsc --noEmit` clean · `next build` clean (static prerender, 2 routes)
- [x] Screenshot proof — dark + light, desktop (1440) + mobile (390), plus a reduced-motion pass and
      full-page captures in both themes: both themes deliberate, no horizontal overflow at any size
- [x] Zero console/page errors from the new work. One pre-existing 404 remains: Next prefetches
      `/login`, which lives in the product app (`frontend/`), not in `marketing/` — unrelated to L3.

---

## Track P — P3: Outreach timeline (docs/ui-upgrade-study.md §8) ✅ complete

**Goal:** Render the append-only outreach log as a first-class timeline on company + contact
detail, in the plan.md §7.3 status-colour language, honouring the append-only and firm-scoping
rules — per the P3 phase in `docs/ui-upgrade-study.md`.

**Design:** the log reads as a **cadence spine**, not a list of rows — a live head node saying what
happens next, then every touch with its offset from the immutable anchor and the gap to the touch
below it, so "we chased four times over 93 days and they replied on day 93" is legible at a glance.

### Frontend (`frontend/`)
- [x] `lib/outreach-timeline.ts` (new) — pure, React-free helpers so the arithmetic is unit-testable:
      `EVENT_LABEL`/`EVENT_TONE` (the §7.3 map), `stopsCadence`, `daysBetween`, `buildTimeline`
      (newest-first entries with per-cycle `dayOffset`/`gapDays`/`isAnchor`/`stops`), `bandByCycle`,
      `summarize`, `gapLabel`/`offsetLabel`/`formatEventDate`.
  - **Order-independent:** `/companies/{id}` returns events newest-first and `/contacts/{id}`
    oldest-first — `buildTimeline` sorts internally, so both render identically.
  - **Per-cycle arithmetic:** a restarted company counts from *its* cycle's anchor (day 0 again,
    not +412d) and no gap is measured across a cycle boundary.
  - **Nothing recomputed:** next-due / days-remaining / overdue come from the server (CLAUDE.md
    rule 2); the offsets are descriptive arithmetic over dates the log already committed to.
- [x] `components/features/outreach-timeline.tsx` (new) — the shared component:
  - **Colour language** = the literal `StatusBadge` oklch pills, so a green node is the same green
    as the "Responded" badge above it. Channel is carried by the icon, not a new hue: violet starts
    it (the anchor), slate is us reaching out, green is them answering, red/amber ends it, grey is
    an annotation.
  - **Head node** — dashed ring: "Awaiting the first email" (violet, "the clock starts the day the
    initial email is logged — not before"), "Next follow-up · <date> · Nd overdue / due in Nd"
    (red/amber), or "Cadence stopped · reason" (grey).
  - **Entries** — event label, `anchor · day 0` / `stopped the cadence` / sentiment pills, offset +
    date, attribution (`with <contact> · <mode> · logged by <owner>`, resolved from the company's
    contacts and the firm-scoped `/users` list), `Re:` regarding, and notes in a quoted block.
  - **Rail** — gap markers between nodes ("7d later", "72d later", "same day") give the cadence its
    rhythm; **cycle bands** label the spine whenever the company has restarted (including the common
    case where every logged event still belongs to the previous cycle).
  - **States** — designed empty state with a CTA ("Nothing logged yet · every email, call and reply
    lands here — appended, never overwritten"), "Show N earlier entries" above 8, and a standing
    footer: *"Append-only log — entries are never edited or deleted. A correction is logged as a new
    note."* No edit/delete affordance exists anywhere in the component (CLAUDE.md rule 1).
- [x] `hooks/use-schedule.ts` — added `useCycles(companyId)` (read-only `GET /companies/{id}/cycles`).
- [x] `app/(app)/companies/[id]/page.tsx` — the Timeline tab now renders the spine with cycles +
      server cadence; the old ad-hoc timeline (indigo/emerald/sky/violet Tailwind palette, date-only
      rows) is gone.
- [x] `app/(app)/contacts/[id]/page.tsx` — replaced the crude `TouchHistory` list with the same
      component in `compact` form; contacts aren't passed (on a person's own page "with <them>" on
      every row is noise). Empty state offers a "Log a touch" CTA prefilled with that person.

### Backend (`backend/`) — one additive field
- [x] `api/contacts.py` — `GET /contacts/{id}` now resolves `company_name` (the same field the list
      endpoint already returned, firm-scoped by the same query). The contact page previously never
      named the company the person works at; it now appears in the header and in the log dialog.

### Verification
- [x] `tsc --noEmit` clean · `next build` clean — **20 routes**, unchanged · eslint clean on every
      touched file
- [x] Vitest **113/113** ✅ (90 prior + 23 new in `tests/outreach-timeline.test.ts`: day arithmetic,
      the §7.3 tone map, order-independence, anchor immutability, per-cycle offsets/gaps/banding,
      summary counts, label phrasing)
- [x] Playwright `tests/e2e/outreach-timeline.spec.ts` (new) — 2/2 pass: company timeline shows the
      anchor pill + append-only note and renders labels not raw enums; contact timeline lists that
      person's touches.
- [x] Backend **270/270** pass (`pytest`) after the contacts change
- [x] Live proof on a seeded local stack (partner), **zero console/page errors**, no horizontal
      overflow: a RESPONDED company (stopped head → green Response "+93d" → 72d/7d gaps → follow-ups
      → anchor), the seeded **restarted** company (violet "Awaiting the first email" head + `CYCLE 1`
      band + `with Ramesh Iyer · logged by Priya Sharma`), and a contact page (anchor pill, newest
      first from an ascending API). Screenshots in dark + light at 1440 and dark at 390.

### Pre-existing test rot (NOT from this phase — flagged for P5)
7 older Playwright specs fail on a correctly-wired local stack, all on stale selectors for UI that
earlier phases deliberately redesigned — verified by reading each failure, and none touch the
timeline, company detail or contact detail:
- `smoke.spec.ts` ×2 and `login.spec.ts` (partner) — assert the pre-rebrand "Project Upstream"
  heading and an unauthenticated `/` → `/dashboard` redirect.
- `grid.spec.ts` ×2 — wait for a "Grid view" link that moved when Projects became the deal room.
- `cadence.spec.ts` — `getByLabel(/Mandate/)` on the add-company form (now an engagement picker).
- `mandates.spec.ts` — a "New mandate" button on the removed legacy `/mandates` route.
Running with `--workers=1` also fixes 3 further failures that are pure parallel-login flakes
(partner login lands on `/dashboard` in ~2.1s alone, past the 5s expect timeout under 4 workers).

---

## Track L — L4: Conversion (docs/ui-upgrade-study.md §8) ✅ complete (pricing deferred)

**Goal:** The conversion beats of the landing — testimonials upgraded to an analyst *and* a partner
quote with specific outcomes (§3.10) and final-CTA polish with a shimmer button (§3.13).

> **Scope decision (user, this session): the Pricing section (§3.11) is deferred — "ignore the
> pricing section we can build it later."** Nothing was stubbed or half-built for it; the page
> sequence is unchanged and Pricing can drop between Testimonials and FAQ when the tiers are decided.

### Frontend (`marketing/`)
- [x] `components/marketing/testimonials.tsx` — restructured around **the two people who decide**
      (study §1): two featured cards, `THE ANALYST / RELIEF` and `THE PARTNER / CONTROL`, each with a
      display-size pull quote, an amber **outcome line** (the fact that makes the quote credible —
      "No follow-up missed in the first quarter" · "Analyst handover with zero relationships lost"),
      and name · role · firm. The 3-column marquee wall survives underneath as "More from the desk"
      (shortened to `30rem`), so the section still has its signature motion without burying the two
      quotes that matter.
- [x] **§7 content honesty, fixed on the page** — the personas were only labelled in a code comment;
      a visitor read nine named people at named firms as customers. The section now says so in
      visible copy: *"Illustrative personas, not customers. We'll publish named quotes when our
      first desks go on the record."*
- [x] `components/marketing/closing-cta.tsx` — a last loss-aversion beat before the ask
      ("Somewhere in the book, a follow-up is already late…"), the **shimmer** on the primary CTA,
      and a risk-reversal line under the buttons (30-minute demo · your sheets, imported live · live
      on the desk in days).
- [x] `app/globals.css` — `.mkt-shimmer`: a 4.2s sheen sweeping the amber button (the only looping
      motion below the fold), with a reduced-motion override that removes the sweep and leaves the
      button's amber weight untouched (verified in a `reducedMotion: "reduce"` browser:
      `animation-name: none`, `::after` opacity 0, button still rendered).

### Closes the amber-contrast item flagged in L3
- [x] New **`--primary-ink`** token: `oklch(0.53 0.15 56)` in Daylight, identical to `--primary` on
      obsidian — amber as *text*, while fills/icons keep the brighter accent. Exposed as
      `text-primary-ink` via `@theme inline`.
- [x] Applied to every small amber **text** run: `Eyebrow` (site-wide, was **3.03:1** in Daylight —
      the L5 item from L3), the stats labels, the mechanism hub's "ONE SYSTEM", the hero artifact's
      due-tone numerals + pill + "Work the queue" chip, the FAQ inline link, the testimonial persona
      tags and avatar initials. Icons and tints were left on `--primary` (decorative, and paired with
      a text label).
- [x] Re-audited live in both themes — **10/10 pass**: dark 4.80–17.68, light 4.75–15.83. The
      site-wide Eyebrow went 3.03 → **5.16**.

### Verification
- [x] `tsc --noEmit` clean · `next build` clean (static prerender, 2 routes)
- [x] Screenshot proof — testimonials + closing CTA in dark and light at 1440 and 390, plus
      full-page captures in both themes to confirm the darker amber ink still reads as amber
      everywhere it now appears. No horizontal overflow at any size.
- [x] Zero console/page errors from this work; the pre-existing `/login` prefetch 404 remains
      (that route lives in the product app, not `marketing/`).

---

## Track P — P4: Analytics + states (docs/ui-upgrade-study.md §8) ✅ complete

**Goal:** Charts with legends/tooltips/empty/loading, KPI cards with a number ticker, and a
systematised state vocabulary — skeletons only past 300 ms, empty states with a CTA, confirm **and
undo** on destructive actions — per the P4 phase in `docs/ui-upgrade-study.md`.

**Scope decision (same ethos as P2): _retrofit, don't replace._** `/analytics` and `/dashboard` were
already rebuilt to the "performance briefing" bar in an earlier session (finding line, Conversion
Spine, low-n recession, `MetricRail` with `useCounter`). So P4 went at what that pass explicitly left
behind: the two un-redesigned analytics surfaces, and the app-wide state vocabulary.

### Shared state layer (new)
- [x] `hooks/use-delayed.ts` — `useDelayed(active, 300)`: true only once a wait has actually passed
      300 ms, so a cache-warm query never flashes a skeleton. The timer arms in the effect and
      disarms in its cleanup, and the return is `&&`-ed with `active`, so the flag can't survive into
      the next load and skip its own delay.
- [x] `components/features/confirm-dialog.tsx` — `ConfirmProvider` (mounted in the app shell) +
      `useConfirm()` returning `await confirm(opts) → boolean`. Same call shape as `window.confirm`,
      so each call site changed by a few lines, but the copy can now name the consequence *and* the
      reversal. Escape/backdrop resolve as a cancel (never a hang); falls back to `window.confirm`
      when no provider is mounted, so a unit-tested component can't deadlock.
- [x] `lib/undo-toast.ts` — `toastUndo(message, undo)`: an 8-second success toast carrying an **Undo**
      action. Every destructive action here is a soft delete (CLAUDE.md rule 6), so the reversal
      already existed as an API call — it just had nowhere to be clicked from.

### Rolled across every destructive action
- [x] `window.confirm` → `useConfirm` at **10 sites**: company archive, contact archive, Master List
      bulk archive, project archive/restore (list + detail), category archive, stage archive, mailbox
      disconnect (×2), template delete. Each dialog now says what happens and how it comes back.
- [x] **Undo** wired where a reversal exists: company, contact, Master List bulk (restores the whole
      set), and project archive.
- [x] One `window.confirm` deliberately left, with a comment: the compose sheet's "Discard this
      draft?" guard — a synchronous `onOpenChange` guard over unsaved text, not saved data.
- [x] Skeletons gated on `useDelayed` across `/analytics`, `/dashboard`, `/analytics/projects`,
      `/sourcing/analytics`, and both detail pages.

### `/analytics/projects` — "Project health", rebuilt
Was the last surface at the pre-redesign bar (generic shadcn cards, raw `text-amber-600`, an
`h-24 animate-pulse`, an error state that was one line of muted text, and the **wrong reply-rate
denominator**).
- [x] **KPI rail** via the shared `MetricRail` (count-up tickers + skeleton): Projects · Engagements ·
      Companies · Reply rate (with `28/107 contacted` under it) · Overdue.
- [x] **Book composition** (new `components/analytics/book-composition.tsx`) — a recharts horizontal
      stacked bar per project with a **legend and hover tooltips**: replied / contacted-no-reply /
      never-emailed. Coverage reads before any rate; colours are the app's status hues, not a chart
      palette.
- [x] Project cards restyled to the family language (deal-type tags, MONO numerals, `hover-lift`),
      every rate now `replied ÷ contacted` **with its denominator** and recessed below `MIN_N`.
      Overdue pills drill to `/schedule?deal=`, engagement rows to `/projects/N?book=`.
- [x] Analyst table gained real loading / empty (CTA) / error (retry) states and thin-sample recession.
- [x] 403 for a non-partner now renders a proper explanation, not "Failed to load".

### Backend — one additive fix (the last wrong denominator in the app)
- [x] `services/analytics.py` — project + engagement stats now also return `contacted`
      (total − never-contacted) and `replied` (RESPONDED + INTERESTED + DECLINED), matching
      `lib/analytics.ts replyRate`. `response_rate` is untouched for compatibility. Previously this
      surface divided **responded ÷ every company**, so a book full of not-yet-emailed companies read
      as a bad reply rate.

### `/sourcing/analytics` (the orphan) — states + honesty
- [x] Real loading skeletons, `PanelError` + retry, and empty states with a CTA per panel (it
      previously rendered silently blank cards). All-zero funnel stages now say so instead of drawing
      five empty tracks.
- [x] Low-n recession applied to reply-rate-by-stage and the AI-fit comparison — a 1/1 bucket no
      longer reads as "100%" at full strength.

### Verification
- [x] `tsc --noEmit` clean · `next build` clean — **20 routes**, unchanged · eslint clean on every
      touched file
- [x] Vitest **125/125** ✅ (113 prior + 12 new in `tests/analytics-states.test.ts`: reply-rate
      denominator, `bookComposition` clamping/summing, low-n partitioning, and four `useDelayed`
      cases incl. "re-arms for the next load")
- [x] Backend **270/270** pass (`pytest`) after the analytics change
- [x] Playwright: `outreach-timeline` + `command-palette` specs **6/6** pass after wrapping the shell
      in `ConfirmProvider` (no regression from the new provider)
- [x] Live proof on a seeded local stack (partner), zero page errors, no horizontal overflow:
      Project health in dark + light (KPI tickers, composition chart with legend, `24% · 6/25 replied`
      denominators), Sourcing analytics empty states, and the **full destructive loop end-to-end** —
      confirm dialog → archive (server: `archived: [GreenGrow Ventures]`) → undo toast → Undo →
      (server: `archived: []`). Screenshots captured.
- [x] The seeded DB was left clean — anything archived during the proof runs was restored.

---

## Track L — L5: Landing hardening (docs/ui-upgrade-study.md §8) ✅ complete — **Track L ships**

**Goal:** the last L phase — motion discipline (one signature per section), responsive 390–1440,
a11y, perf, and a full screenshot proof pass in both themes.

**Approach: measure first, then fix.** Nothing here was judged by eye alone. A harness drove the
production build (`next start`) through **both themes × 1440/1024/768/390**, running axe-core, a
horizontal-overflow sweep, a `document.getAnimations()` inventory (with in-viewport flags), a
tab-by-tab focus walk, and a `reducedMotion: "reduce"` pass. Every claim below is a number that
harness produced before and after.

### What the audit found (baseline, both themes)
- **axe: 3 violation types.** `color-contrast` ×18, `definition-list` ×1, `link-in-text-block` ×1.
  The worst node was the **primary CTA** — near-white on amber at **2.44:1** (dark) / **3.16:1**
  (light). The most important element on the page was the least readable.
- **Focus was invisible.** 24 of 32 tab stops rendered `outline: auto 1px` in amber at **25% alpha**
  on both canvases; there was also **no skip link** (first stop was the logo, six nav links deep).
- **Motion over budget.** The hero ran **three** concurrent infinite loops (ambient drift + two
  pulse dots) plus a one-shot sheen; and **all nine** looping animations were still compositing
  measured *at the page bottom*, off-screen.
- **Reduced motion had two holes.** The Reach hub used SVG `<animate>` (SMIL ignores the media query
  entirely), and the blanket `animation-duration: 0.01ms !important` turns an *infinite* loop into a
  per-frame busy loop rather than stopping it.
- **352 KB of `dotted-map`** world geometry was shipped to the browser to redraw one static
  decorative dot grid.
- **Nav broke at exactly 768 px** — the wordmark collided with "Product" (0 px gap).
- No horizontal overflow at any width, in either theme — that part was already clean.

### A11y
- [x] **`--primary-foreground` is now dark warm ink** (`oklch(0.22 0.03 60)`) instead of near-white.
      Amber is a *light* colour; the fill stays bright and the label goes to **6.71:1** (dark) /
      **5.36:1** (light). Affects the three amber CTAs (nav, hero, closing) and the skip link.
- [x] **One focus ring for the site** — `:focus-visible { outline: 2px solid var(--primary);
      outline-offset: 2px }` in the base layer, and the two bespoke `focus-visible:ring-*`
      treatments (CTAs, theme toggle) removed so there is a single focus language.
      **33/33 tab stops** now measure a solid, opaque 2 px amber ring in both themes.
- [x] **Skip link** (`Skip to content` → `<main id="content" tabIndex={-1}>`), verified as the first
      tab stop and verified to actually move the hash.
- [x] **Contrast debt paid by deleting the alpha dilution**, not by tweaking it: 14 runs of
      `text-muted-foreground/{45,50,60,70,80}` are now the real token. The logo-cloud firm names went
      **1.77 → 4.83:1** (dark) / **2.09 → 7.20:1** (light). Quietness now comes from size, tracking
      and case — never from ink nobody can read.
- [x] **Features tabs are a real tablist** — `role="tablist"/"tab"/"tabpanel"`, `aria-selected`,
      `aria-controls`, roving `tabIndex`, and ←/→ arrow keys that move focus and wrap.
- [x] **FAQ**: `aria-controls`/`aria-labelledby` wiring, and collapsed answers are `invisible` rather
      than merely clipped — a `grid-rows-[0fr]` + `overflow-hidden` panel stays in the accessibility
      tree, so a screen reader was reading **all six** answers regardless of what was open. Now 1 of 6.
- [x] **The security card is reachable without a pointer.** "Hover to decrypt" was a dead end for
      keyboard and touch; it is now a `<button>` with `aria-pressed` that previews on focus and pins
      on Enter/tap ("hover or tap to decrypt" → "tap to re-encrypt").
- [x] **Stats `<dl>` is valid** — `dt` then `dd` in DOM order with CSS `order` holding the visual
      numeral-first layout, and the context line is a second `dd` instead of a stray `<p>`.
      A screen reader now hears "Companies · 136 · targets, buyers and investors".
- [x] **FAQ inline link is underlined at rest** — amber against muted body copy is a 1.65:1
      difference, so colour alone never marked it as a link.
- [x] **Escape closes the mobile drawer** (it was a one-way door).

### Motion discipline — one signature per section
- [x] **Hero: three loops → one.** The ambient glow is now static (its 14 s drift put a second
      rhythm above the fold against the desk's 2.4 s pulse, and kept a blurred 42 rem layer
      compositing forever), and the overdue row dot is a static flag with a ring instead of a second
      heartbeat. What remains: the one-shot entrance sheen + **one** live pulse.
- [x] **Loops stop when nobody is looking.** New `components/motion-section.tsx` — a `<section>` that
      flips `data-motion` on an IntersectionObserver (both ways, unlike reveal-once `<Reveal>`), with
      one CSS rule pausing `.mkt-live`, `.mkt-beam-pulse`, `.mkt-marquee`, `.mkt-hub-pulse` and the
      CTA sheen inside an off-screen section. Hero, Features, Reach, Testimonials and the closing CTA
      opted in. Measured at the page bottom: **every off-screen loop paused**, only the in-view one runs.
- [x] **The Reach hub pulse is CSS** (`.mkt-hub-pulse`), not SVG `<animate>`.
- [x] **Reduced motion actually stops** — explicit `animation: none` for the looping decoratives, so
      an infinite animation is switched off rather than restarted every frame at 0.01 ms.
      Verified: **0 running animations, 0 SMIL nodes, 0 stuck-hidden reveals**, both themes.
- [x] Final inventory — hero: sheen + live pulse · problem: hover lift · logo cloud: none · stats:
      count-up · features: three beam packets · how-it-works: rail draw · security: decrypt mask ·
      reach: arc draw + hub · testimonials: marquee · FAQ: accordion · closing CTA: shimmer.

### Perf
- [x] **`dotted-map` is off the client entirely.** `Reach` was a client component only to `useMemo`
      the map, so it is now a server component that builds the SVG once at module scope — i.e. at
      build time for this statically prerendered route. Client chunks **1.2 MB → 792 KB on disk
      (−34%)**; `getSVG` no longer appears in any chunk.
- [x] **The below-fold product shot no longer competes with the hero** — `priority` was emitting a
      high-priority `<link rel=preload>` five sections early; the aspect box already reserves the
      space, so there is nothing to shift (measured **CLS 0**).
- [x] **The security card stopped thrashing React.** It rebuilt a 1,400-character random string and
      re-rendered on *every* mousemove; the pointer now writes CSS custom properties straight to the
      node inside a rAF, and the ciphertext churns on its own 110 ms interval only while visible.
- [x] Font faces trimmed to the weights actually rendered (Cormorant 700 and Outfit 300/600/700 were
      declared but unused — 3 woff2 files are fetched, matching the 3 preloads).
- [x] Deleted the unused `public/product/dashboard.png` (181 KB, referenced nowhere).

### Responsive
- [x] **The desktop nav moves to `lg:` (1024).** It switched on at `md:` (768) where there was no
      room, so the wordmark and "Product" touched. 768 and 1023 now use the drawer; 1024 has 139 px
      of clearance. Verified at all four widths.

### Verification
- [x] `tsc --noEmit` clean · `next build` clean (static prerender, 2 routes)
- [x] **axe-core: 0 violations** at 1440/1024/768/390 in **both** themes (from 3 types / 20 nodes)
- [x] **No horizontal overflow** at any of the four widths, either theme (`scrollWidth == clientWidth`)
- [x] **33/33 focus rings** solid + opaque, both themes · skip link first · tablist arrow keys ·
      FAQ 1-of-6 exposed · decrypt card opens on focus and pins on Enter · drawer opens and closes
      on Escape — all asserted in a scripted behaviour pass, not eyeballed
- [x] **Reduced motion:** 0 running loops, 0 SMIL, 0 hidden reveals; full-page capture in both themes
      shows every section rendered, with the mechanism beams reading as static amber traces
- [x] Screenshot proof — 8 full-page + 8 above-the-fold captures (2 themes × 4 widths), plus
      per-section captures of everything whose contrast changed, and 2 reduced-motion full pages.
      Looked at, not just collected: the dark-ink CTA reads as a signal rather than a washed-out
      label, and the logo cloud is still the quietest band on the page while being legible.
- [x] **CLS 0** · DOM-content-loaded ~180 ms local · 3 font requests
- [x] Zero console/page errors from this work. The one pre-existing 404 remains:
      `GET /login?_rsc=…` — Next prefetches `/login`, which lives in the product app (`frontend/`),
      not in `marketing/`.

### Flagged, deliberately out of scope
- The **product app has the same white-on-amber CTA contrast** (`--primary-foreground` is near-white
  on `--primary` in `frontend/app/globals.css`). L5 is landing hardening, so only `marketing/` was
  changed; the token flip is a one-line Track-P follow-up and should be reviewed against the app's
  own buttons rather than assumed.

---

## Track P — P5: Board + product hardening (docs/ui-upgrade-study.md §8) ✅ complete — **Track P ships**

**Goal:** the last P phase — a Kanban board view for the pipeline, plus the final a11y /
perf / screenshot pass, and the Playwright rot P3 explicitly flagged for this phase.

**Scope decision (user, this session):** the board lives on the **Master List as a third view**
("My book · Pipeline board · Firm database"), not in the deal room or on the schedule. The
sourcing funnel at `/sourcing` is *already* a full Kanban (drag, optimistic moves, per-card menu),
so this board covers the thing that had no board: the **outreach pipeline** — where every company
in your book actually stands.

### The board's premise: a column is not a writable field
`NOT_CONTACTED / CONTACTED / RESPONDED / BOUNCED` are **derived from the append-only event log**
(`recompute_status` on the server is their only writer); `INTERESTED / DECLINED` are deliberate
manual overrides. So a drop can't mean "set status". It means one of three things, and the rules
are a pure, unit-tested module rather than a trusted convention:

- [x] `lib/pipeline-board.ts` (new, pure) — `PIPELINE_COLUMNS`, `planMove`, `legalTargets`,
      `buildBoard`, `applyStatusMove`. `planMove` returns a discriminated union:
  - **`event`** → dropping into *In cadence* / *Replied* / *Bounced* opens the log-outreach dialog
    prefilled (`INITIAL_EMAIL` / `RESPONSE` / `BOUNCE`) with the consequence stated. The drag only
    *proposes* the touch; the dialog commits it with a date, a contact and attribution. Nothing is
    appended behind your back (rule 1).
  - **`status`** → *Interested* and *Declined* are hand flags, so they are a real PATCH: optimistic,
    with an undo toast; *Declined* confirms first because it stops the cadence (rule 4).
  - **`refused`** → with the reason, because some moves are nonsense: nothing un-sends an email
    (*Not contacted* is never offered to anyone), a logged reply or bounce beats a hand-written
    status ("restart the cadence from the dossier"), and nobody can reply to an email that was
    never sent (rule 3 — the clock never starts backwards).
- [x] `tests/pipeline-board.test.ts` (new) — **25 tests** stating exactly those guarantees.
- [x] `components/features/pipeline-board.tsx` (new) — six columns with counts and a one-line
      "what this column means"; cards carrying project, the register's cadence language
      (`intro pending` / `68d late` / `due today` / `stopped`) and the primary contact.
  - **Drag is never the only way through.** Every card has a *Move to* menu listing all six
    destinations with the illegal ones disabled **and their reason printed underneath** — so the
    board is fully keyboard-operable, and it teaches the domain instead of just refusing.
  - While dragging, columns the card can't reach dim to 45%: a refusal is visible *before* the drop.
  - Edge auto-scroll (six columns don't fit), optimistic drops via the tested `applyStatusMove`,
    and an `aria-live` region narrating each move — a card that jumps columns leaves no focus behind.
- [x] `app/(app)/master/page.tsx` — the third view, its own `?view=board&q=…&scope=…` URL state
      (P2's `useTableUrlState`), the register's loading/error/empty vocabulary, and a "Working the
      queue? → Schedule" hand-off. Reuses `useMyBook` — **no new endpoint**.
- [x] `components/features/log-outreach-dialog.tsx` — one additive `note?` prop, so whatever opens
      the dialog can state the consequence under the title.

### Three pre-existing bugs the build surfaced
- [x] **The sourcing funnel's move menu never opened.** A bare Base UI `DropdownMenuLabel` throws
      `MenuGroupContext is missing`, which kills the whole menu render — and that menu is the
      funnel's *only* keyboard path for moving a card. Fixed by wrapping in `DropdownMenuGroup`
      (the pattern `topbar.tsx` already used) in `sourcing-kanban.tsx`, and in
      `compose-email-sheet.tsx`, where the same bug broke the template menu in exactly its
      no-templates-yet state. Found because the new board hit it too.
- [x] **`useTableUrlState` updated the Router during render.** It called `history.replaceState`
      *inside* a `setState` updater; React runs updaters in the render phase, so Next's Router set
      state mid-render ("Cannot update a component while rendering a different component"). The
      history write moved into the event, with a ref so successive patches still compose. This
      fired on every P2 list (Master List, Contacts, Schedule), not just the board.
- [x] **`opacity` used as a recession device fails contrast.** Thin-sample figures at `opacity-55`
      measured **2.33:1** — the least trustworthy number was the hardest to read. Recession is now
      by colour, in all three places that did it.

### Playwright: the rot P3 flagged for P5 → 23/23 green
Baseline was **8 failing / 8 passing**. Each failure was stale selectors for UI that shipped
deliberately, plus one genuine flake:
- [x] `smoke.spec.ts` — rewritten: `/` no longer renders a public page (the landing moved to
      `marketing/`), so an unauthenticated visit bounces to `/login`; the lockup reads "Upstream",
      not "Project Upstream". The authenticated `/` → `/dashboard` case moved into `login.spec.ts`.
- [x] `grid.spec.ts` — rewritten for the merged deal room: no "Grid view" hop (the grid is inline at
      `/projects/[id]`, with the old route kept as a redirect), and the inline add now opens the
      shared add-company dialog. Second test drives the row's **Send intro** button.
- [x] `cadence.spec.ts` — the mandate picker is an *Engagement* select, submit reads **Add**, adding
      no longer navigates (find the row, open the dossier), the desk is a capped work queue so the
      row is found by search, and with a 10-day-backdated initial email against a 7-day cadence the
      company is **already overdue** — the old assertion looked for "due in Nd".
- [x] `mandates.spec.ts` **deleted** (it drove the removed `/mandates` route) → new
      `projects.spec.ts`: create → on the deal floor → archive → **undo**, which is the soft-delete
      vocabulary P4 established. Scoped to project links, because the undo toast also carries the name.
- [x] `command-palette.spec.ts` — the flake: `login()` resolves the moment the URL is `/dashboard`,
      which can be *before* the shell attaches its ⌘K listener. A real user just presses again, so
      `openPalette()` retries.
- [x] `tests/e2e/pipeline-board.spec.ts` (new) — **6 specs**: six columns render; *Not contacted* is
      never offered; a replied company can't be dragged back into cadence *and says why*; moving to
      Replied opens the append-only log prefilled instead of writing a status; a hand flag is
      optimistic and undoable (and puts the seed back); filters survive a reload in the URL.
- [x] `playwright.config.ts` — **serial by design** (`fullyParallel: false, workers: 1`). These specs
      drive one seeded database and mutate it, so parallel workers race each other's data and pile
      four concurrent bcrypt logins onto the dev backend. Fully parallel, ~half the suite flakes;
      serial, `npm run test:e2e` is green as-is.

### A11y: 814 violations → 0, measured across 28 route/theme combinations
A harness drove the production build through **14 routes × dark/light** with axe-core, an overflow
sweep, a focus walk and a reduced-motion pass (the same method as L5).

- **Baseline:** `color-contrast` **814 nodes** on 28 combos · `aria-required-children` (**critical**)
  · `nested-interactive` · `link-in-text-block`.
- [x] **Dark `--muted-foreground` 0.52 → 0.61.** It measured **3.76:1** on `--background`, 3.68 on
      `--card`, 3.65 on `--muted` — *every* muted line in the dark theme failed, which is most of
      the app's secondary text. 0.61 clears 4.5 on all three surfaces.
- [x] **`--primary-foreground` → dark warm ink** `oklch(0.22 0.03 60)`. Near-white on amber measured
      **2.45:1** (dark) / **3.16:1** (light): the primary button was the worst contrast in the
      product, exactly as it was on the landing. The fill stays bright; the label reads 6.7/5.4:1.
      *(This closes the item L5 flagged for Track P.)*
- [x] **New `--primary-ink` and `--destructive-ink`** — amber and red as *text*, while fills keep the
      brighter accent. Applied by sweeping **128** `text-primary` and **51** `text-destructive` uses;
      `bg-*`/`border-*` untouched. In dark, ink == accent, so nothing changes there.
- [x] **Alpha-diluted muted text deleted**, not tweaked: 71 uses of
      `text-muted-foreground/{50,60,70,80}` are now the real token (the worst read 1.98:1).
- [x] Deal-type chips (`text-emerald-700/90`, `text-sky-700/90` — in a `.ts` file the first sweep
      missed), the dashboard's backlog **heat ramp** (its 0.55 floor made the *youngest* overdue rows
      the hardest to read — floor is now 0.85), and the analytics inline link (now underlined at rest).
- [x] **`aria-required-children` (critical)** — the Contacts people list was `role="list"` wrapping
      section groups of selectable `<button>` rows. It's a group of controls, not a list: `role="group"`.
- [x] **`nested-interactive`** — the Companies status spectrum declared `role="img"` while holding a
      filter button per segment. It's a control group: `role="group" aria-label="Filter companies by status"`.
- [x] **Result: 0 axe violations on all 28 route/theme combos**, and `/master?view=board` is clean in
      both themes.

### Responsive · perf · motion
- [x] **No horizontal overflow** on any of the 14 routes at **1440 or 390**, either theme
      (`scrollWidth == clientWidth` everywhere).
- [x] **Focus:** 60 tab stops walked across the board and the outreach desk — every one has a
      visible ring.
- [x] **Reduced motion:** 0 looping animations and 0 SMIL nodes on dashboard, schedule and board.
- [x] **Board perf:** 154 cards render with **0 long tasks**, **CLS 0**, DOM-content-loaded ~42 ms
      local, and 3,165 DOM nodes — *lighter* than the register view it complements (4,137).

### Verification
- [x] `tsc --noEmit` clean · `next build` clean (**20 routes**, unchanged) · eslint clean on touched files
- [x] Vitest **150/150** ✅ (125 prior + 25 new in `tests/pipeline-board.test.ts`)
- [x] Playwright **23/23** ✅ with the default `npm run test:e2e` (was 8 failing / 8 passing)
- [x] Backend **270/270** ✅ (`pytest`) — P5 changed no backend code
- [x] **Zero console/page errors** on every route in both themes
- [x] Screenshot proof — 28 route/theme captures reviewed plus board-specific shots (dark, light,
      390, the move menu, the event hand-off, and the undo toast). The dark-ink amber button reads as
      a signal rather than a washed-out label, and the lifted muted tone made the app's secondary
      text legible without flattening the hierarchy.
- [x] The seeded DB was re-seeded afterwards, so the E2E fixtures it created are gone.

### Flagged, not fixed
- The board **guards illegal moves client-side**; the API itself will accept a `RESPONSE` event on a
  company with no initial email. Server-side event-order validation is a backend change with its own
  test surface, so it is out of a frontend hardening phase — worth a small backend slice.
- Archived contact rows still dim with `opacity-55`. axe doesn't see them (they only appear behind
  "show archived") and the meaning of the dimming is different from thin-sample recession, so it
  wants a deliberate design decision rather than a blind sweep.

---

## Track WB — WB-1: Workbook import — the client's real Excel becomes the app ✅ complete

**Goal:** the app is populated from the client's three actual workbooks
(`phase_2/Investors outreach.xlsx`, `PE related buyers.xlsx`, `Contact list.xlsx`), not from
Faker. This is the real onboarding path; `seed.py` stays as the dev/test fixture.

**The gap this closes.** `services/imports.py` (SL-2) already ingests a CSV — but only into
`company_profiles`, i.e. the sourcing *pool*. The client's workbooks carry a whole engagement's
history, so one row has to resolve to a profile **and** a per-mandate `companies` row, its inline
contacts, its cadence, and a backdated chain of `outreach_events`. The CSV importer is untouched
and still serves long-list enrichment.

### Why the existing tables, widened — not a parallel set
`import_batches` / `import_rows` already are the audit + idempotency envelope, and the CSV wizard's
error-review UX is built on them. A second table set would have meant a second reviewer UI for the
same job. So WB-1 **widens** them (`b2e4f6a8c0d1`, additive + reversible):
- `import_batches.project_id` — the project every sheet lands under · `.summary` — the applied
  per-entity outcome, so the summary step renders from the persisted batch.
- `import_rows.sheet_name` (a workbook batch spans tabs) + `resolved_company_id` /
  `resolved_contact_id` / `resolved_schedule_id` beside the existing `resolved_profile_id` —
  one workbook row resolves to a whole slice of the graph, not just a profile.
- `ImportSource.WORKBOOK` needs no DDL: the enum column is a plain VARCHAR (`native_enum=False`).

### Parsing the real files, not a tidy table (`services/workbook_parse.py`)
Nothing about these sheets is regular, so the parser does exactly three things and no interpretation:
- [x] **Locates the header row** — every sheet has a *header block* above it (`"[Client] target/buyer
      name"`, `"Exchange rate as on date = X"`, a running count). It sits at row **6** in
      `Company list 1`, **5** in `PE names final`, **7** in `PE porfolio names final`, **5** in
      `Contacts list`. Row 1 is never it.
- [x] **Classifies each tab** — MASTER / SCHEDULE / CONTACTS / LONGLIST / IGNORE, from which column
      dictionary its header row matches. The nav dividers (`Master sheets and emailers >>>`) and
      pivots (`PE summary analysis`) fall out as IGNORE; `PE names` and `Remaining PE companies` are
      recognised as research long-lists and are **opt-in only**, never swept into a master list.
- [x] **Maps cells** using §2.2 / §2.3 / §2.4 verbatim, with the repeated `Bi-weekly follow up` ×4 and
      the trailing `Done`/days block read *positionally* (they share one header).
- [x] `Exchange rate as on date | 90.26` no longer eats the running count — the rate's value cell is
      skipped when scanning for the count (that bug read `declared_count` as 90 instead of 60).

### What the importer refuses to do (`services/workbook_import.py`)
- **Never invents an anchor.** A row whose *Initial email* cell is a text token ("Priya Mam reach
  out", "Contact not found" — 5 of GAIL's 70) logs **no events at all**; its schedule stays
  AWAITING_INITIAL. Rule 3: the clock never ticks before the first email is sent.
- **Never fakes precision.** A text-token Status ("Got response") has no date in Excel. The terminal
  event is dated to the last known follow-up, else the anchor, and flagged `APPROXIMATE_DATE` (18
  rows on the GAIL sheet) so an analyst can correct it.
- **Never guesses a meaning it doesn't have.** "Vishnu reached out" is neither a response nor a
  bounce, so it becomes a **NOTE** carrying the verbatim token, the cadence is left where the
  evidence put it, and the row is flagged `UNCLASSIFIED_STATUS`.
- **Never mutates history.** Events are appended; `initial_date` is written once, by
  `activate_schedule`. A corrected re-upload with a different first-email date does not move it and
  does not append a second INITIAL_EMAIL.

### Rebuilding the real cadence
Follow-ups come from the scheduler's own **`Done` cells** — not from the four computed dates, which
are all present up front whether or not anything was sent. Trunorth (initial 12 Jan, four Done)
lands as INITIAL_EMAIL + 4 FOLLOW_UPs on the sheet's exact dates and stops EXHAUSTED = cold, which
is §2.3's "4 follow-ups then cold". Sharrp Ventures (`Done | Done | 10 | 24`) lands 2 follow-ups,
stays ACTIVE, and `compute_cadence` puts next-due at 29 June — the sheet's own third bi-weekly date.
Imported schedules use the Excel interval of **14 days**.

### Project + engagement are a wizard step, not an inference
One workbook = one client, and tab names don't encode the deal. So the partner picks/creates the
**project**, then maps each tab to a **mandate**. One `Emailing schedule` can serve several master
sheets (the PE workbook's does), so the suggested plan resolves each sheet's slice by **company-name
overlap**, landing `PE names final → Regarding "PE"` and `PE porfolio names final → "Portfolio"`.
For the Contact List, its `Reason` column *is* the client, so each distinct Reason maps to an
engagement; unmapped Reasons **skip**, never guess.

### Classification (§7.2 / §7.3)
`PE → Private Equity`, `FO → Family Office`, `PMS`, `PE/PC → Private Credit`, `VC`, `Strategic`,
`Investment bank` all land via an explicit alias table (fuzzy string metrics score "PE" against
"Private Equity" terribly), with rapidfuzz only for lightly-renamed labels. `PE/VC` has no
vocabulary entry of its own → nearest match + `CATEGORY_APPROXIMATE`. Anything unknown ("PE
potfolio") → **Other + `CATEGORY_UNMAPPED`**, never silently dropped. `Bucket` becomes the
engagement's sourcing layers in first-seen order — including GAIL's two rows where a stray `Yes`
leaked into that column, imported faithfully and flagged `BUCKET_SUSPICIOUS` for the analyst.

### Idempotency
profile → domain then name (`upsert_profile`) · company → (mandate, profile) then (mandate,
name_key) · contact → (company, email) then (company, person) · layer → (mandate, lower(name)) ·
event → **(schedule, type, occurred_on, contact)**. The contact is in the event key on purpose: the
Contact List has ten companies where two different people replied, and on the same day those two
real touches would otherwise collapse into one.

### Backend surface
- [x] `services/workbook_parse.py`, `services/workbook_import.py` (new) · `openpyxl>=3.1` added
      (no `.xlsx` reader existed — the CSV importer is text-only)
- [x] `api/workbook_imports.py` (new) — `/imports/workbook/{inspect,preview,apply,targets,flags,{id}}`,
      **partner-only**. Mounted before `imports_router` so `/imports/workbook/*` isn't swallowed by
      `/imports/{batch_id}`. The file is uploaded once at *inspect* and every later step replays the
      staged rows, so the browser never re-uploads — and can't swap the file underneath the preview.

### Verification — against the real files, not fixtures
- [x] **`tests/test_workbook_import.py` — 28 tests** loading all three actual workbooks: header-row
      and tab classification, the named-row cross-check (**Mandala Capital**, read by hand off row 7:
      HQ, rationale, relevant investments, Direct layer, Aditya Mody as primary contact,
      INITIAL_EMAIL + RESPONSE both on 18 May), Trunorth's four-follow-up cadence math, Sharrp's
      partial chain and next-due, the anchor-less row logging nothing, dry-run purity (all 8 tables
      byte-identical after a preview), preview counts equalling what apply writes, re-apply as a
      true no-op (130 → 0 created / 130 updated / 0 events), the immutable anchor under a corrected
      file, one shared profile across two projects (200 company rows → 188 profiles), the Contact
      List's context landing on the **event** with the contact row as the latest-touch cache, POC →
      firm user, and firm-scoping.
- [x] **`tests/test_workbook_import_api.py` — 8 tests** for the wizard over HTTP incl. the
      partner-only gate and the applied-batch no-op.
- [x] **`alembic upgrade → downgrade → upgrade`** green, asserted at the *column* level
      (`test_wb1_upgrade_downgrade_upgrade`) since WB-1 widens tables rather than adding them.
- [x] **Backend 307/307 ✅** (`pytest`) — 270 prior + 37 new (28 + 8 + 1).
- [x] Frontend: `tsc --noEmit` clean · eslint clean on touched files · Vitest **7 new**
      (`tests/workbook-import-plan.test.ts`) · **Playwright 2/2 ✅** driving the real GAIL workbook
      through upload → map → preview → apply → deal room.
- [x] **Confirmed in the running app**, not just in tests: 70 companies, 66 contacts, 143 events,
      4 sourcing layers; Mandala Capital STOPPED/RESPONDED on 18 May; Sharrp ACTIVE with 2
      follow-ups at a 14-day interval; Anicut Capital AWAITING_INITIAL with 0 events.

### Frontend
- [x] `app/(app)/import/page.tsx` (new, partner-only) — upload → project & engagements → review →
      apply, modelled on the CSV wizard's step shape. The review step states counts per entity,
      per-sheet engagement and cadence-match, and a flag roll-up with an expandable list of exactly
      the rows the importer had to make a call on. Analysts get an explanation, not a disabled form.
- [x] `hooks/use-workbook-import.ts` (new) — kept separate from `use-imports.ts` because the two
      wizards write different things.
- [x] `app/(app)/projects/page.tsx` — **"Import from Excel"** on the empty state (partner only); this
      is effectively firm onboarding, so it belongs where a partner first finds nothing.

### Flagged, not fixed
- **`Holding company` (+ website), `Previous contact` and `Cheque size` have no field in the data
  model.** They are parsed, preserved verbatim on `import_rows.raw`, and reported per sheet as
  unmapped columns in the preview — explicitly *not* stuffed into `rationale` or the dead `bucket`
  column. `Previous contact = Yes` additionally raises a `PREVIOUSLY_CONTACTED` warm flag. Giving
  the portfolio→owner cross-link a real home is §2.2's own "❌ missing (secondary)" and wants its
  own slice.
- **Pre-existing SQLite migration defect (`c1d2e3f4a5b6`, Phase 8 Slice 1).** The initial schema's
  *inline* `UNIQUE (company_id)` on `outreach_schedules` survives that migration's constraint swap
  on SQLite, so a migrated SQLite DB carries both it and `uq_outreach_schedules_company_cycle` — and
  `seed.py --reset` fails on the restarted-company fixture (`UNIQUE constraint failed`). PostgreSQL
  names the constraint, so the drop works there, and the pytest suite builds from
  `Base.metadata.create_all`, which is why nothing caught it. Unrelated to WB-1; needs its own
  corrective migration.
- **Pre-existing frontend test failure:** `tests/candidate-card.test.ts` expects `scoreTone(65)` to
  contain `"lime"` but it now returns an emerald token. Fails on a clean checkout; untouched here.

---

## Track WB — WB-2: Empty canvas → real data, end to end, every feature ✅ complete

**Goal:** stop testing against Faker. Walk the whole product from a genuinely empty firm,
seed the sourcing database with real companies, bring the client's three workbooks in
through the wizard, and then exercise **every** feature against that data.

### The empty canvas is now a real starting point
- [x] `app/seed/bootstrap.py` (new) — the opposite of `seed.py`: a firm, its category
      vocabulary, its funnel stages and its users, and *nothing else*. This is what a real
      firm starts with, and it is the precondition for judging an empty state honestly.
- [x] `tests/e2e/audit.spec.ts` (new) — a diagnostic harness that walks all 16 routes as
      **both roles**, recording console errors, failed requests, the heading, the visible
      empty-state wording and a screenshot per route into `tests/e2e/.audit/<label>/`.
      Fails only on real breakage; the report is the point.

**Empty-canvas result: 29 route visits · 0 console errors · 0 failed requests.** Every
page already had a real, specific empty state ("Desk clear. No outreach due in the next
7 days.", "The rolodex is empty", "You're clear. Nothing's slipped and nothing's due.").

### The gap that audit found: the company database was unreachable
`/sourcing` refused to open without an engagement — `usePool` was hard-gated on
`mandate_id > 0` and the page returned "No engagements to source for yet". But the pool
**is** the firm's standing company database (`company_profiles`, firm-wide by design);
it is worth searching on day one, before any deal exists. A brand-new firm therefore had
no way to see or search its own inventory.

- [x] `api/sourcing.py` — `mandate_id` on `/sourcing/candidates` is now **optional**.
      Without one the candidate join is skipped entirely and rows come back as plain pool
      inventory; with one, nothing changes. Score-sort degrades to name-sort rather than
      ordering by a column that isn't joined.
- [x] `app/(app)/sourcing/page.tsx` — a **"Company database"** mode: the full query deck,
      search and facets, with the engagement switch replaced by a line that says what a
      deal would add. The deal-only actions (Shortlist, Push, Score matches, the bulk bar,
      row selection) are withheld — `Score matches` stays visible but **disabled with a
      reason**, because a fit score is a score *against a thesis*.
- [x] `hooks/use-candidates.ts` — `mandate_id` optional; `buildPoolQS` omits it.

### A real sourcing database, not Faker
- [x] `app/seed/pool_dataset.py` (new) — **164 real companies** in the firm's actual deal
      space, name/HQ/website taken from public sources (cited in the module docstring:
      Wikipedia's IT-consulting and private-equity lists, CRN MSP 500 2026 press coverage,
      company profile pages). Two segments matching the two sides of the deal flow: IT
      services / product engineering / managed services & security, and PE / growth / VC
      (global, Asia-Pacific and India).
      **Only verified fields are recorded.** `website` is filled in only where the official
      domain is unambiguous — it is the primary dedup key, so a guessed domain is worse
      than none. Headcount and revenue are left to the client's own researched figures.
- [x] `app/seed/sourcing_pool.py` (new) — loads that dataset **plus** the client
      workbooks' research long-lists (`PE names`, `Remaining PE companies` — the tabs the
      importer deliberately leaves alone because they are staging, which is exactly what
      the pool is for) **plus** every master-sheet company. All through `upsert_profile`,
      so it is additive and idempotent: **338 profiles, and a second run adds 0.**

### Bringing the client's book in
All three workbooks went in through the real `/imports/workbook` wizard:

| Workbook | Companies | Contacts | Events | Layers |
|---|---|---|---|---|
| Investors outreach (GAIL) | 70 | 66 | 143 | 4 |
| PE related buyers (22by7 — 2 master sheets, 1 shared scheduler) | 130 | 134 | 496 | 9 |
| Contact list (firm-wide, Reason → engagement) | 59 new / 45 matched | 70 new / 34 enriched | 98 | — |

Landed: **2 projects · 3 engagements · 259 companies · 381 profiles · 270 contacts ·
737 events · 13 sourcing layers**, with 49 live cadences, 205 stopped and 5 still
Awaiting-initial — those 5 being exactly the GAIL rows whose Initial-email cell is a text
token, visible on the pipeline board under *Not contacted* rather than invented into a
cadence.

### A preview/apply divergence the real data exposed
The Contact List preview predicted **65 company creates / 39 updates**; the apply did
**59 / 45**. Ten companies on that sheet have two people each — apply creates the company
on the first row and updates it on the second, but the preview forgot what it had already
decided and counted two creates. The split is what the partner approves, so it has to
match.
- [x] `_Resolver.would_create_company` — the preview-side counterpart of the apply's
      insert, remembering pending creations within the run (the same shape as the existing
      `would_create_layer`).
- [x] `test_contact_list_preview_split_matches_what_apply_does` — a regression test on the
      real file; the master-sheet parity test never hit this because one sheet has one row
      per company.

### Then every feature, against that data
- [x] `tests/e2e/feature-sweep.spec.ts` (new) — **14 tests** that *use* the app rather
      than just loading it: pool search by name / city / domain; the deal-free database
      view and its withheld actions; shortlisting a pool company onto a deal and finding
      it on the funnel board; all three Master List views; a company dossier's Overview /
      Timeline / Contacts tabs and its cross-mandate duplicate notice; the outreach queue
      and logging a touch; the rolodex and a person's touch context; both imported projects
      and their engagements; analytics computed from the real event log; the settings
      vocabulary the import used; the command palette finding an imported company; and an
      assigned analyst seeing their own book.

**Full Playwright suite: 41/41 green** — including the whole pre-existing suite (cadence,
grid, pipeline board, projects, outreach timeline, command palette, login, smoke), which
had only ever run against the Faker seed and now passes against real client data.

### Performance — measured, not asserted
The first audit showed 8–10s page loads, which looked alarming and was not the app:
- **API: 0.22–0.44s** for every major endpoint (`/analytics/overview` 0.27s,
  `/sourcing/candidates` 0.27s, `/my-book` 0.44s, `/schedule/due` 0.26s) against the full
  259-company / 737-event dataset.
- **Warm client navigation: 468–600ms** across dashboard, master, schedule, contacts,
  sourcing and analytics — asserted under 6s in the sweep so the number stays honest.
- The 8–10s figures were Next's **dev-server on-demand compilation** on first visit.

### Fixed on the way
- [x] `/companies` empty state said "Add the first company to **this mandate**" on a page
      that spans every engagement — and said it on a firm with no mandates at all.
- [x] **The workbook importer had no standing home.** `/import` was reachable from exactly
      one place — the `/projects` **empty state** — which disappears the moment the first
      project exists. But onboarding is not a one-off: a firm brings a workbook per client
      and the contact list arrives separately, so every import after the first had no route
      but typing the URL. Added `Import` to the sidebar under **Pipeline** (which also makes
      it findable in the command palette, reading the same nav list) and a persistent
      **Import from Excel** action in the `/projects` header beside *New project*.

### WB-3 — the import is open to analysts, scoped instead of gated

The wizard was partner-only on the reasoning that it "creates projects and engagements and
writes across the whole graph". But `create_project` and `create_mandate` are both
`CurrentUser` — **an analyst can already open a project and an engagement by hand**, so
importing the book they keep in a spreadsheet is the same act performed faster. The gate
was protecting nothing an analyst couldn't do through the UI; what it actually did was
force every analyst's book through a partner.

So the gate is replaced by the app's normal visibility rule — the role now changes *reach*,
not permission:
- [x] All six `/imports/workbook/*` routes: `PartnerDep` → `CurrentUser`.
- [x] `/targets` is **scoped** — an analyst is offered their assigned engagements and the
      projects holding them (plus projects they created, still empty), not a firm-wide
      picker whose entries apply would then refuse. Mirrors `projects._visible_project_ids`.
- [x] `_assert_plan_writable` on **preview and apply** — the target list is scoped but the
      plan is posted back as JSON, so an analyst naming a colleague's `mandate_id`
      directly is refused 403. Partners short-circuit. Newly created projects/engagements
      are unconstrained, matching what the hand-built path already allows.
- [x] **`resolve_mandate` now writes a `MandateAssignment` for the actor** — the real bug
      under the gate. Visibility runs off `mandate_assignments`, not `lead_owner_id`, so
      without it an analyst would import a whole book and then not be able to see it.
      `create_mandate` has always auto-assigned its creator; an import is the same act.
- [x] **Batch ownership** — a staged batch holds the verbatim rows of someone's client
      workbook, and `_get_batch` was firm-scoped only. Now a non-partner reaches only
      batches they uploaded, on read *and* on preview/apply, so an analyst can neither
      read a partner's staged book nor apply it on their behalf.
- [x] Frontend: the "Partners run the workbook import" lock screen is gone; nav entry and
      both `/projects` buttons un-gated.

Tests: `test_wizard_is_partner_only` replaced by
`test_analyst_can_run_the_wizard_and_owns_what_they_import` (analyst walks inspect →
preview → apply on the real GAIL workbook, and the created engagement is assigned to them)
`test_analyst_cannot_import_into_a_book_they_are_not_on` (403 at preview *and* apply, with
nothing written on the way to the refusal) and
`test_analyst_cannot_touch_someone_elses_staged_batch` (404 on read, preview and apply).
The Playwright analyst spec now asserts the uploader is reachable from the sidebar rather
than that it is withheld.

**Verification:** backend **310/310 ✅** · ruff + eslint clean on every touched file ·
`tsc --noEmit` clean.

---

## Track WB — WB-4: the whole client book in one run, and what was actually broken

### Three reported "bugs", two of which were a stale process

Reported: analysts can't upload, partners can't either, and old companies are still
everywhere after the reset. Reproduced against the running app rather than the code:

- A backend was still listening on **:8010 running pre-WB-3 code** — analyst `targets`
  and `inspect` returned **403** there (the old partner-only gate). That was the whole of
  "analyst unable to upload".
- That same process was bound to **`upstream_e2e.db`**, not the cleaned `upstream.db` —
  the 332 "old companies".
- The frontend was on **:3010** (a stale `next dev`), pointing at `localhost:8000`, where
  **nothing was listening**. That was "can't upload even for partner".

Nothing in the code was wrong. Confirmed by driving the real UI: with clean processes both
roles reach the map step (`inspect` → **201**), and the `Import` nav entry is present for
an analyst (`["Dashboard","Projects","Import","Sourcing",…]`).

### `scripts/reset_to_pool.py` (new)
Strips a dev DB back to *empty canvas + sourcing pool*: keeps the firm, its users, the 384
`company_profiles`, and the category/stage/source vocabulary; wipes every trace of an
import. This is the state a new client firm starts from — **the pool is the constant, the
workbooks are the variable**. `companies` must be deleted *before* `sourcing_layers`
(a company points at its layer), which the first draft got wrong and SQLite caught.

### The real gap: a client's book is not one file
`/import` took one workbook at a time, so three files meant three separate runs and the
project re-chosen each time. Now:
- [x] The dropzone takes **many** `.xlsx` at once; the queue is walked in order, and files
      matching `/contact/i` are **sorted last** — the contact list has to land after the
      engagements its `Reason` column maps onto, and a file picker's order is arbitrary.
- [x] The project is decided on the **first** file and then **locked** (`locked-project`),
      read from the server's `summary.project_id` rather than from what the form guessed.
- [x] Per-file mapping is kept (each workbook has different tabs, scheduler and flags);
      a `file-progress` strip says which workbook of how many, and the Apply button reads
      *"Apply and continue to the next workbook"* until the last one.
- [x] The done step aggregates across the run ("from 3 workbooks").

### The bug the multi-file run exposed
`useApplyWorkbook` **invalidated nothing**. Within one run that is fatal, not cosmetic:
files 1–2 create the engagements, but the wizard's target list was fetched once at page
load, so file 3's Reason dropdown offered only *"— skip these rows —"*. Every row silently
skipped, `willWrite` fell to 0 and **Apply was disabled with no explanation**. Found by the
E2E timing out on a disabled button, not by reading the code. Apply now invalidates
`workbook-import/targets` plus `projects` / `companies` / `mandates`.

### Verification — an analyst, all three real workbooks, one run
`tests/e2e/workbook-import.spec.ts` gains *"an analyst takes the client's whole book"*:
drops all three `phase_2/` files at once, names the client once, maps each file in turn,
and asserts the project stays locked across them. Result on a pool-only DB:
**272 companies · 283 contacts · 737 outreach events · 3 engagements**, 0 console errors,
all three engagements assigned to the analyst, and `company_profiles` still **384** —
untouched by the import, exactly as intended.

- [x] Playwright `workbook-import.spec.ts` **3/3 ✅** · Vitest **156/157** (the 1 failure is
      the pre-existing `scoreTone` case) · `tsc --noEmit` + eslint clean.

### Flagged, not fixed
- **`/master?view=firm` is not a valid view value** (`my-book` / `firm-wide` / `board`
  are). An unknown value silently falls back to the role default rather than correcting
  the URL, so a wrong link looks like it worked. Cosmetic, but it made two of these specs
  pass for the wrong reason before it was spotted.
- **The dev seed still can't run on a migrated SQLite database** — the pre-existing
  `c1d2e3f4a5b6` constraint defect recorded under WB-1. The E2E database is built from
  `bootstrap.py` (models, not migrations), which sidesteps it; a corrective migration is
  still owed.
- **`tests/candidate-card.test.ts`** still fails on a clean checkout (`scoreTone(65)`
  expects `"lime"`, returns an emerald token). Untouched here.

### Verification
- [x] Backend **308/308 ✅** (`pytest`) — 307 + the new preview-parity regression.
- [x] Playwright **41/41 ✅** against the real client data.
- [x] Vitest **156/157** (the one failure is the pre-existing `scoreTone` case above).
- [x] `tsc --noEmit` clean · ruff clean on every touched file · eslint clean on every
      touched file (two pre-existing unused-import warnings in `sourcing/page.tsx` remain,
      unchanged from `HEAD`).
- [x] Route audit run twice — **empty canvas 29/29 clean, loaded canvas 29/29 clean**, both
      roles, screenshots and JSON reports under `frontend/tests/e2e/.audit/`.

---

## Empty deployment + real Discover database (2026-08-06)

The deployed app was running the Faker demo seed: 118 invented companies with invented
revenue in Discover, 962 rows of fabricated book. Replaced with the state the product
actually claims — every screen empty until the firm imports its own workbooks, and Discover
opening on real research.

### The three tiers (now explicit, see CLAUDE.md)
1. **Configuration** — users, vocabulary, funnel stages, sources. Kept by everything.
2. **The company database** — `app/data/company_pool.py`, 164 real organisations with
   verified name/HQ/domain and, new here, `segment` (Target/Investor) + `sector` (the
   research bucket they came from). Deliberately **no revenue or headcount**: those are the
   client's researched figures and arrive with an import. Planted per firm by
   `services/pool.seed_firm_pool` (async, used by `/auth/signup`) and its sync twin used by
   `app.seed.bootstrap`.
3. **The book** — never seeded. Arrives from `/import`; cleared by `POST /workspace/reset`.

### Shipped
- **Migration `c4f6a8b0d2e3`** — `company_profiles.segment` / `.sector`, both indexed and
  nullable. Profile-level classification is what lets Discover be sliced before any deal
  exists; `companies.type`/`category_id` can only describe a placement.
- **`/workspace`** (GET) and **`/workspace/reset`** (POST, partner-only, firm-name
  confirmed) — the one hard-delete in a soft-delete app, scoped to the imported book, so the
  same workbooks can be re-imported clean. `Settings → Workspace` states the blast radius
  in three tiers before anyone confirms.
- **`/signup` page** — a firm is the workspace, so multi-tenancy needed a front door, not
  new machinery. New firm = the company database + an empty book, invisible to other firms.
- **Discover redesign** — the lens rail became an instrument: total, a stacked segment
  composition bar cross-highlighting with the Side rows, a coverage strip (domain/revenue/
  staff filled %), then Signals / Side / Sector / Category / HQ / Size. Groups and deck
  controls render only where the data can answer them, so a fresh firm sees no dead selects
  and no four zeroed revenue bands. Rows carry the segment token in the fit column while
  unscored (58px that used to hold an em dash), real facts on the meta line (city · sector ·
  domain), and a blanks-included record card when expanded. Active criteria are finally
  rendered as removable chips — the array was computed and never displayed.
- **Deploy fix** — Railway resolves `railway.toml`, and the only copy of
  `preDeployCommand = "alembic upgrade head"` lived in a `railway.json` Railway ignored. So
  a deploy shipped code querying a column no migration had added (500s on `/sourcing/facets`
  until spotted). One config file now; the JSON is deleted.
- **Login/signup forms** now `method="post"`: a submit landing before hydration was doing a
  GET, putting the password in the URL bar and history.
- `app.seed.seed` (Faker) refuses to run against a non-SQLite database — how the demo data
  reached production in the first place.

### Verification
- [x] Backend **318/318 ✅** (`pytest`), including `tests/test_workspace.py` — signup plants
      the database and nothing else, tenants can't see each other's book, reset keeps the
      pool and configuration, partner-only, name-confirmed.
- [x] Playwright **42/42 ✅** against real client data, on the documented onboarding
      (bootstrap → the three phase_2 workbooks as projects "GAIL" and "22by7" → analyst1
      assigned, analyst2 deliberately not).
- [x] Vitest **159/159 ✅** — including the `scoreTone` case that had been red on a clean
      checkout since the score ramp was retuned (it asserted the retired lime/orange hues).
- [x] `tsc --noEmit` clean · eslint clean (the two unused-import warnings in
      `sourcing/page.tsx` are gone too).
- [x] Reset → re-import → reset verified end to end: 2,690 book rows → 0 → 2,690, with the
      381-company database untouched throughout.
- [x] **Live deployment walked**: UI login, all nine routes on the clean canvas, and a real
      `Investors outreach.xlsx` upload parsed to 70 rows — no console or network errors.

---

## Track M — Landing page, second cut: "The register of record" (2026-08-11)

The `marketing/` app's landing page was rewritten end to end. The previous cut (Track L,
"console register") was a good page with three structural holes, and this one is built
around closing them rather than restyling what was there.

### What was actually wrong with the previous cut
- **It never showed the product.** Nine thousand pixels arguing about a dense operational
  tool, with three real screenshots of the running app sitting unused in `public/product/`.
  "I can picture myself using this" was left to the reader's imagination.
- **Its choreography was CSS scroll timelines** (`animation-timeline: view()`), which do
  nothing at all in a browser without them. Half the entrances were a no-op for a large
  share of visitors, and there were two competing animation systems for the same 14px.
- **Uniform density.** Every fold was a heading, a lede and a grid at `py-24 md:py-32`.
  Nowhere to breathe, and no moment that owned the screen.

### The direction
An operations console became **a register of record**: the page is set like a financial
document, because the product is a book of business. Ruled ledger columns instead of the
dot grid; a **serif of record** (Newsreader) for the argument, which also rejoins the
marketing site to the product app, whose own page titles are serif; Geist for what you
operate and Geist Mono for anything the server computed. Obsidian + one amber signal kept
(identity preservation beats any reflex-reject list). Every fold carries a mono stamp in a
left rail, and the header reports which entry you are in.

### Sections (`app/page.tsx`, in order)
`hero` (the promise, over a live queue that runs off the right edge) → `ledger` (the four
failures as a ruled table whose third column, "how you find out", reads straight down) →
a one-sentence turn → `desk` (**new** — the three real screenshots, tabbed, plus the 164
shipped organisations) → `clock` (the cadence calculator, kept and redressed) → `record`
(the moat, on a scroll-filled spine) → `secret` (**new** — a buyer list that redacts itself
as you change *who is looking*) → `faq` → `closing`.

### Motion
`motion` (the current Motion package, `motion/react`) replaced the CSS scroll-timeline
system. `components/motion/primitives.tsx` decides the whole vocabulary once: one arrival
curve, 16px of travel, entrances fire once, springs for input and curves for scroll.
`<MotionConfig reducedMotion="user">` at the root means no component has to remember.
Deliberate uses: the masked line reveal on the two display headings, the hero queue's
count-ups and stagger, `layoutId` indicators on the nav / desk tabs / interval selector,
`AnimatePresence` on the FAQ and the security panel, a scroll-linked spine in `record` that
says the same thing as the words beside it, and exactly one magnetic button, on the last ask.

### Also
- Three unused dependencies dropped (`dotted-map`, `shadcn`, `tw-animate-css`); one added.
- A bespoke share card at `public/og.jpg`, rendered from the page's own tokens, with
  `NEXT_PUBLIC_SITE_URL` wired through the Pages export so the absolute URL is right.
- New token `--destructive-ink`, mirroring `--primary-ink`: red text on a red tint over a
  card composite failed contrast on warm paper.

### Verification
- [x] `tsc --noEmit` clean · `next build` prerenders all three routes static.
- [x] `PAGES_EXPORT=1 npm run build` clean; `basePath` reaches the screenshots and the
      share card.
- [x] **axe-core: 0 violations**, dark and light, at 390 / 768 / 1440.
- [x] No horizontal overflow 320px → 1728px. Zero console errors.
- [x] Reduced motion: nothing left hidden, no surviving infinite loops.
- [x] Focus ring present on every tab stop (the one exception is a sub-stop inside
      Chrome's own `input[type=date]` shadow tree).
- [x] Every interactive control exercised in a real browser: desk tabs, cadence controls
      and the stop-on-reply path, all three security viewers.

---

## Track L · L6 — The landing page rebuilt as "The current" (2026-08-24)

The previous public site (the "register of record": obsidian ground, Newsreader, one amber
signal) is gone, kept only in git history. It was a good page and it was also, by its own
admission, the third-most-common thing an AI reaches for when told "dark, rich, cinematic".
The rebuild starts from the product's own name instead.

**The premise.** Upstream is a river word, in an industry that speaks nothing but river
words and stopped hearing them: deal *flow*, the *pipeline*, the *source*. So the page is
the river, and the one idea it teaches is `you type one word, sent, and everything else is
derived`. That is the honest answer to the objection the research turned up first, which is
not "we have no CRM" but "we bought one and nobody updated it".

Full creative brief, including every line of copy and the measurements below:
[`docs/landing-v2-design-package.md`](docs/landing-v2-design-package.md).

### What changed
- **New everything.** Palette (cool mist over deep water, one warm `--late` accent used six
  times and only ever meaning *overdue*), type trio (Bricolage Grotesque on its width axis,
  Onest, Spline Sans Mono), structure, copy, and assets. No light/dark toggle: the direction
  is one committed thing and the dark act is a place inside it, two folds long, on the two
  subjects that are actually about what is hidden.
- **The hero is a canvas film, not a video.** `lib/flow.ts` renders four beats of a flow
  field as a pure function of scroll progress: an uncountable current, walls dividing it
  into one sheet per mandate (with the duplicate approach drawn as two dashes that burn),
  the walls dissolving, and the dashes landing on the row grid where the real queue panel
  then resolves. Deterministic, so scrubbing is exact both ways, there is no Range/seek/
  keyframe problem, and it is the screen's own resolution at a few KB.
- **The signature is the channel**: one drawn line down the left of every fold, self-drawing
  on scroll, stamped with dates that agree with each other, forking at the record fold.
- **The one interactive moment**: hold to log an email, and four consequences derive
  themselves in sequence. Releasing early eases back; Enter or a click completes it for
  anyone who cannot hold; reduced motion gets it already done.
- **Assets are rendered from the page's own code.** `app/render` is a bench and
  `scripts/render-assets.mjs` photographs it, producing the share card, the still hero, the
  closing fold's frame and a 12-second clip recorded straight off the canvas with
  MediaRecorder. No image model, no encoder install, nothing to drift when the palette moves.

### Verification
- [x] `tsc --noEmit` clean · `next build` prerenders all four routes static.
- [x] **axe-core: 0 violations** at 1440 and 375.
- [x] Flick test (120/240/360px): every beat holds six normal flicks, none skippable. This
      is what moved the hero from 420vh to 540vh.
- [x] Contrast walk over every visible text node: zero real failures.
- [x] Zero console errors and zero 404s at both widths; no horizontal overflow at 1024,
      1280, 1440, 1600 or 375.
- [x] All five static-hero gates verified live, in CSS and JS, with the canvas never armed
      behind them.
- [x] Complete without the canvas: the poster sits under it as a CSS background.
- [x] Copy gate: zero em dashes, zero stock words in rendered copy.

### L6a — the hero rebuilt on the generated footage (2026-08-24, same day)

The abstract canvas read thin against the AI imagery once it was in the page, so the hero
film is now the generated frames, sequenced: the current, the eddy, the confluence, the
drop, each carrying the band of copy it was generated for, each crossfading in the gap
between two bands and each carrying a continuous scroll-driven scale and drift so no frame
is ever a photograph sitting still. The deterministic filament field survives as a
transparent overlay (`ground: false`), which is what keeps the frame alive between
crossfades and still resolves into the queue's rows at the settle. Lane walls are suppressed
over footage: three hairlines drawn across a photograph read as a rendering fault.

### The end-to-end validation pass

38 checks across every component, animation and effect. Everything below was run in a real
browser, not reasoned about.

**Found and fixed, real:**
- **The nav floated as a dark bar over a light page** on the way out of the deep act. The
  surfacing gradient fades the last deep fold to mist over its final 160px, so the fold
  stops LOOKING dark before it stops BEING dark, and the nav's probe counted those pixels.
  It now discounts the surfacing tail, and its colour transitions with its ground.
- **Hero sublines measured 3.5 to 3.9:1 over the film**, against a 4.5 floor. Fixed by
  holding the mist wash at full strength across the whole reading lane before letting the
  picture through, and by adding `--ink-onfilm`, a darker muted ink for the one place muted
  text sits on a photograph. Now 5.7 to 6.0:1.
- **Standalone text links were 21px targets on a phone.** Nav, footer and the FAQ's side
  link now clear 44px under `(pointer: coarse)`. Links inline inside a sentence are exempt
  by the guideline and were deliberately left alone.

**Found and dismissed, with the reason:** four "failures" were the harness, not the page.
`html { scroll-behavior: smooth }` makes any timed read after `scrollTo` land mid-animation;
Motion draws SVG paths with `stroke-dasharray`, not `stroke-dashoffset`; Tailwind v4 writes
`rotate`, not `transform`; and a worst-pixel box that includes a panel's rounded corners
finds the page behind the panel, not the ground under the glyphs.

**Verified green:** hero load ramp, film sequencing and camera moves, band ownership, the
drive loop resting, the scroll cue, one pulsing row, canvas resize, the channel drawing with
scroll on every fold, every entrance ending at full opacity, no stagger delay surviving, the
desk's held frame following the caption, the disclosure list, the pointer-light layer, the
clip mounting client-side and playing once, every in-page link resolving clear of the header,
all four nav states, the hold interaction in all four of its paths, reduced motion in full,
every tab stop's focus ring, the skip link, and the phone layout. axe: 0 violations at 1440
and 390. Flick test: six full flicks per beat. Zero console errors, zero 4xx, zero
horizontal overflow at 375, 1024, 1280, 1440 and 1600.


## Track T — Tasks, activity, project members, permanent delete (2026-09-06) ✅ complete

Upstream could say what state the book was in. It could not say what the team was *doing*
about it: no task existed anywhere in the codebase, nothing carried `updated_by_id`, and
assignment lived only at the engagement level behind one partner-only menu. This track is
that missing half — plan in `PROJECTS_ACTIVITY_TASKS_PLAN.md`.

### What shipped

**Tasks** — four states (BACKLOG → IN_PROGRESS → BLOCKED → DONE), an assignee, a due date
and a priority, attached to a project / engagement / company / contact, or PERSONAL.
`/tasks` (List + Board), a Tasks tab in the deal room, a section on the company dossier, a
quick-add on the contact page, "Add task" in the Master List / Schedule / book-grid row
menus, and a ⌘K action. The inline add row — type a title, press Enter — is the whole
"analysts can write to-dos" ask; the dialog exists for everything else.

**Activity** — an append-only `activity_events` log written at 12 curated call sites, read
firm-wide (`/activity`), per project and per company. Phrased as sentences: *"Rhea Kapoor
logged an initial email · Acme Industries"*.

**Project members** — `project_assignments`, a Team view, and a `/members` union tagged
`assigned | mandate | creator`.

**Archive + permanent delete** — un-gated (visibility, not role), with the rails below.

### Decisions worth keeping

- **Tasks use four real FKs + a stored `scope`; activity uses `object_type` + `object_id`.**
  Opposite requirements. Tasks get filtered, joined and cascaded, so a generic `object_id`
  would make "tasks on this project" four unindexable ORs and force RBAC post-filtering in
  Python — which makes `total` in the list envelope a lie. Activity rows are only displayed,
  over a growing object set, so they carry **snapshots** (`actor_name`, `object_label`)
  instead. After a project delete those objects no longer exist to join to.
- **`project_id` is denormalised onto every task and activity row**, so the sidebar counts
  are one `GROUP BY` and the delete cascade is one predicate. Safe only because neither hop
  is ever reassigned — pinned by a canary test asserting `project_id` is not in
  `MandateUpdate.model_fields`.
- **Activity is written by hand, not by a session listener.** `session.execute(delete(...))`
  fires no ORM events, so a differ would silently miss the workspace reset and the project
  delete — the two paths a partner most wants recorded. Completeness is bought instead by
  `tests/test_activity_coverage.py`, which walks the live route table and fails until every
  mutating endpoint is either instrumented or declined *with a written reason*.
- **`log()` never commits.** The caller's own commit carries the row, so an activity entry
  and the mutation it describes land together or not at all. A test asserts that a request
  ending in 422 leaves the activity count unchanged.
- **A project assignment grants the project, not its engagements.** Widening
  `visible_mandate_ids` from it would turn one partner click into a backdoor to every
  company (rule 5). The consequence — an assigned-but-unmandated analyst sees the project
  shell with an empty engagements list — is a decision, pinned by a test.
- **Permanent delete has no role gate, deliberately.** The rails instead: it must already be
  archived (409), the name must be typed back (422), a dry-run preview states the counts,
  and a `PROJECT_DELETED` tombstone is written *after* the loop with `project_id=NULL` (written
  before, step 4 deletes it) plus a `logger.warning` that outlives a workspace reset.
  `tests/test_project_delete.py` builds **its own engine with `PRAGMA foreign_keys=ON`**,
  because nothing else in this backend enforces FKs — a mis-ordered delete otherwise passes
  every test on SQLite and fails only in production.

### Bugs found by driving the real app, not by tests

- **Naive UTC timestamps rendered as local time.** `created_at` is a naive column holding
  UTC, and the JSON carries no offset, so `new Date(...)` read it as the browser's zone. In
  IST a row written one second ago displayed as **"5h"**, and a row just past midnight UTC
  landed under "Yesterday". Fixed with `parseServerDate` in `lib/format.ts` (appends `Z`
  only when there is genuinely no designator, so the tz-aware `archived_at` / `completed_at`
  are untouched); regression tests in `tests/activity.test.ts`.
- **`No projects match ""`** on the archived filter with an empty search box — the empty
  state named the wrong control. It now names whichever filter is actually hiding things.

### Also cleaned up on the way through

`_visible_project_ids` existed in two copies that **disagreed** (one filtered archived
mandates, one did not); hoisted to `deps.visible_project_ids` with an explicit
`include_archived` flag so the narrowing is a decision rather than an accident. `BookGrid`
moved to `components/features/book-grid.tsx`, taking the deal room from 1438 lines to a
shell that composes views. The deal room's hand-rolled `history.replaceState` — the last
holdout — now goes through `useTableUrlState`. Three hand-rolled avatar stacks and two
copies of `fmtDate`/`initials` collapsed into `ui/avatar.tsx` and `lib/format.ts`.

### Verification

Backend `pytest -q`: **378 passed** (318 before; 60 new across `test_tasks.py`,
`test_activity.py`, `test_activity_coverage.py`, `test_project_delete.py`,
`test_project_members.py`, plus migration parity and workspace-reset extensions).
Frontend `vitest run`: **190 passed** (31 new). `npx playwright test`: green, including new
`tasks.spec.ts` and `activity.spec.ts`, the extended `projects.spec.ts` delete path, and the
route audit walking `/tasks`, `/tasks?view=board` and `/projects?scope=archived` as both
roles with zero console errors. Driven live: created a task from the dashboard, watched the
sidebar count move, opened a deal room, moved a task across the board, read the Activity tab,
then archived and permanently deleted a throwaway project and confirmed the siblings survived.

**Known gap, deliberate:** `feature-sweep.spec.ts` needs the `bootstrap` seed plus the three
phase-2 workbooks; it fails against the Faker `seed.py` book used for this run. Unrelated to
this track.

---

## Track P — The Project workspace (redesign)

The deal room was one 927-line page switching between five modes on `?view=`. That
shape had three costs: "the project's analytics" and "the project's activity" were the
same URL, every mode paid for every other mode's fetch, and the Book view could only
ever show **one** engagement — so the question a lead actually asks ("where in this
project is the work piling up?") had no screen that could answer it.

### What the project is now

`app/(app)/projects/[id]/layout.tsx` is a **shell** that owns exactly three things: the
project record (fetched once, read from `components/project/project-context.tsx`), the
header, and the dialogs. Six real routes sit under it:

| Route | Question it answers |
| --- | --- |
| `/projects/{id}` | What needs my attention, how is it going, what changed |
| `…/workspace` | The whole book — every engagement, banded and categorised |
| `…/work` | Declared work, by due date / board / list |
| `…/analytics` | Is outreach converting, and where does it leak |
| `…/activity` | The append-only trail, filtered server-side by verb group |
| `…/details` | The record, the team, the engagements, the firm's vocabulary |

Old links still work: `?view=book|board|tasks|activity|team` and `/grid?mandate_id=` both
forward to the route that replaced them, carrying the engagement across.

### The hierarchy

`components/project/project-workspace.tsx` renders **Project → Engagement → Band →
Category → Company** in one table. Every level above a company carries a count, a health
bar and an attention mark, which is what makes collapsing safe: a closed group still tells
you whether opening it is urgent. Grouping is switchable (band→category, band, category,
status, none), expansion is keyed by a stable path so filtering never closes what you had
open, and a leaf renders 40 rows before offering the rest — a 274-company project mounts a
few hundred rows without a virtualization dependency.

`components/project/health-bar.tsx` is the signature instrument: width ∝ size against the
widest sibling, segments in a fixed order (late → intro pending → replied → cold → the
working remainder) so the same colour sits in the same place on every row.

### Navigation

The global sidebar lost **My work → Backlog / In progress / Blocked / Done** entirely —
task status is a project concern, and four global status links let you filter every firm's
work by a state without ever saying whose work it was. Declared work now lives at
`…/work`. `/tasks` survives as a route (personal tasks belong to no project and would
otherwise be unreachable) and is reachable from the command palette; the route audit still
walks it. `nav.ts` is now strictly global product areas; project-context navigation is
`components/project/project-nav.tsx`.

### Backend

Two additions, both reads, both reusing what exists:

- `GET /companies?project_id=` — the project's whole book in one request, composed with
  the visibility predicate rather than replacing it.
- `GET /projects/{id}/analytics` — the firm-wide `services/analytics` functions called
  with this project's visible mandate ids. **No new query layer**: one definition of
  "replied" for the product, so a project page and the firm page cannot disagree. Not
  partner-gated (unlike `/analytics/projects`, which spans the firm).

### Numbers that were quietly disagreeing

The header said "Reply rate 11% (5 of 47)" while the page under it said "25% replied (9 of
36 contacted)" — two different, both-correct measures wearing the same name. The header
metric is now **Responded** (status `RESPONDED` over the whole book, the server's rollup);
**reply rate** means any answer over the contacted subset, everywhere. The analytics
"gone cold" row was reading `NOT_CONTACTED` under a label that said cold; it now reads the
same per-engagement rollup the header does.

### Bugs found by driving the real app

- **Invisible primary action in dark mode.** The outline Button carries
  `dark:bg-input/30`, and Tailwind sorts that single-variant utility *after* a bare
  `group-hover:` — so a hovered row's "Follow-up" button kept a 3%-white fill while its
  text switched to `--primary-foreground` (near-black ink). Measured: `rgba(255,255,255,
  0.033)` behind `lab(9.4 …)`. Stacking the variant (`dark:group-hover:bg-primary`) fixes
  it; carried over from the old `book-grid.tsx`, so it had shipped.
- **Clipped Y-axis on every trend chart.** `TrendPanel`'s `left: -22` margin against a
  34px `YAxis` left 12px for the ticks, so two-digit labels rendered as a sliver of their
  last glyph. Pre-existing on the firm-wide Analytics page too; `-10` fixes both.

### Verification

Backend `pytest -k "project or compan or activity or analytics"`: **125 passed**. Frontend
`vitest run`: **216 passed** (26 new in `tests/project-workspace.test.ts`, covering
attention ranking, vitals arithmetic, tree nesting/ordering/stability, filtering,
progression and work bucketing). `tsc --noEmit` and `next build` clean. Driven live against
the seeded book as a partner: walked all six views on a 47-company project and a
274-company one, checked both legacy redirects land, applied `?attention=late` from the
header and watched the tree roll up to 21 of 47, and read every panel in both themes.

`npx playwright test` over the specs this track touches — `projects`, `grid`, `tasks`,
`activity`, `pipeline-board`, `cadence`, `command-palette`, `smoke`, `outreach-timeline`:
**27 passed**. Four specs needed updating for the new IA, and each change is itself a
finding:

- `grid.spec.ts` / `activity.spec.ts` / `tasks.spec.ts` addressed the deal room's views as
  `getByRole("tab")`. They are routes now, and they are addressed **by href** — because
  `getByRole(name:)` matches substrings, and "Work" also matches "Workspace", while
  "Workspace" also matches the overview's "Open the workspace" link.
- Three `tasks.spec.ts` assertions read the sidebar's `a[href="/tasks?status=BACKLOG"]`
  children, which this track removed on purpose. They moved to the status rail on
  `/tasks` — the same figure from the same `summary.by_status`, on the page the test is
  actually exercising. `/tasks/summary` is no longer fetched on that navigation (the
  sidebar was its only caller there; the dashboard still reads it), so the spec now waits
  on the list response instead.
- The same helper was reading a missing count as **0** rather than "not yet". With the
  sidebar gone the race got wider, and a baseline of 0 against a real 22 made the
  assertion fail loudly rather than pass quietly — it now polls for a figure first.

**Known gap, not a regression:** two `pipeline-board.spec.ts` cases fail when the whole
batch runs in one process and pass when the spec runs on its own. They mutate company
status on shared
seed rows that `cadence.spec.ts` and `grid.spec.ts` also move; the board spec is serial by
design and wants its own fixture. Unrelated to this track — neither `pipeline-board.tsx`
nor `/master` was touched.

---

## Track PX — The Project as an operating surface (2026-09-09) ✅ complete

The previous track split the deal room into six routes and gave the project a shell. That
was the structural half. This one is the half that decides whether an analyst can actually
work inside it: the **Workspace** stopped being a hierarchy with dropdowns bolted on, and
**Analytics** stopped being a grid of panels.

Nothing about the data model moved. Cadence is still computed server-side against IST
(rule 2), outreach is still an append-only log (rule 1), and every figure on both surfaces
resolves to a field the server already decided.

### What was actually wrong

Both surfaces worked. Neither answered a question.

* **The workspace had exactly one lens.** A tree of Engagement → Band → Category → Company,
  narrowed by four peer `<select>`s. Four selects can express four questions; every fifth
  one an analyst has ("late, in this band, more than thirty days over") was simply
  unaskable, and the one that mattered most — *what do I do next* — was the third option
  inside the second select. `Group: Band → Category` sat where the primary control should be.
* **A leaf capped at 40 rows behind "show N more"**, while its own header printed the true
  count. The user was told 47 and shown 40, silently.
* **Opening a company was a navigation.** Filters, grouping, scroll position and expansion
  were all rebuilt by hand on the way back. Nobody works a queue twice like that.
* **Analytics was six bordered panels in a grid**, which is what you reach for when the
  sections have no relationship to each other. A grid has no reading order, so the reader
  chose which box to read first and then held the rest in their head. That is an
  information-architecture failure, not a styling one — so the panels are gone rather than
  restyled.
* **Every analytics number was a dead end.** "50 late" told you something was wrong and gave
  you nothing to click.

### The workspace: filter, grouping, view

Two files written in the previous track had never been wired to anything —
`lib/project-views.ts` (the filter/sort/priority model) and `lib/workspace-rows.ts` (the row
flattener). This track builds the surface on top of them and finishes both.

The three things the old dropdowns had tangled are now separate:

    a FILTER   decides which companies are in play
    a GROUPING decides how they are stacked
    a VIEW     is a named (filter, group, sort) you can return to

so "Needs attention" and "By band" are two lenses over one dataset, not two pages. Twelve
built-ins, split by what they are *for*: **Working** views (overdue, replied, due this week,
intro pending, gone cold, no contact) are flat and priority-sorted, because a queue that
re-sorts by engagement is a filing cabinet; **Structure** views group and sort by name. A
user's own combinations save to `localStorage` — per-person and per-machine, which is
honestly what a working habit is, and no endpoint, migration or sharing model until it earns
them.

The whole state lives in the URL, so a lens is a link. `workspaceHref()` is the only way
anything builds one, which is what stops a figure and the list behind it from drifting
apart. `?attention=late` and `?book=` still work — they are rewritten into the view model
once, on arrival, rather than evaluated forever.

The filter is a condition list behind one button, with one AND/OR join for the whole group
and deliberately **no nesting** — nesting is the feature that turns a filter into a query
builder, and a query builder is a thing users open once. Every active condition is spelled
out as a chip under the toolbar, because a hidden filter that removes 200 rows looks like
missing data.

`Expand all` / `Dense` — two controls named after their implementation — became **Display**
(Comfortable / Compact) and one Expand/Collapse toggle that only appears when there is
something to collapse.

### The register: virtualized, and honest about its counts

The tree plus a collapsed-set is deterministically one array of rows, and an array can be
windowed. So the leaf cap is gone: a 282-company project mounts about thirty rows, and the
count in a group header is now always the count you can scroll to.

It is a CSS grid, not a `<table>`, because a virtualizer needs absolutely-positioned rows.
What the table was carrying is kept explicitly — one shared `grid-template-columns` for the
header and every row, and real `role="grid"` / `row` / `gridcell` semantics instead of ones
inherited by accident. Columns respond to **container** queries, not the viewport: the
register shares its row with the peek panel, so opening a company takes ~26rem off the table
while the window does not move at all, and `lg:` cannot see that.

Row heights are declared rather than measured. Every row of a kind is the same height by
construction, so declaring it makes scroll offsets exact on the first frame instead of
settling over several — visible, before, as the list jolting under the cursor — and makes
Comfortable/Compact a real number rather than a side effect of how much text a cell held.

The engagement header pins while you scroll inside its book. It is `sticky` with a matching
negative margin so it occupies no space in flow; `position: sticky` on the rows themselves
cannot work, because they are already `position: absolute`.

### The panel, and working a queue

A company opens **beside** the list, on the same route, in `?peek=`. The register is never
unmounted, so scroll, selection, expansion and filters all survive an inspection. The panel
answers who this is, where it sits, who we know, what happened, what is scheduled, what work
is attached, and what can be done right now — the full dossier stays one click away.

`↑`/`↓` (or `k`/`j`) walk the register and `Enter` opens the record beside it; with the panel
open the arrows move the panel too, so review → act → next is two keys.
`aria-activedescendant` names the cursor row without moving focus off the grid.

Priority is a **list of reasons, never a score on screen**. The score exists only to order
the queue; what the UI shows is the facts that produced it, each one a re-reading of a field
the server computed. In the register the signal column stays nearly empty on purpose — only
"overdue" and "somebody replied" earn ink, because "intro never sent" is already what the
Next-touch cell says, and repeating it on 200 rows is the noise this redesign removes.

Bulk actions stop exactly where the data model does. There is **no "Assign"**: a company has
no owner field — people attach to engagements and to tasks — so an assign control would have
to invent a relationship and then fail to save it.

### Analytics: a briefing, read top to bottom

Seven sections in the order the questions arrive: the reading → where outreach converts →
where it is stalling → which book is carrying it → which counterparties answer → how long a
reply takes → is it getting better. No cards anywhere; a section is a rule, a title, a
sentence saying what it answers, and its content.

Two rules the whole page obeys. **Every figure is a link** — every count, stage, engagement
and segment deep-links through `workspaceHref` into the records that produced it. And **every
rate carries its denominator**, with `MIN_N` as the floor: thin segments drop below a rule,
keep their raw counts and lose the percentage, because deleting the row hides that the
segment exists, and printing "67% (2/3)" beside a group of ninety is a confident wrong answer.

The funnel draws the **loss between the steps**, not just the steps. 139 contacted companies
that never answered is the finding; "replied: 135" is the arithmetic that produced it.

### Sidebar

Eight projects each printing a red figure was a wall of alarms with no ranking between them —
and a count is not actionable from a sidebar anyway, since acting on it means opening the
project. The rail now carries the one bit that is useful there (something in this book is
late) as a dot, ordered by what the person is actually doing: open project first, then
recently visited, then attention. The magnitude lives on the tooltip and on the deal floor,
where projects can be compared. A filter appears past six projects.

### Bugs found by driving the real app

- **The engagement header rendered twice at the top of the list.** The pinned copy derived
  its book from the first *rendered* virtual row, which includes overscan — so at scroll 0 it
  pinned the header that was already on screen. Fixed by comparing against the real scroll
  offset, from a running total of declared heights.
- **A held arrow key skipped every other row.** Two keydowns arrive in the same tick and both
  closed over the same rendered cursor, so the second recomputed from the position the first
  had already left. The cursor is now mirrored in a ref that handlers read synchronously.
- **Stepping through the queue mounted two panels.** `AnimatePresence` keyed on the company id
  made every step an unmount plus a mount, and it holds the outgoing element for the length of
  its exit — two panels side by side, register squeezed between them, on every press. The
  presence boundary is for opening and closing; moving to the next company is the same panel
  showing something else.
- **"This book is empty. Add the first company"** appeared under every engagement when a search
  matched nothing. The book was not empty; the search had no matches. A narrowed register now
  says so, and the register's own empty state keys off the filtered count rather than the row
  count, which a grouped tree never lets reach zero.
- **A group header's reply rate was computed over the filtered subset** — "0% replied, 0/10"
  under a view that excludes replies. True, and about the filter rather than the book.
  Suppressed whenever anything is narrowing the list.
- **A flat view showed the same company twice with nothing to tell the rows apart.** One target
  legitimately sits in two engagements; the row was printing its band where it should have
  printed its book.
- **An unanswered condition counted as an active filter.** A row opened but not yet answered
  narrows nothing, and a badge reading "2" over an unchanged list is a badge nobody believes
  again.

### Verification

Backend `pytest`: **378 passed** (no backend change in this track; run as the regression gate).
Frontend `vitest run`: **251 passed**, 35 of them new in `tests/project-views.test.ts` — filter
URL round-trips and garbage tolerance, every match operator including the two that must
*exclude* rows with no value rather than treat them as zero, priority ordering and its one
editorial claim (an unanswered reply outranks an overdue follow-up), sort stability, view
definitions, drill-through links, and row flattening with its no-cap guarantee. `tsc --noEmit`
and `eslint` clean.

`npx playwright test`: **53 passed, 1 failed** on a clean run — the failure being the
fixture mismatch described below. Six of the passes are new cases in
`tests/e2e/workspace.spec.ts`, covering the view system, the panel-preserves-the-list
contract, the analytics drill-through and bulk selection.

Two runs during the work showed extra failures and both were self-inflicted: editing
frontend files while Playwright is running makes `next dev` recompile mid-suite. Each of
those specs passes on its own — `command-palette` 4/4, `workbook-import` 3/3 — and
`pipeline-board` remains the known batch-only flake already recorded above. **Do not edit
the frontend while the suite runs.**

The command-palette failure was worth chasing rather than dismissing, because this track
adds a *global* keydown handler to the workspace. It does not interfere: the handler
returns early on any modifier (so ⌘K passes through untouched) and skips events whose
target is inside an `input` or a `[role="dialog"]` (so typing in the palette cannot move
the register cursor). Verified live with the workspace mounted — cursor on a row, ⌘K
opened, `j` and `ArrowDown` typed into the palette, cursor unmoved.

Two spec changes, each a finding of its own:

- `workbook-import.spec.ts` asserted an imported company was visible on the project
  **overview**, whose queue is the seven most urgent rows — so whether any particular company
  appeared depended on how the sheet's dates landed against today, not on whether the import
  worked. It now searches the workspace, which proves both that the row was written and that
  it is findable.
- The workspace spec counts from the caption, never from the DOM. With a virtualized register
  the number of mounted rows is a fact about the scroll position.

**Known gap, not a regression:** `feature-sweep.spec.ts` fails on this machine's database. Its
own header states the fixture it needs — `bootstrap --reset`, `sourcing_pool`, then the three
`phase_2` workbooks — and this dev DB was seeded with the Faker `seed.py` instead, so its
assertions about specific pool and Master List companies cannot hold. The file is
`describe.serial`, which is why one failure leaves the rest unrun. Nothing in Sourcing or
Master List was touched by this track.

---

## Track UX — "Ledger": product-wide redesign  ✅ complete (2026-09-11)

**Goal:** replace the all-grey "ink on paper" system across every product surface with one
coherent, production-grade visual language: black and white foundation, strong type,
crisp hairlines, and colour used only for state. Strategy in `PRODUCT.md` (new), the
system in `DESIGN.md` (rewritten). Behaviour, routes and data flow are unchanged.

**Why:** the previous system removed all hue — late, replied and bounced were all shades
of grey, status needed a legend, and the inverted black blocks, tracked-caps eyebrows and
monospace figures read as templated. The brief asked for a serious B2B product, not an
"AI dashboard".

### The system
- Tokens (`app/globals.css`): white workspace, cool-tinted neutrals, solid hairlines, a
  13px working `text-sm`, four state families (danger / warning / success / info) each
  with solid, ink, soft and line, and a near-black navigation rail (`--sidebar-*`).
- Type: Instrument Sans everywhere with tabular figures; `MONO` is now
  `font-variant-numeric: tabular-nums`; Plex Mono only for code-like strings.
- Roles (`lib/design.ts`, same export names): status glyph with state colour, `CHIP` +
  `CHIP_TONE`, `LATE_TOKEN` (red) and `DUE_TOKEN` (amber), segmented control as a raised
  white segment, sentence-case `LABEL`, flat `PANEL` + `PANEL_HEAD`.
- Primitives rebuilt: button, badge, input, select, dropdown, popover, dialog, tabs,
  card, table, skeleton, toast, avatar.

### Shell and navigation
- Dark rail replaces sidebar + top bar: firm and brand, Search (⌘/Ctrl K), Home · My work
  · Deals · Outreach · Insights · Workspace groups, the recent-project list with a red dot
  for anything late, and an account menu that keeps the role on screen. Collapses to an
  icon rail (`[`); `g` + letter jumps to a section. Below `md` it is a drawer behind a
  48px bar. "My work" (`/tasks`) is back in the nav as the cross-project inbox.
- Shared `PageHeader` with breadcrumbs; skip link; skeleton shell while auth loads.

### Surfaces
- Home: a "Today" module (one sentence + four ruled figures + the queue action) replaces
  the hero number and pressure gauge; focus queue as an aligned table.
- Project shell, workspace register, peek, filter builder, view picker, bulk bar, work,
  analytics, activity, details — state colours throughout; the "why now" column no longer
  repeats lateness beside the late chip; phone-width column template for the register.
- Projects, Master List (cells, board, next-touch), Sourcing (fit column without the side
  stripe), Schedule (horizon bars, row tints and stagger removed), Contacts, Companies,
  company and contact detail, Analytics (finding line, ruled metrics, conversion strip,
  green replies), Project health, Sourcing analytics, My work (status tabs), Settings
  (section index + flat panels), Import, Login/Signup (split auth shell), 404, error.
- Mechanical sweep: tracked-caps labels → sentence case, monospace figures → tabular,
  translucent washes → surface tokens, 12–16px radii → 8px, italic "provisional" voice →
  dashed glyph, invisible `bg-muted` skeletons → `ink-100`, pills → square chips.

### Verification

Run against a Faker-seeded redesign stack (`api-redesign` :8200 + `product-app-v2` :3030,
`backend/upstream_redesign.db`, plus ~30 realistic tasks so Work and Activity are populated).

- `tsc --noEmit` clean; `next build` succeeds (all 28 routes).
- Vitest: **253 passed** (23 files).
- Playwright (full suite, serial): **40 passed**; the 6 initial failures were 2 real
  regressions — `login`/`smoke` expect a heading named "Upstream", which the new auth shell
  had demoted to text (fixed: the lockup is the page `<h1>`) — and 4 environment
  mismatches (`activity`, `outreach-timeline` call the API at `NEXT_PUBLIC_API_URL`, which
  defaults to :8000). Re-run with the URL set: **18/18 passed**. `feature-sweep` still needs
  its own bootstrap + pool + workbooks fixture (unchanged known gap; 13 serial dependants
  unrun).
- Every route captured at 1440×900 before and after, plus interactive states (palette,
  account menu, dialogs, peek, filter builder, view picker, row menu, bulk bar, collapsed
  rail, confirm) and 390px mobile. Two layout bugs found this way and fixed: the phone-width
  register header collision, and a duplicate command-palette key from adding My work to
  the nav.
- `eslint`: 7 pre-existing React Compiler errors (`set-state-in-effect` in
  `companies/page.tsx`, `command-palette`, `compose-email-sheet`, `email-sending-card`,
  `use-counter`) are untouched by this track — the redesign changed only class names in
  those regions. Unused imports it left behind were removed.

**Dev-only note:** Next's dev indicator sits over the rail's account button in `next dev`
(not in production builds); use the keyboard or collapse it when testing that corner.
