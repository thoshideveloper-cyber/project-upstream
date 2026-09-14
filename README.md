# Project Upstream

A multi-tenant CRM for M&A / investment-banking deal sourcing. It productises three
spreadsheets (Master List, Email Schedule, Contact List) into one connected system.

- **Backend:** FastAPI + SQLAlchemy 2.0 (async) + Pydantic v2 + Alembic, JWT auth.
- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui + TanStack Query.
- **DB:** SQLite in dev, PostgreSQL in prod — one `DATABASE_URL` switches the engine.

The full spec is in [`plan.md`](plan.md); always-on agent context is in [`CLAUDE.md`](CLAUDE.md);
build status is tracked in [`PROGRESS.md`](PROGRESS.md).

## Live Application

| | URL |
|---|---|
| **Frontend** | https://frontend-theta-two-22.vercel.app |
| **API / Docs** | https://backend-production-0cef.up.railway.app/docs |

The deployment starts **empty on purpose**: Discover opens on the shipped database of 164 real
companies, and every other screen is blank until someone imports the firm's workbooks at
`/import`. A partner can clear that book again from **Settings → Workspace** and re-import.
`/signup` creates a separate firm with its own copy of the database and its own empty book.

### Login Credentials

> Password for all accounts: **`Passw0rd!`**

| Email | Role | Access |
|---|---|---|
| `partner@upstream.test` | Partner | Everything: all engagements, analytics, team, workspace reset |
| `analyst1@upstream.test` | Analyst | Assigned engagements only |
| `analyst2@upstream.test` | Analyst | Assigned engagements only |

See [`docs/Project_Upstream_User_Guide.pdf`](docs/Project_Upstream_User_Guide.pdf) for the full user guide.

## Prerequisites
- Python 3.11+
- Node 20.19+ recommended (20.18 works, but the Vitest scripts then rely on
  `--experimental-require-module`, wired in via `cross-env` so `npm test` still works)
- npm 10+
- (Optional) Docker, only for the local-Postgres path

## Backend

```bash
cd backend
python -m venv .venv
# Windows PowerShell:  .venv\Scripts\Activate.ps1
# macOS/Linux:         source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env            # PowerShell: copy .env.example .env

# apply migrations (none yet in Phase 0)
alembic upgrade head

# run the API (docs at http://localhost:8000/docs)
uvicorn app.main:app --reload
```

Health check: `GET http://localhost:8000/health` → `{"status": "ok"}`.

Initialising the database:

```bash
# The real day-one state: one firm, its users, and the shipped company database
# (164 real organisations). No projects, companies, contacts or schedules — those
# arrive when you import the firm's own workbooks at /import.
python -m app.seed.bootstrap --reset

# Optional: a Faker demo book, for when you want every UI state on one screen.
# Local SQLite only — it refuses to run against a managed database.
python -m app.seed.seed --reset
```

## Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # PowerShell: copy .env.local.example .env.local
npm run dev                         # http://localhost:3000
```

Set `NEXT_PUBLIC_API_URL` in `.env.local` to the backend origin (default
`http://localhost:8000`).

## Local Postgres (optional)

```bash
docker compose up -d
# backend/.env:
# DATABASE_URL=postgresql+asyncpg://upstream:upstream@localhost:5432/upstream
alembic upgrade head
```

## Testing

```bash
# Backend (94 tests)
cd backend && ./.venv/Scripts/python -m pytest        # Windows
cd backend && pytest                                   # macOS/Linux

# Frontend unit/component (Vitest)
cd frontend && npm test

# Frontend E2E (Playwright critical paths) — needs both servers + an initialised DB.
# The sweep suites expect the real onboarding: bootstrap, then the three phase_2
# workbooks imported as projects "GAIL" and "22by7", with analyst1 assigned to the
# book and analyst2 deliberately left with none.
cd backend && python -m app.seed.bootstrap --reset
# terminal 1:  cd backend  && uvicorn app.main:app --reload
# terminal 2:  cd frontend && npm run dev
# terminal 3:
cd frontend && npx playwright install   # one-time
cd frontend && npm run test:e2e
```

## Deploy

Two services: the **Next.js frontend → Vercel** and the **FastAPI backend → Railway / Render / Fly**.
They are different origins, so auth runs on cross-site cookies — configure both sides accordingly.

### Backend (Railway / Render / Fly)
Set environment variables:
- `DATABASE_URL=postgresql+asyncpg://USER:PASS@HOST:5432/DBNAME` — managed Postgres. **Switching
  the DB engine needs no code change**: SQLAlchemy + Alembic read this one URL (Alembic uses the
  sync driver via `settings.sync_database_url`, the app uses the async driver).
- `JWT_SECRET=<long random string>`
- `COOKIE_DOMAIN=<api domain>` and `CORS_ORIGINS=https://<your-vercel-app>.vercel.app`
- `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true` — **required** for the split-origin setup so the
  browser sends the httpOnly auth cookie on cross-site XHR. (`Lax`/insecure only works when the
  frontend and backend share a site, e.g. local dev.)

Release step: `alembic upgrade head` before starting `uvicorn app.main:app` (bind `$PORT`).

**A deployment starts empty.** Run the bootstrap once against the managed database and nothing
else — it creates the firm, its users, its vocabulary, and the shipped company database that makes
Discover searchable on day one:

```bash
DATABASE_URL=<the managed URL> python -m app.seed.bootstrap --reset
```

The book (projects, companies, contacts, schedules, outreach) is not seeded and never should be:
it arrives when the firm imports its own workbooks at `/import`, and a partner can clear it again
from **Settings → Workspace** to re-import cleanly. `app.seed.seed` fabricates Faker data and
refuses to run against a non-SQLite database for that reason. The local SQLite file itself is not
deployed; only what migrations and the bootstrap create.

### Who sees what
A **firm is the workspace**, so multi-tenancy needs no extra machinery: `/signup` creates a new
firm that comes up with the company database and an empty book, and nothing it imports is visible
to any other firm. The demo firm is just another tenant whose book happens to be loaded.

### Frontend (Vercel)
- `NEXT_PUBLIC_API_URL=https://<your-backend-host>` (the API origin; the typed client sends
  `credentials: "include"` on every request).

### CORS / cookies recap
The backend sets `allow_credentials=true` with an **explicit** origin (never `*`) — see
`app/main.py` reading `CORS_ORIGINS`. Cookies are httpOnly + Secure; refresh tokens rotate and are
server-side revocable (`token_version` = "log out everywhere"). No tokens ever touch JS/localStorage.

### Backups (F-04)
Enable the managed Postgres provider's **daily automated backups** (Railway/Render/Fly all offer
this). Because the app is soft-delete only (`archived_at`), point-in-time restore plus the archive
log together preserve institutional memory.
