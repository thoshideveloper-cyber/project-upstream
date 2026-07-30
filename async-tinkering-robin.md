# Project Upstream — Phase "Work Like the Analyst Works"

## Context

The MVP (Phases 0–7) is complete and green (pytest 94, Vitest 22, Playwright). It already
has the lower hierarchy — `Mandate` (= engagement), `company.bucket` (= category, free-text),
`CompanyType`, an append-only outreach event log, a server-computed fixed-anchor cadence
engine, firm-scoping/visibility, soft-delete, and cross-mandate exact-match dedup.

This phase productises the analyst's Excel workflow without re-inventing what exists. The gaps
the brief identifies, confirmed against the real schema:

1. **No PROJECT parent.** Mandates have a `client_name` string but no entity grouping multiple
   engagements (sell + buy + raise) under one client.
2. **`bucket` is unvalidated `String(100)`** — categories don't group cleanly.
3. **No cold/restart.** `cadence.py` increments follow-ups forever; `StoppedReason` has no
   exhausted value; `outreach_schedules` is hard-locked to one-per-company (`unique(company_id)`),
   so "swap contact + restart with a fresh anchor" is impossible without violating the
   immutable-`initial_date` rule.
4. **Dedup is exact-match only** and does an N+1 schedule lookup per candidate.
5. **No project / working-grid / partner-overview views.**

**Confirmed decisions (via AskUserQuestion):**
- **Cycle model:** extend `outreach_schedules` into the cadence cycle (`cycle_number` +
  `is_current`); "schedule = cycle". Events already FK `schedule_id`, so per-cycle history is free.
- **Cold:** add `StoppedReason.EXHAUSTED`; COLD is a derived cadence state/badge, **not** a
  `CompanyStatus` value (keeps status about the response).
- **Category vocab:** `CompanyCategory` enum = STRATEGIC, PRIVATE_EQUITY, VENTURE_CAPITAL,
  FAMILY_OFFICE, FINANCIAL_SPONSOR, OTHER (+ "Other" escape hatch).
- **Follow-up cap:** `firms.follow_up_cap` (default 4) + nullable `mandates.follow_up_cap`
  override; resolved server-side.

**Non-negotiables preserved throughout:** append-only events (restart = new cycle + logged
event, never an edit); server-computed cadence via `today_ist()`; AWAITING_INITIAL lifecycle +
immutable `initial_date` *per cycle*; firm-scoping/visibility on every endpoint; soft-delete;
derived primary contact; httpOnly cookie auth. The schedule/cycle state machine stays MUTABLE
(pause/resume/stop/restart) — append-only governs EVENTS, not the schedule row.

Execution is **vertical slices, backend-first with pytest then frontend with Vitest/Playwright**,
PROGRESS.md updated after each. Keep everything green; never reduce coverage. No email/webhook
integration this phase (hard guardrail).

---

## Slice 1 — Schema foundation + migrations + seed (do first, all backend)

### New entity: Project
- `app/models/project.py` — `id, firm_id (FK, indexed), name, client_name, archived_at,
  created_at, updated_at`. Firm-scoped, soft-deletable. Relationship `mandates: list[Mandate]`.
- `app/schemas/project.py` — Read/Create/Update mirroring the model.
- Register in `app/models/__init__.py` and `app/schemas/__init__.py`.

### Mandate gains a project parent
- `mandate.py`: add `project_id` (FK→projects, **nullable first**, indexed) + `project` rel;
  add nullable `follow_up_cap` (int).

### Category vocabulary
- `enums.py`: add `CompanyCategory` (6 values above).
- `company.py`: add `category: Mapped[CompanyCategory]` (SAEnum, `native_enum=False`, default
  `OTHER`). **Keep `bucket` column** during migration for backfill, then it becomes derived/legacy
  — populate `category` from `bucket`, leave `bucket` in place (no destructive drop) to honor
  soft/non-destructive rule; new writes set `category`. (Schema/API reads expose `category`.)

### Cadence cycle (extend outreach_schedules)
- `outreach_schedule.py`: add `cycle_number` (int, default 1), `is_current` (bool, default True),
  `contact_id` (FK→contacts, nullable — the contact this cycle targets). Replace
  `unique(company_id)` with `UniqueConstraint(company_id, cycle_number)`. One-current-per-company
  is enforced in the service (and asserted in tests), not by a partial index (SQLite-safe).
- `enums.py`: add `StoppedReason.EXHAUSTED`.
- `firm.py`: add `follow_up_cap` (int, default 4).

### Migrations (additive, ordered) — `alembic/versions/`
1. Create `projects`; add `mandates.project_id` (nullable) + `mandates.follow_up_cap`;
   add `companies.category`; add `firms.follow_up_cap`; add
   `outreach_schedules.cycle_number/is_current/contact_id`; add `EXHAUSTED` (enum is
   `native_enum=False` String, so no DDL enum alter needed — values are app-level).
2. **Backfill (data migration, in the same or a follow-up revision):**
   - One `Project` per distinct `(firm_id, client_name)`; point each mandate's `project_id` at it.
   - `companies.category` from `bucket` via map: Strategic→STRATEGIC, Financial/PE→PRIVATE_EQUITY,
     Tier-1/Tier-2/Opportunistic→OTHER (unknown→OTHER).
   - Existing schedules: `cycle_number=1, is_current=True`; set `contact_id` to the company's
     primary contact where present.
3. Enforce `mandates.project_id` **NOT NULL** (after backfill).
- Verify `alembic upgrade head` then `downgrade` is clean on SQLite. Replace the
  `unique=True` on `company_id` carefully (SQLite needs batch ops — use Alembic
  `batch_alter_table`).

### Seed (`app/seed/seed.py`)
- Wrap the 4 mandates into projects; make **at least one client two-sided** (e.g. add a buy-side
  mandate under "Medanta Healthcare" alongside its sell-side) so Project view + partner overview
  demo real sell/buy separation.
- Set `category` (from the new enum) instead of/in addition to `bucket`; keep the deliberate
  cross-mandate duplicate names.
- Seed **one EXHAUSTED (cold) company** and **one restarted company** (2 cycles: an archived
  EXHAUSTED cycle + a fresh AWAITING_INITIAL/ACTIVE current cycle on a new contact) so cold +
  restart are demoable on `--reset`.
- Keep idempotent + `--reset`.

### Code that must adapt to multi-cycle (preserve behavior)
- Every "the schedule for company X" fetch (`select(OutreachSchedule).where(company_id==X)
  .scalar_one_or_none()` in `api/companies.py` `_enrich_company`, `cross_mandate.py`,
  `benchmark.py`, `analytics.py`, schedule handlers) gains `.where(is_current.is_(True))`.
- The queue joins in `api/schedule.py` (`select(OutreachSchedule, Company).join(...)`) filter
  on `status` already; add `is_current.is_(True)` defensively so archived old cycles never leak.
- `services/cadence.py` `get_followups_done` counts by `schedule_id` (cycle-scoped) — already
  correct.

### Slice-1 tests (pytest)
- Project model + scoping; backfill invariants (every mandate has a project; category mapped).
- Multi-cycle: a company can hold 2 schedules with exactly one `is_current`.
- Migration up/down clean. Update existing tests that assumed `unique(company_id)`.

### Slice-1 acceptance
- `alembic upgrade head` + `downgrade base` clean on SQLite; `--reset` seeds multi-project,
  two-sided, categorised data incl. one cold + one restarted company; pytest green.
- Document the schema decision + migration in PROGRESS.md.

---

## Slice 2 — Cadence cycle engine + cold + restart (backend)

- `services/cadence.py`:
  - `effective_cap(firm, mandate)` = `mandate.follow_up_cap ?? firm.follow_up_cap ?? 4`.
  - On `FOLLOW_UP` log: after incrementing, if `followups_done >= effective_cap` and no response →
    `stop_schedule(EXHAUSTED)`. `compute_cadence` returns a `is_cold` / cadence-state field.
  - `restart_cycle(db, company, new_contact_id)`: assert current cycle is STOPPED/EXHAUSTED;
    set `is_current=False`; create new schedule row `cycle_number+1, AWAITING_INITIAL,
    is_current=True, contact_id=new_contact_id`; log a `NOTE` event recording the restart.
    **Never mutate past events.**
- `api/companies.py`: `POST /companies/{id}/restart` (body: `contact_id`); surface
  `is_cold`/cycle info in detail + list cadence fields. `GET /companies/{id}/cycles` (history).
- `api/schedule.py`: add a `/schedule/cold` queue (current cycle EXHAUSTED).
- Tests: cap auto-stops at N; EXHAUSTED set; restart opens cycle 2 with fresh null anchor + new
  contact, old events intact, old cycle still queryable; cold queue scoping.

---

## Slice 3 — Project APIs + Project view (FE)

- `api/projects.py`: `GET /projects` (visibility-scoped: analyst → projects containing an
  assigned mandate; partner → all), `GET /projects/{id}` (engagements grouped by type + headline
  cadence/response stats), `POST/PATCH` (partner), archive/unarchive. Reuse `visible_mandate_ids`.
- Frontend: `frontend/hooks/use-projects.ts`; `app/(app)/projects/page.tsx` (analyst's "all
  projects I'm on" book) and `app/(app)/projects/[id]/page.tsx` (engagements as separated
  sell/buy/raise sections + stat headline + entry into each grid). Add Projects to the sidebar.
- Tests: project scoping (pytest); Vitest for grouping/stat rendering.

---

## Slice 4 — Sell/Buy working grid (FE, the heart)

- `app/(app)/projects/[id]/grid/...` (or an engagement grid route): dense, categorised
  (collapsible by `CompanyCategory`), keyboard-navigable, sticky headers table. Inline add-company
  row; show static facts + server-computed next-due/days-remaining/overdue + status + primary
  contact; inline "log a touch" without leaving the grid; "why overdue / why cold" tooltips and a
  "computed by the system" affordance on cadence numbers. Reuse existing `CadenceBadge`,
  `StatusBadge`, `useCompanies`, `useLogEvent`.
- Backend: ensure `/companies?mandate_id=&category=` supports the grid's grouping/filter; add
  `category` to filters + summary envelope.
- Tests: Vitest (grouping, keyboard nav, inline log); Playwright (add company inline → appears;
  log initial → cadence ticks).

---

## Slice 5 — MD / Partner overview (FE)

- `api/analytics.py`: `GET /analytics/projects` (firm-wide per-project + per-engagement health:
  progress, response rates, overdue load, cold count, per-analyst activity) — partner-gated via
  `require_role`. Confirm role model = ANALYST/PARTNER only (enum already reconciled to two;
  ASSOCIATE removed) — note in PROGRESS, no enum change.
- Frontend: partner overview page (all projects, each engagement's health, drill into any side).
- Tests: pytest (partner 200 / analyst 403, numbers vs seed).

---

## Slice 6 — Fuzzy warm-contact intelligence (backend) + inline nudges (FE)

- `services/cross_mandate.py`: add **application-side fuzzy** matching (rapidfuzz; add to
  `pyproject.toml`) over normalised names for typos/variants/subsidiaries — **advisory, never
  blocks**. Refactor the N+1: **batch** the schedule fetch for all candidate companies in one
  query (filtered to `is_current`), and cap/short-circuit candidate scanning so it scales as the
  firm book grows. Keep exact name/domain as high-confidence; fuzzy as lower-confidence with score.
- Surface nudges inline across project/engagement/grid and the global contact DB.
- Tests: fuzzy catches "Microsft"/"Tata" vs "Tata Sons" style variants; exact still works;
  single batched schedule query (no N+1); advisory (non-blocking) preserved.

---

## Slice 7 — Polish + design rationale

- **DESIGN.md** (written BEFORE the views in slices 3–5, per brief §8): high-density
  financial/deal-tool rationale (Bloomberg/Affinity/Linear-grade), using the available design
  skill + plan.md §7.3 tokens. Calm, dense, trustworthy, keyboard-first; not templated.
- Loading/empty/error states on every new view; optimistic TanStack updates; typed contracts;
  no dead links; mobile degradation. Keep snake_case JSON, ISO dates, §6.2 envelope, one model
  per file.

---

## Verification (whole phase)
- Backend: `cd backend && ./.venv/Scripts/python -m pytest` green after every slice;
  `alembic upgrade head` + `downgrade` clean on SQLite; `python -m app.seed.seed --reset` rich.
- Frontend: `cd frontend && npm test` (Vitest) + `npm run build` clean; Playwright critical paths.
- DoD walkthrough: analyst logs in → sees all their projects → opens a client → switches
  sell/buy grids → companies grouped by category with live cadence → adds a company + logs
  outreach inline → gets advisory dup/warm nudges → a company auto-goes COLD at the cap → swaps a
  contact + restarts into a NEW cycle (fresh anchor, history intact). Partner sees firm-wide
  project/engagement health and drills in. No email/webhook added. PROGRESS.md + DESIGN.md updated.

## Notes / risks
- The `unique(company_id)` → `unique(company_id, cycle_number)` swap needs Alembic
  `batch_alter_table` on SQLite (no in-place constraint drop). Test up+down explicitly.
- `bucket` is preserved (not dropped) to stay non-destructive; `category` is the new source of truth.
- Role model stays ANALYST/PARTNER (no ASSOCIATE) — reconcile in PROGRESS, don't add the enum value.
