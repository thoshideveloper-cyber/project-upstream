# Projects → a worked deal room: tasks, activity, members, delete

## Context

Upstream today answers *"what is the state of the book?"* — cadence, coverage, reply rates. It cannot
answer *"what is my team doing about it?"*. There is no task anywhere in the codebase (zero matches for
`task`/`todo` across `backend/app/` and `frontend/`), no audit trail (nothing has `updated_by_id`; an
edit to a company leaves only a moved `updated_at`), and assignment exists only at the engagement level
via `mandate_assignments`, reachable through one partner-only menu buried at
`frontend/app/(app)/projects/[id]/page.tsx:1382`.

The reference products you sent all solve the same missing half: a **counted sidebar hierarchy** you
navigate work from, **view tabs** over one dataset, an **activity stream** of who changed what, and
**tasks with an assignee, a due date and a priority**. That is the gap.

This plan adds four things and reflects them across every surface where they apply:

1. **Tasks** — polymorphic (project / engagement / company / contact / personal), four states
   BACKLOG → IN_PROGRESS → BLOCKED → DONE, with assignee, due date and priority.
2. **Activity feed** — an append-only `activity_events` log; per-project, per-company, and firm-wide.
3. **Project members** — assignment at the project level, plus a Team view.
4. **Archive + permanent delete** on projects.

`EXPANSION_PLAN.md` §5.6 already sketched `ActivityEvent` (P-04) and §14/15 scheduled it; it was never
built. This is that work, plus tasks, plus the UI shape you asked for.

### Decisions taken (from your answers)

| | Choice |
|---|---|
| Delete | Archive **and** permanent delete, **no role gate** — any user who can see the project can do either |
| Task shape | Polymorphic attachment + 4 states |
| Sidebar | Both **Projects** and **My work** expand, with live counts |
| Visual | Adapt the references' *structure*; keep Upstream's amber / hairline / tabular-nums skin (`frontend/lib/design.ts`) |

> One note on the delete gate, said once and then dropped: with no role gate an analyst can permanently
> destroy a client's whole book. The non-role rails below (must already be archived → 409, name
> confirmation, a preview showing exactly what dies) are what stands in the way instead. That was your
> call and the plan implements it as chosen.

---

## Architecture decisions

**A1 — Tasks use four nullable real FKs + a stored `scope`; activity uses `object_type` + `object_id`.**
Opposite requirements, opposite answers. Tasks get *filtered, joined and cascaded* — a generic
`object_id` makes "tasks on this project" four unindexable OR-branches and forces RBAC post-filtering in
Python, which makes `total` in the list envelope a lie. Activity rows are only *displayed*, over an
open-ended and growing object set, so they carry snapshots instead of foreign keys.

**A2 — `project_id` is denormalised onto every task and every activity row.** The sidebar counts become
one `GROUP BY project_id`; the delete cascade becomes one predicate. This is safe because neither hop is
ever reassigned: `MandateUpdate` (`backend/app/schemas/mandate.py:25`) has no `project_id`, and nothing
in the codebase assigns `company.mandate_id`. Pin the invariant with a canary test.

**A3 — Activity is written by explicit `activity.log(...)` at 12 curated call sites, guarded by a
route-inventory test.** Not by SQLAlchemy session listeners: `session.execute(delete(...))`
(`backend/app/api/workspace.py:169`, and the new project delete) fires **no ORM events**, so a differ
would silently miss the two most destructive paths in the app — the exact thing a partner most wants
logged. A differ also has no `current_user`, produces `status: NOT_CONTACTED→CONTACTED` where the product
wants "logged an initial email", and sees every row as dirty because every model has
`updated_at onupdate=func.now()`.

**A4 — Hard delete is a service with an explicit ordered step list, no DB-level `ondelete`.** There is no
`PRAGMA foreign_keys=ON` anywhere in `backend/` — SQLite here does **not** enforce FKs, so the comment at
`backend/app/api/workspace.py:55` claiming it does is wrong today. A DB cascade would work in prod and
silently not in dev/test, precisely where the destructive path lives.

**A5 — Project assignment grants visibility to the project, not to its mandates.**
`visible_mandate_ids` (`backend/app/core/deps.py:88`) is untouched; widening it would turn a project
assignment into a backdoor to every engagement's companies and break CLAUDE.md rule 5. Consequence: an
assigned-but-unmandated analyst sees the project shell, its tasks and its activity with an empty
engagements list. That is a decision, pinned by a test — not an oversight.

---

## Phase A — Foundations

### Backend

**Hoist the visibility helper.** Move `_visible_project_ids` from `backend/app/api/projects.py:42` into
`backend/app/core/deps.py` as
`visible_project_ids(user, db, *, include_archived: bool = False) -> list[int] | None`, alongside the
existing `visible_mandate_ids`. Delete the duplicate at `backend/app/api/workbook_imports.py:58`.

Three union terms: created-by ∪ projects-of-my-assigned-mandates ∪ **explicit project assignments** (new).

> The two current copies differ: `projects.py:71` filters `Mandate.archived_at.is_(None)`,
> `workbook_imports.py:76` does not. Default to the `projects.py` behaviour and have `workbook_imports`
> pass `include_archived=True`, or the hoist silently narrows what an analyst may import into.

The docstring must carry the `is not None` warning — partners get `None` (no filter), analysts get a
list; `if visible:` instead of `if visible is not None:` is a firm-wide leak.

**New enums** in `backend/app/models/enums.py`, following the existing
`SAEnum(..., native_enum=False)` convention (stored as VARCHAR, no CHECK — adding a member later needs no
migration):

```
TaskStatus:          BACKLOG | IN_PROGRESS | BLOCKED | DONE
TaskPriority:        LOW | MEDIUM | HIGH
TaskScope:           PROJECT | MANDATE | COMPANY | CONTACT | PERSONAL
ActivityObjectType:  PROJECT | MANDATE | COMPANY | CONTACT | TASK | OUTREACH_EVENT
                     | SCHEDULE | IMPORT_BATCH | SOURCING_CANDIDATE | PROJECT_ASSIGNMENT
                     | MANDATE_ASSIGNMENT
ActivityVerb:        (see Phase C)
```

`ActivityVerb` is an enum, not a bare string (an improvement on `EXPANSION_PLAN.md:379`) — CLAUDE.md
keeps enums in one file, and it costs nothing at the schema level. Document that the vocabulary is
**append-only**: `SAEnum` stores the member name, so renaming or deleting a verb makes old rows raise
`LookupError` on read.

**Three new models**, each one file (CLAUDE.md convention). Match the house datetime convention exactly:
`created_at`/`updated_at` are **naive** with `server_default=func.now()`; `archived_at`/`completed_at`
are `DateTime(timezone=True)`.

`backend/app/models/task.py`
```
id, firm_id (FK, idx), project_id (FK, NULL, idx), mandate_id (FK, NULL, idx),
company_id (FK, NULL, idx), contact_id (FK, NULL), scope (TaskScope),
title String(255), notes Text, status (default BACKLOG), priority (default MEDIUM),
due_date Date, assignee_id (FK users, NULL, idx), created_by_id (FK users, NULL),
completed_at tz-aware, archived_at tz-aware, created_at, updated_at
```
`__table_args__`: `Index("ix_tasks_project_status", "project_id", "status")`,
`Index("ix_tasks_assignee_status_due", "assignee_id", "status", "due_date")`, and a **named**
`CheckConstraint("ck_tasks_scope_consistent")` asserting `scope='PERSONAL'` ⇒ all four FKs NULL, and
otherwise `project_id IS NOT NULL`. SQLite *does* enforce CHECK even though it isn't enforcing FKs, so
this is the stronger guard. `assignee_id` and `created_by_id` both target `users.id` — both relationships
need explicit `foreign_keys=`. No `cascade=` on any relationship, matching
`backend/app/models/outreach_event.py:59`.

`backend/app/models/activity_event.py` — template is `outreach_event.py`: `created_at` only, no
`updated_at`, no `archived_at`.
```
id, firm_id (FK), project_id (FK, NULL), mandate_id (FK, NULL), company_id (FK, NULL),
actor_id (FK users, NULL, idx), actor_name String(255),      ← snapshot
verb (ActivityVerb), object_type (ActivityObjectType),
object_id Integer NULL, object_label String(255),            ← snapshot
meta JSON NULL, created_at
```
Three composite indexes that *are* the three read surfaces:
`(project_id, created_at)`, `(firm_id, created_at)`, `(company_id, created_at)`.

`backend/app/models/project_assignment.py` — mirrors `backend/app/models/mandate_assignment.py`, with
one deliberate deviation: **name the unique constraint**
`uq_project_assignments_project_user`. `mandate_assignment.py:18` leaves it unnamed, and the whole
docstring of `backend/alembic/versions/d5a7c9e1f3b8_drop_stray_schedule_company_unique.py` is the story
of an unnamed SQLite constraint that could not be dropped.

Register all three in `backend/app/models/__init__.py` (imports **and** `__all__`) — `alembic/env.py:20`
wraps `import app.models` in a `try/except ImportError`, so forgetting this produces a silently empty
autogenerated migration.

**Migration** — one revision, `down_revision = "d5a7c9e1f3b8"` (verified HEAD), filename
`<rev>_tasks_activity_project_assignments.py`. Create-only, parents before children, every index and
constraint explicitly named. `downgrade()` drops the three tables in reverse; no separate `drop_index`
calls. **No data backfill** — a feed backfilled from `created_at` would invent actors the schema does not
have. Note in the docstring that `render_as_batch=True` is irrelevant for a create-only migration, which
materially de-risks the `tests/test_migrations.py` round-trip.

**`backend/app/api/workspace.py` — mandatory, easy to miss.** `_BOOK` (`:59`) gains three entries in
child-first order: `activity_events` and `tasks` **before** companies/contacts/mandates/projects;
`project_assignments` **before** projects. `_firm_scope()` (`:76`) gains a `ProjectAssignment` branch
mirroring the `MandateAssignment` one at `:86` (it has no `firm_id`). Miss this and
`POST /workspace/reset` breaks on Postgres while passing on SQLite.

**New service** `backend/app/services/scope.py` — `resolve_scope(db, firm_id, *, project_id, mandate_id,
company_id, contact_id) -> ScopeChain`, walking `contact.company_id → company.mandate_id →
mandate.project_id` and validating every hop is inside the firm. Its own module so `activity.py` and
`tasks.py` never import each other.

**New helper** in `backend/app/core/time.py`: `to_naive_utc(dt)` for comparing API-supplied timestamps
against naive `created_at` columns (see Risks).

### Frontend

Extract the primitives the redesign needs, and collapse the duplication already in the tree:

- `frontend/components/ui/avatar.tsx` — `Avatar` + `AvatarGroup`. Replaces three hand-rolled copies:
  `projects/page.tsx:123` (`TeamStack`), `projects/[id]/page.tsx:1317`, and the hashed-colour
  `AVATAR_TONES` at `contacts/page.tsx:76` (keep the colour hashing — it is the best of the three).
- `frontend/components/ui/sheet.tsx` — lift the working right-side sheet out of
  `components/features/compose-email-sheet.tsx:415`; the `.sheet-pane` keyframes already exist at
  `app/globals.css:542`.
- `frontend/lib/format.ts` — hoist `fmtDate`/`MONTH`/`initials`, currently copy-pasted between the two
  projects files.
- `frontend/lib/design.ts` — add `TASK_STATUS_META`, `TASK_PRIORITY_META`, `ACTIVITY_TONE`. The file's
  own rule (`design.ts:10`) is that any role appearing on more than one screen is defined here and never
  re-spelled inline; tasks and activity appear on five screens each.

**Verification (A):** `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_migrations.py
tests/test_workspace.py -q` — the migration round-trips and a firm with the new tables still resets to
`book_total == 0`. `cd frontend && npm run build`.

---

## Phase B — Tasks

### Backend

`backend/app/services/tasks.py`
- `visible_task_filter(user, visible_project_ids) -> ColumnElement` — **the single source** of the RBAC
  predicate, so list / detail / summary / project-rollup cannot drift. Write `if visible is None: return
  true()` explicitly; an empty analyst list must yield a false predicate.
- `create_task` / `update_task` / `list_tasks` / `task_summary`. `update_task` sets `completed_at` on
  DONE and **clears it** when moved off DONE.
- Priority ordering **must** use a `sa.case()` rank — `TaskPriority` is VARCHAR, so `ORDER BY priority
  DESC` gives MEDIUM > LOW > HIGH. Default order:
  `(due_date IS NULL), due_date ASC, priority_rank DESC, id DESC` — the `IS NULL` trick rather than
  `NULLS LAST`, which older SQLite lacks.
- Overdue is `due_date < today_ist()` (`backend/app/core/time.py`), never `date.today()`.

`backend/app/schemas/task.py` — `TaskBase`/`TaskCreate`/`TaskUpdate`/`TaskStatusUpdate`/`TaskRead`/
`TaskSummary`. `TaskCreate` carries a `@model_validator(mode="after")` asserting **at most one** attach
FK is set — the caller says "on company 12" and the service derives the rest. `TaskRead` adds
`assignee_name`, `created_by_name`, `project_name`, `attached_to: {type, id, label}`, all filled by the
service, never by ORM lazy-load (touching an unloaded relationship on an async session raises — the
comment at `workspace.py:104` documents exactly this).

`backend/app/api/tasks.py`, `prefix="/tasks"`, registered in `backend/app/main.py`:

| Method | Path | Notes |
|---|---|---|
| GET | `/tasks` | `project_id, mandate_id, company_id, contact_id, assignee_id, status` (repeatable)`, priority, scope, due_before, overdue, q, include_done=False, include_archived=False, page, page_size` → `{items, total, page, page_size, summary}` |
| GET | `/tasks/summary` | **declare before `/tasks/{id}`** or `task_id: int` 422s on `"summary"` — same trap `main.py:72` guards for `/imports/workbook/*` |
| POST | `/tasks` | attachment validated through the existing `_get_visible_company` (`companies.py:773`) / `_get_visible_mandate` (`mandates.py:93`) / `_get_project` (`projects.py:200`) |
| GET/PATCH | `/tasks/{id}`, `/tasks/{id}/status` | |
| DELETE | `/tasks/{id}` | archive → 200 `{"detail": "Task archived"}` (house convention) |
| POST | `/tasks/{id}/unarchive` | |

No `GET /projects/{id}/tasks` — one list endpoint, one filter, one RBAC surface to test. The frontend
uses `/tasks?project_id=`.

`/tasks/summary` returns `{total, open, overdue, due_today, due_this_week, by_status, by_priority,
assigned_to_me, by_project[]}` — two grouped queries, no N+1, same discipline as `_compute_summary`
(`companies.py:335`). `by_project` only when `project_id` is absent.

**Edit rule:** anyone who can *see* a task may change its `status` — that is what makes it a shared
board. `title / notes / due_date / priority / assignee_id` require
`created_by_id == me OR assignee_id == me OR role == PARTNER`. **Personal tasks (`scope=PERSONAL`) are
owner-only, always, including against partners** — and must be excluded from a partner's firm-wide list.
Easy to miss; leaks if missed.

Extend `GET /projects` (`projects.py:218`) with `open_task_count` / `overdue_task_count` from **one**
`GROUP BY project_id` for the whole page — the router docstring (`:3`) advertises a fixed query count
regardless of mandate count; do not loop. Extend `GET /projects/{id}` with
`tasks: {open, overdue, by_status}`.

### Frontend

`frontend/hooks/use-tasks.ts` — `useTasks(filters)`, `useTaskSummary(projectId?)`, `useCreateTask`,
`useUpdateTask`, `useTaskStatus` (optimistic, mirroring `useUpdateCompany` in `use-companies.ts`),
`useArchiveTask`.

`frontend/lib/tasks.ts` — React-free, unit-testable: status/priority meta, `sortTasks`, `isOverdue`,
`groupByStatus`, `dueLabel`. Same split as `lib/outreach-timeline.ts` ↔
`components/features/outreach-timeline.tsx`.

New components under `frontend/components/features/`:
- `task-list.tsx` — the one reusable list: checkbox, title, project chip, due date (red when overdue),
  priority dot, assignee avatar, row menu. Used on the dashboard, the deal-room Tasks tab and `/tasks`.
  Includes an **inline add row** — type a title, Enter, done — which is the "analyst can add to-dos"
  ask; no dialog required for the common case.
- `task-dialog.tsx` — full create/edit (notes, assignee from `useUsers`, due date, priority,
  attachment picker). RHF + Zod, matching `mandate-dialog.tsx`.
- `task-board.tsx` — four columns by status, drag to move. Reuse the drag mechanics already proven in
  `components/features/pipeline-board.tsx` and its ink-token treatment.

New route `frontend/app/(app)/tasks/page.tsx` — List / Board views, filters (assignee, project, status,
priority, overdue), URL-persisted via the existing `useTableUrlState` + a module-scoped spec (the spec
**must** be module-scoped; see `hooks/use-table-url-state.ts`).

Sidebar: `nav.ts` gains a **My work** section → `/tasks`, and `sidebar.tsx` renders live children
`Backlog N / In progress N / Blocked N / Done N` from `useTaskSummary()`, each linking to
`/tasks?status=X`. Expand/collapse persists in `localStorage`, hydration-safe like
`hooks/use-column-visibility.ts`. Adding it to `NAV_SECTIONS` automatically adds a ⌘K page entry
(`command-palette.tsx:206`).

Reflect tasks everywhere they apply:
- **Dashboard** — a "My work" panel (see Phase E for the full re-order).
- **Deal room** — a Tasks tab (Phase E).
- **Company detail** (`companies/[id]/page.tsx`) — a Tasks section beside the existing Timeline tab.
- **Row menus** — "Add task" in the company row menu on Master List, Schedule and the book grid
  (`projects/[id]/page.tsx:462 RowActions`), pre-attached to that company.
- **Command palette** — a "New task" quick action.

**Verification (B):** `pytest tests/test_tasks.py -q`; `npm run test -- tasks`; then drive it live —
`preview_start` the frontend, create a task from the dashboard inline add, assign it, drag it across the
board, confirm the sidebar counts move.

---

## Phase C — Activity

### Backend

`backend/app/services/activity.py`

```python
async def log(db, *, actor, verb, object_type, object_id=None, object_label=None,
              project_id=None, mandate_id=None, company_id=None, meta=None) -> ActivityEvent
```

Two hard rules:
1. **`log()` never commits.** `db.add(...)` only (and `flush()` only if the caller needs an id). The
   caller's existing `await db.commit()` carries it, so the activity row and the mutation land in one
   transaction. An activity row that survives a rolled-back mutation is a lie. Several routers flush
   mid-request (`companies.py:1000`) — this matters.
2. **Actor comes from the call site.** Every mutating router already has `current_user: CurrentUser` in
   its signature, so identity is free — the exact thing a session listener cannot get.

Also `feed(db, *, firm_id, visible_project_ids, viewer_id, filters, page, page_size)` — the single query
all three read endpoints share.

**Verb vocabulary** (append-only from here on):
```
PROJECT_CREATED  PROJECT_UPDATED  PROJECT_ARCHIVED  PROJECT_UNARCHIVED  PROJECT_DELETED
PROJECT_MEMBER_ADDED  PROJECT_MEMBER_REMOVED
MANDATE_CREATED  MANDATE_UPDATED  MANDATE_ARCHIVED  MANDATE_UNARCHIVED
MANDATE_ASSIGNED  MANDATE_UNASSIGNED
COMPANY_CREATED  COMPANY_UPDATED  COMPANY_ARCHIVED  COMPANY_UNARCHIVED  COMPANY_STATUS_CHANGED
CONTACT_CREATED  CONTACT_UPDATED  CONTACT_ARCHIVED
OUTREACH_LOGGED  SCHEDULE_UPDATED  SCHEDULE_RESTARTED  EMAIL_SENT
CANDIDATE_ADDED  CANDIDATE_PUSHED  CANDIDATE_STAGE_CHANGED  IMPORT_APPLIED
TASK_CREATED  TASK_UPDATED  TASK_ASSIGNED  TASK_STATUS_CHANGED  TASK_ARCHIVED
```
No `TASK_COMPLETED` — emit `TASK_STATUS_CHANGED` with `meta={"from":…, "to":"DONE"}` and let the renderer
special-case it. `COMPANY_STATUS_CHANGED` earns its place because status drives cadence (rule 4) and a
partner will ask who changed it.

**First pass — exactly these 12 call sites:**

| Site | Verb |
|---|---|
| `projects.py:312` create | `PROJECT_CREATED` |
| `projects.py:407` update | `PROJECT_UPDATED` (meta: changed field names) |
| `projects.py:424` archive | `PROJECT_ARCHIVED` |
| new permanent-delete route | `PROJECT_DELETED` — written **after** the delete loop, `project_id=NULL` |
| new `/projects/{id}/assignments` | `PROJECT_MEMBER_ADDED` / `_REMOVED` |
| `mandates.py:138` create | `MANDATE_CREATED` |
| `mandates.py:262` / `:290` | `MANDATE_ASSIGNED` / `MANDATE_UNASSIGNED` |
| `companies.py:495` create | `COMPANY_CREATED` |
| `companies.py:952` log_event | `OUTREACH_LOGGED` — **one row**, meta `{event_type, occurred_on, sentiment}` |
| `sourcing.py:350` push | `CANDIDATE_PUSHED` |
| `imports.py:149` + `workbook_imports.py:385` | `IMPORT_APPLIED` (meta: source + counts) |
| new tasks router, all mutations | `TASK_*` |

**Deferred with reasons, not forgotten:** `companies.py:670` PATCH (needs a real field diff to be useful —
that is where `COMPANY_STATUS_CHANGED` belongs), contacts mutations, `email.py:478` send (`sent_emails` is
already its own log), candidate stage change, schedule patch/restart.
**Never instrumented:** all of `auth.py` (a security log is a different table with different retention),
every GET, import preview/inspect (nothing durable), AI scoring, draft.
**`WORKSPACE_RESET` cannot live in `activity_events`** — the table is book-tier and goes into `_BOOK`, so
a reset would wipe its own record; log it to the application logger instead.

**Guard: `backend/tests/test_activity_coverage.py`.** Walk `app.main.app.routes`, collect every
POST/PATCH/PUT/DELETE path, assert each is in either an `INSTRUMENTED` set or a `NOT_INSTRUMENTED`
allowlist carrying a one-line reason. A new endpoint then fails the suite until someone decides. This is
what stops the feed rotting by the next phase — it buys a session listener's completeness guarantee at
zero runtime cost.

`backend/app/api/activity.py`, `prefix="/activity"`:

| Method | Path | Visibility |
|---|---|---|
| GET | `/activity` | `firm_id == user.firm_id` AND (`project_id IN visible` OR `project_id IS NULL AND actor_id == me`) |
| GET | `/projects/{id}/activity` | `_get_project` first (correct 404), then `project_id == id` |
| GET | `/companies/{id}/activity` | `_get_visible_company` (`companies.py:773`), then `company_id == id` |

**Firm-wide for partners is just `GET /activity` with no filters — no separate endpoint, no role gate.**
`visible_project_ids` returns `None` for a partner so no project predicate applies; an analyst on the
same URL gets their own projects. One query to get right instead of two.

The `project_id IS NULL` rule is load-bearing: personal-task and firm-config rows are visible to partners,
and to analysts only where `actor_id == me`. Without it an analyst reads the firm's whole admin trail.

There is **no POST /activity, ever** — assert it with a 405 test.

### Frontend

`frontend/lib/activity.ts` — React-free and unit-testable, mirroring `lib/outreach-timeline.ts`: verb →
`{phrase, icon, tone, group}`, `groupByDay(events)`, `VERB_GROUPS` (Deal / Outreach / Data / People) for
the filter chips. Phrasing reads as a sentence: *"Rhea Kapoor logged an initial email · Acme Industries"*.

`frontend/hooks/use-activity.ts` — `useActivity(filters)` (infinite, like `useDueQueue` in
`use-schedule.ts`), `useProjectActivity(id)`, `useCompanyActivity(id)`.

`frontend/components/features/activity-feed.tsx` — day-grouped rows: actor avatar, verb icon in a tone
chip, sentence, object link, relative time. Filter chips across the top carrying counts, matching the
afternow reference (*All 136 · Notes 19 · Conversations 12 …*), driven by `VERB_GROUPS`. Empty and error
states via the existing `PanelEmpty` / `PanelError` (`components/analytics/states.tsx`).

Surfaces: deal-room **Activity** tab (Phase E), company detail (a second tab beside the existing
outreach Timeline — they are different things and both belong), a compact "Recent activity" panel on the
dashboard, and the firm-wide feed for partners.

**Verification (C):** `pytest tests/test_activity.py tests/test_activity_coverage.py -q`. Then live: log
an outreach touch and archive a project, and confirm both land in the project's Activity tab with the
right actor and phrasing.

---

## Phase D — Members, archive, permanent delete

### Backend — assignment

On the projects router, mirroring `mandates.py:262-302` beat for beat:

| Method | Path | Gate |
|---|---|---|
| GET | `/projects/{id}/members` | `CurrentUser` |
| POST | `/projects/{id}/assignments` `{user_id}` | `PartnerDep` |
| DELETE | `/projects/{id}/assignments/{user_id}` | `PartnerDep` |

The asymmetry with tasks (any user assigns a task; only a partner assigns a member) is intentional:
**task assignment allocates work, project assignment grants access.**

`GET /projects/{id}/members` returns the **union**, each row tagged `source ∈ {assigned, mandate,
creator}`. Critical: returning only the new table would show every existing project an empty team on day
one and the feature would look broken. The mandate-derived half is already computed at
`projects.py:182`.

Extend `GET /projects` with `members: [{id, full_name, source}]` from **one** query for the whole page.
**Keep the existing `team` key** — the frontend depends on it — and add `members` alongside.

### Backend — permanent delete

`backend/app/services/project_delete.py`, not the router: the ordered table list is domain knowledge
whose sibling lives in `workspace.py:59` and both should be reviewable side by side.

```python
_STEPS: list[tuple[str, Callable[[int], Delete]]]   # exported so tests assert ordering
async def preview_deletion(db, project) -> dict[str, int]
async def delete_project(db, project, *, actor) -> dict[str, int]
```

Scopes are **subquery expressions, never materialised Python lists** — SQLite caps bound parameters at
999 and a real project's company list will exceed it.

Deletion order (child-first; a subsequence of `_BOOK` with the three new tables inserted where their FKs
demand):

```
1  sent_emails          company_id IN company_ids
2  import_rows          (see the trap below)
3  import_batches       project_id == pid
4  activity_events      project_id == pid OR company_id IN company_ids
5  tasks                project_id == pid (+ defensive company/contact predicates)
6  outreach_events      company_id IN company_ids
7  outreach_schedules   company_id IN company_ids
8  contacts             company_id IN company_ids
9  sourcing_candidates  mandate_id IN mandate_ids     ← FKs companies, must precede them
10 companies            mandate_id IN mandate_ids     ← FKs sourcing_layers, must precede them
11 sourcing_layers      mandate_id IN mandate_ids
12 mandate_assignments  mandate_id IN mandate_ids
13 project_assignments  project_id == pid
14 mandates             project_id == pid
15 projects             id == pid
```

**Not deleted, and the docstring says why:** `company_profiles` — the *database* tier, which survives even
a workspace reset per CLAUDE.md's deployment model, so it must survive a project delete. Also
`saved_searches`, `sourcing_stages`, `company_categories`, email config, `users`.

**The `import_rows` trap.** `import_batches.project_id` is nullable (`import_batch.py:50`) — only
WORKBOOK batches set it. A CSV batch with `project_id IS NULL` can hold rows whose `resolved_company_id`
points into this project, and deleting the company leaves a dangling FK that Postgres rejects. Split step
2: delete rows belonging to this project's own batches, then **null the pointers** (`resolved_company_id`
/ `_contact_id` / `_schedule_id`) on other batches' rows rather than destroying their audit trail.

**Endpoints** — `POST`, not `DELETE`. `DELETE /projects/{id}` already means *archive* (`projects.py:424`)
and that convention is firm-wide; a distinct path can never be reached by a typo. `POST
/workspace/reset` is the precedent.

| Method | Path | Gate |
|---|---|---|
| GET | `/projects/{id}/deletion-preview` | `CurrentUser` |
| POST | `/projects/{id}/permanent-delete` `{confirm_project_name}` | `CurrentUser` — **no role gate, deliberate** |

**Safety rails, since the role gate is gone:**
1. **Refuse unless already archived → 409.** The best rail: it makes delete a deliberate two-step out of
   the normal flow, so a mis-click on the wrong row can only ever archive.
2. **Name confirmation** — 422 quoting the expected name, mirroring `workspace.py:159` including the copy.
3. **Visibility, not role** — route through `visible_project_ids(..., include_archived=True)`. Necessary:
   the default helper filters archived mandates, so an analyst whose only route in was via an archived
   mandate would 404 on their own project at exactly the moment rail 1 requires it to be archived.
4. **Dry-run preview** — the dialog says *"this removes 412 companies and 1,203 outreach events"*. This
   rail does more work than the name box: the name box prevents mis-clicks, the counts prevent
   misunderstandings.
5. **Tombstone outside the deleted data** — `PROJECT_DELETED` written **after** the loop with
   `project_id=NULL` and `meta={project_id, name, client_name, counts}`, in the same transaction. Written
   before, step 4 deletes it. Also `logger.warning`, so the record survives a later workspace reset.

One `commit()` at the end, no try/except swallowing. On Postgres a mis-ordered delete raises
`ForeignKeyViolation` → 500 with nothing lost. That is a good failure mode; keep it.

Add a docstring paragraph in the style of `workspace.py:12` naming this the **second deliberate exception
to CLAUDE.md rule 6**, and stating the role gate was removed on purpose. Update CLAUDE.md's rule 6 to
name both exceptions.

### Frontend

- `frontend/hooks/use-projects.ts` — add `useProjectMembers`, `useAssignProjectMember`,
  `useUnassignProjectMember`, `useDeletionPreview`, `useDeleteProject`.
- `frontend/components/features/project-members.tsx` — member rows with `source` badges, an add picker
  from `useUsers()` (partner only), remove with confirm. Replaces the buried `TeamDialog`
  (`projects/[id]/page.tsx:140`), which stays for *engagement* team.
- `frontend/components/features/delete-project-dialog.tsx` — counts from the preview + a name box, styled
  after the reset dialog in `components/features/workspace-card.tsx:187`.
- **Un-gate archive.** Remove `isPartner` from the archive menu items at `projects/page.tsx:258` and
  `projects/[id]/page.tsx:1232`; keep `useConfirm` + `toastUndo`. Add "Delete permanently" to both menus,
  rendered **only when the project is archived**.
- Replace the `Show archived` toggle (`projects/page.tsx:514`) with a segmented **Active / Archived /
  All** filter, URL-persisted via `useTableUrlState`.

> `frontend/tests/e2e/projects.spec.ts` asserts `getByRole("menuitem", {name: /archive/i})` and
> `getByRole("button", {name: "Archive"})`. Keep an "Archive project" menu item with that exact wording so
> the existing spec stays green, and extend it rather than rewriting it.

**Verification (D):** `pytest tests/test_project_delete.py tests/test_project_members.py -q`. Live: create
a throwaway project, archive it, open the delete dialog, confirm the counts are right, type the name,
delete — then confirm a sibling project is untouched.

---

## Phase E — The redesign itself

### Deal room — view tabs (`frontend/app/(app)/projects/[id]/page.tsx`)

Today the page is masthead → book rail → grid, one view only. Add a view switcher under the book rail —
this is the "views separated" ask, and the same move the Relatel reference makes with
*Spreadsheet / Board / Calendar / Timeline*:

| View | Content |
|---|---|
| **Book** (default) | today's `BookGrid` — unchanged |
| **Board** | companies as a kanban by status, reusing `components/features/pipeline-board.tsx` |
| **Tasks** | `task-list` / `task-board` filtered to `?project_id=` |
| **Activity** | `activity-feed` with verb-group filter chips |
| **Team** | `project-members` + per-engagement analysts |

URL becomes `?book=N&view=book|board|tasks|activity|team`. **Replace the raw
`window.history.replaceState` at `projects/[id]/page.tsx:1169` with `useTableUrlState`** and a
module-scoped spec — the app already standardised on it (`contacts/page.tsx:834`, `master/page.tsx:449`)
and this file is the last hand-rolled holdout.

The masthead gains a members `AvatarGroup` (replacing the inline stack at `:1317`) and task vitals in the
existing vitals sentence — *"3 engagements · 274 companies · 49% replied · 50 late · 7 open tasks"*.

The file is already 1438 lines. Split as part of this work: `BookGrid` and its row components move to
`components/features/book-grid.tsx`, leaving the page as a shell that composes views.

### Sidebar hierarchy (`frontend/components/layout/nav.ts` + `sidebar.tsx`)

Both groups expand, with live counts, matching your reference:

```
Dashboard
MY WORK  ▾                      ← new section, /tasks
  Backlog        12
  In progress     4
  Blocked         1
  Done           31
PIPELINE
  Projects  ▾                   ← now expandable
    Medanta Healthcare    3 late
    GAIL                 47 late
    22by7                 3 late
    All projects →
  Import · Sourcing · Master List
OUTREACH   Schedule · Contacts
INSIGHTS   Analytics · Project health (partner)
ADMIN      Settings (partner)
```

`nav.ts` stays the static declaration and keeps `roles?: Role[]`, `visibleNav`, `visibleNavSections`
(the command palette depends on both). Add an optional
`expandable?: { source: "projects" | "tasks" }` marker; `sidebar.tsx` resolves it at render from
`useProjects()` / `useTaskSummary()`. Show the top 8 active projects, attention-sorted, then
"All projects →". Expansion state persists in `localStorage`, hydration-safe. Also fix the small existing
drift: `sidebar.tsx:22` re-spells the `LABEL` token inline instead of importing it.

### Dashboard — the analyst's home becomes a doing surface

You asked for the analyst home to be "not analytics but more like they can do". Reorder by role rather
than building a second page — every figure is already server-scoped:

**Analyst:** `DeskBriefing` (keep — it is the signature) → **My work** (task list with inline add) beside
**Today's focus** (the existing cadence queue) → **Recent activity** → then `BookTape` and the charts,
below the fold.

The pairing is the point: *Today's focus* is work the cadence engine **derived**; *My work* is work a
person **declared**. Both belong on the same screen, and neither replaces the other.

**Partner:** `DeskBriefing` → `BookTape` → **Desk activity** (firm-wide feed) + **Team workload** (open
and overdue tasks by analyst, linking to `/tasks?assignee_id=`) → the existing charts. This is the
"partner sees the analyst view, can assign and see changes" ask.

### Projects list (`frontend/app/(app)/projects/page.tsx`)

Keep the `SidesSpectrum` signature — it is the page's best idea. Additions per row: members
`AvatarGroup` (via the shared component), open/overdue task counts in the health line, archive + delete
in the row menu. Replace local-only search/sort with `useTableUrlState` so a filtered deal floor is
linkable. Also collapse the duplication at `projects/page.tsx:54` where `SIDE_BAR` / `SIDE_SHORT` /
`SIDE_LABEL` re-spell `DEAL_TYPE_*` from `lib/design.ts` at a different opacity.

### Uniform reflection

| Surface | Change |
|---|---|
| Company detail | Activity tab beside the outreach Timeline; Tasks section |
| Contact detail | Task quick-add |
| Master List / Schedule / book grid row menus | "Add task", pre-attached |
| Command palette | "New task" quick action; My work + project pages from `visibleNav` |
| Settings | Members visible per project (read-only roll-up) |

---

## Verification

**Backend** — `cd backend && ./.venv/Scripts/python.exe -m pytest -q` (root `.venv` lacks rapidfuzz).
New files, house naming (`test_<feature>.py`, module-local `_login(client, creds)` helper —
there is no `auth_client` fixture):

- `tests/test_tasks.py` — all five scopes derive the right `project_id`; two attach FKs → 422; the full
  status walk with `completed_at` set **and cleared**; archive/unarchive. RBAC: task on an invisible
  project → **404** (not 403, matching `projects.py:211`); analyst A PATCHing analyst B's title → 403 but
  its **status** → 200 (both halves of the edit rule); a partner sees both analysts' tasks; **an
  analyst's PERSONAL task is absent from the partner's firm-wide list**; cross-firm → 404.
  Plus a literal regression test that `/tasks/summary` resolves before `/tasks/{id}`.
- `tests/test_activity.py` — one row per mutation with the right verb/actor/resolved `project_id`; a
  request ending in 422 leaves the activity count unchanged (same transaction); firm scoping;
  project-visibility scoping; `project_id IS NULL` rows visible only to their actor and to partners;
  `POST /activity` → 405.
- `tests/test_activity_coverage.py` — the route-inventory guard.
- `tests/test_project_delete.py` — **its own engine fixture with `PRAGMA foreign_keys=ON` on connect**
  (module-local, not in `conftest.py`, which may break fixtures that insert children before parents).
  This is the only place the delete ordering is genuinely exercised. Fixture: a full project *plus a
  sibling project*; the sibling being untouched is the single most important assertion. Also:
  `company_profiles` survive; wrong name → 422; not archived → 409; **an analyst who can see the project
  CAN delete it** (assert explicitly, so nobody later "fixes" it into a partner gate); a CSV batch's row
  has its `resolved_company_id` nulled while the batch survives; the `PROJECT_DELETED` tombstone survives
  with `project_id IS NULL`.
- `tests/test_project_members.py` — partner assigns (idempotent), analyst → 403, `/members` union with
  correct `source` labels, and the A5 asymmetry: an assigned-but-unmandated analyst gets the project with
  empty engagements while `GET /companies` stays empty.
- `tests/test_migrations.py` (extend) — upgrade/downgrade/upgrade round-trip, **plus model↔migration
  column parity** (`_columns(url, "tasks") == set(Task.__table__.columns.keys())`). `conftest.py:41`
  builds the test schema from `Base.metadata.create_all`, not Alembic, so a migration that forgets a
  column passes every functional test and fails only in prod — this codebase has already been bitten by
  exactly that (`d5a7c9e1f3b8`).
- `tests/test_workspace.py` (extend) — a firm with tasks, activity and project assignments resets to
  `book_total == 0`; catches a missing `_firm_scope` branch.

**Frontend** — `cd frontend && npm run test` (Vitest): new `tests/tasks.test.ts` (sort, overdue,
priority rank), `tests/activity.test.ts` (verb phrasing, day grouping), extend `tests/projects.test.ts`.

**Playwright** — `npx playwright test`. New `tests/e2e/tasks.spec.ts` (create → assign → move → done →
sidebar counts move) and `tests/e2e/activity.spec.ts`. Extend `tests/e2e/projects.spec.ts` for
archive → delete-preview → name-confirm → delete. `tests/e2e/audit.spec.ts` walks every route as both
roles for a11y — `/tasks` and the new tabs must pass at zero violations, matching the P5 bar. Specs run
serial by design; portalled menus need the `z-50` treatment noted in the existing email-pipeline work.

**Live** — run both servers, then drive the real app with the browser tools rather than asking you to
check: create a task from the dashboard, watch the sidebar count change, open a project, move it across
the board, read the Activity tab, then archive-and-delete a throwaway project and confirm a sibling
project survives. Screenshots for before/after (`frontend/screenshot-projects.js` already exists).

---

## Risks

1. **`if visible:` vs `if visible is not None:`** — `visible_mandate_ids` returns `None` for PARTNER.
   `projects.py:66` uses `if visible:` and happens to be correct, but it is one refactor from a firm-wide
   leak. Write the explicit form in `visible_task_filter` and `activity.feed`.
2. **`workspace._BOOK` ordering** — three new tables plus a `_firm_scope` branch. Wrong order breaks
   `POST /workspace/reset` on Postgres while passing on SQLite.
3. **SQLite does not enforce FKs here at all** — the highest-impact gotcha. A wrong deletion order passes
   every test and fails only in prod. Mitigated by the FK-enforcing test engine and by asserting the
   returned counts are non-zero for every expected table.
4. **Naive vs aware datetimes on Postgres** — `created_at` is naive, `archived_at`/`completed_at` are
   tz-aware. Normalise `?since=`/`?until=` through `to_naive_utc`; compare `due_date` to `today_ist()`,
   never `date.today()`.
5. **Actor-name N+1 — do not copy `OutreachEventRead`**, which exposes `owner_id` with no name and makes
   the frontend join via `/users`. A firm-wide feed page references dozens of objects the client has not
   loaded, and after a delete those objects no longer exist. Snapshot `actor_name`/`object_label` at write
   time; renames not propagating into history is correct for an append-only log, not a bug.
6. **Route ordering** — `/tasks/summary` before `/tasks/{task_id}`.
7. **`GET /projects` query budget** — tasks and members add exactly two grouped queries for the whole
   page, never two per project.
8. **Priority sorts wrong alphabetically** — VARCHAR gives MEDIUM > LOW > HIGH; use a `sa.case()` rank.
9. **Name every constraint and index** — `mandate_assignment.py:18` leaves its unique unnamed, and
   `d5a7c9e1f3b8` exists because an unnamed SQLite constraint could not be dropped.
10. **Scope-denormalisation canary** — `assert "project_id" not in MandateUpdate.model_fields`, with a
    comment saying that adding it would stale every denormalised `project_id`.

---

## Files

**New (backend):** `models/task.py`, `models/activity_event.py`, `models/project_assignment.py`;
`schemas/task.py`, `schemas/activity.py`; `services/tasks.py`, `services/activity.py`,
`services/scope.py`, `services/project_delete.py`; `api/tasks.py`, `api/activity.py`; one Alembic
revision off `d5a7c9e1f3b8`; five test modules.

**Modified (backend):** `core/deps.py` (hoisted `visible_project_ids`), `core/time.py`, `models/enums.py`,
`models/__init__.py`, `main.py`, `api/projects.py` (members, delete, task counts), `api/workspace.py`
(`_BOOK`, `_firm_scope`), plus the 12 instrumented call sites across `mandates.py`, `companies.py`,
`sourcing.py`, `imports.py`, `workbook_imports.py`.

**New (frontend):** `ui/avatar.tsx`, `ui/sheet.tsx`; `features/task-list.tsx`, `task-dialog.tsx`,
`task-board.tsx`, `activity-feed.tsx`, `project-members.tsx`, `delete-project-dialog.tsx`,
`book-grid.tsx`; `lib/tasks.ts`, `lib/activity.ts`, `lib/format.ts`; `hooks/use-tasks.ts`,
`use-activity.ts`; `app/(app)/tasks/page.tsx`.

**Modified (frontend):** `layout/nav.ts`, `layout/sidebar.tsx`; `projects/page.tsx`,
`projects/[id]/page.tsx`; `dashboard/page.tsx`; `companies/[id]/page.tsx`, `contacts/[id]/page.tsx`,
`master/page.tsx`, `schedule/page.tsx` (row menus); `features/command-palette.tsx`; `lib/design.ts`;
`hooks/use-projects.ts`; `types/index.ts`.

**Docs:** `CLAUDE.md` (rule 6 now names two exceptions), `PROGRESS.md` (a new track section per house
convention).
