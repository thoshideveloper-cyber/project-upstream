# Implementation Prompt — Sourcing Layer (research→active funnel + sourcing pool)

> Paste this as the task prompt for the engineer/agent building the Sourcing Layer feature
> on Project Upstream. It carries the full context, the redefinition we agreed, and the guardrails.

## Role & context
You are a senior full-stack engineer on **Project Upstream**, a multi-tenant M&A / investment-banking
deal-sourcing CRM. **Read `CLAUDE.md` and `PHASE2_REFINEMENT_PLAN.md` first.**
Stack (do not substitute): FastAPI + SQLAlchemy 2.0 (async) + Pydantic v2 + Alembic
(SQLite dev / Postgres prod via `DATABASE_URL`); Next.js 16 + React 19 + TS + Tailwind v4 +
shadcn/ui + TanStack Query + recharts; JWT in httpOnly cookies; pytest / Vitest / Playwright.

## What already exists (Phase 2a — shipped, do not rebuild)
- Hierarchy: **Firm → Project (client) → Mandate (engagement: sell/buy/raise) → Company
  (per-mandate row) → Contact → append-only OutreachEvent → computed cadence.**
- **Shared company-profile bridge** (`company_profiles` + `companies.profile_id`): one firm-wide
  record per company, enriched by every analyst; static facts (name/HQ/website/headcount/revenue)
  sync across engagements. `GET /company-profiles` is the firm-wide **Master List** (one row per
  company + its per-engagement placements). Dedup helpers: `normalise_name` / `extract_domain`
  (`services/cross_mandate.py`) + `services/profiles.py`; dry-run report at `scripts/dedupe_report.py`.
- **Firm-configurable category vocabulary** (`company_categories`): Strategic, PE, VC, Family
  Office, PMS, Private Credit, Investment Bank, Holding/Corporate, Other.
- **`sourcing_layers` table** currently = per-mandate ordered named bands. **This is being
  repurposed — see "The redefinition" below.**
- **Cadence engine**: `AWAITING_INITIAL` until the first `INITIAL_EMAIL` (the immutable clock
  anchor), bi-weekly follow-ups, follow-up cap → COLD (`EXHAUSTED`), restart-as-new-cycle. All
  computed server-side with `today_ist()` (Asia/Kolkata). Never store follow-up dates as columns.
- One `<AddCompany>` component (dialog everywhere), nested grid, response→contact capture with
  typed sentiment/mode, analytics by category and by layer.
- **Groq API keys** are in `backend/.env` (`GROQ_API_KEY`, `GROQ_API_KEY_2/3`) for later AI ranking.

## The redefinition (IMPORTANT — this OVERRIDES `PHASE2_REFINEMENT_PLAN` §7.3)
**"Sourcing layer" now means the research→active SOURCING FUNNEL (pipeline stages), NOT the
per-deal thesis/priority bands.** A company moves through ordered stages:

```
Research / Long-list  →  Shortlisted  →  Active outreach  →  Engaged  →  Passed
```

- **Stage** = the analyst's *manual* pipeline position.
- **Cadence** = the *computed* email clock — kept separate. Link: entering **"Active outreach"**
  prompts *"log the initial email?"* (starts the clock); **"Engaged"** lines up with a Response
  event. **COLD stays a derived cadence state, never a stage.**
- **Decision to confirm before the migration:** stages should be **firm-wide configurable** (one
  consistent funnel across all deals → clean "response-rate by stage" analytics), with each
  company/placement carrying a `stage_id`. Confirm the default stage names above.

## What the Sourcing Layer feature is (MVP scope)
The way an analyst **finds buyers / targets / investors for a mandate and pushes them into the CRM.**
MVP data = your own **proprietary IB analyst database** + **public sources** (manual/CSV). External
data feeds and AI ranking come **later** when scaling.

1. **Data ingest — IB analyst DB:** load the existing company/contact DB into a firm-scoped
   **sourcing pool**, **deduped & normalised** (reuse `normalise_name`/`extract_domain` +
   `company_profiles`). Imported companies enter at the **Research / Long-list** stage.
2. **Data ingest — public companies via CSV (MVP):** CSV import into the pool with column mapping
   and a **dry-run dedup preview** (like `dedupe_report.py`) before apply.
3. **Search the pool by mandate criteria:** filter by **sector/category, geography (HQ), size
   (revenue/headcount), type** → a firm-visibility-scoped candidate list.
4. **Push to Project + Side (the core workflow — one shared action):** available from BOTH the
   Sourcing Layer candidate list AND the Master List. The user picks a **Project**, then a **Side**
   (Sell-side / Buy-side / Capital-raise); the company is pushed into **that project's engagement of
   that side** — which becomes the analyst's active workspace (the grid). On push it:
   - creates the per-mandate company row **linked to the shared profile** (facts carry over, no
     re-typing);
   - sets stage = **Active outreach** and **starts the outreach cadence** (ready to log the initial
     email);
   - **derives company type from the side** (sell-side → Buyer, buy-side → Target, raise → Investor
     — never a manual "type" question);
   - shows **warm history** if worked before ("worked by Priya for GAIL — Positive, 18 May").
   **Side→engagement resolution:** one matching engagement → push straight in; several of that side
   → ask which; none of that side yet → offer to create it (partner) or show only existing sides.
   **Already present** in that engagement → surface it, never duplicate. One code path, two entry
   points (Sourcing Layer + Master List).
5. **Enrichment on candidate cards:** revenue, headcount, HQ, website, key contact — from the
   profile where available.
6. **(Later) pluggable external data sources:** design a provider interface so 3rd-party
   data/APIs can be added **without rework**.
7. **(Later) AI-assisted ranking:** rank candidates by fit to the mandate thesis using **Groq**
   (keys in `.env`). Design the candidate schema so a `fit_score` + `rationale` can attach later.

## Master List relationship (from our brainstorm)
- **Master List = the firm-wide pool** of ALL companies (Research stage + everything sourced), one
  row per company, all details from every analyst/partner.
- **Sourcing** = search that pool by mandate criteria → **push into a deal** (moves the company
  down the funnel to Active in that engagement). The **"Push to Project + Side"** action (#4) is
  the same on Master List rows and Sourcing Layer candidates.
- **Analyst default view = "My book"** (companies in my engagements, grouped by Project, sorted by
  what needs attention: overdue → due-soon → awaiting-initial → rest). **Partner** = firm-wide +
  group-by-analyst for overlap/conflict.
- Don't duplicate the engagement grid: **grid = work one deal deeply; My book / Master = the
  cross-deal pool and worklist.**

## Non-negotiables (do not violate)
- Outreach = **append-only** event log; cadence **computed** server-side; `AWAITING_INITIAL` +
  immutable `initial_date`; RESPONDED/BOUNCED/DECLINED (or `EXHAUSTED`) stop the clock; **COLD
  derived, never stored** as a status/stage.
- Everything **firm-scoped**; analyst visibility via mandate assignments; partners see all — reuse
  the visibility helper on every list endpoint.
- **Soft delete only** (`archived_at`); derived primary contact; httpOnly-cookie auth; secrets only
  in `.env`.
- **No email/webhook send this phase.**
- Migrations: **additive-first**, `batch_alter_table` on SQLite, tested `upgrade→downgrade→upgrade`;
  **dry-run dedup report before any dedup apply.**
- Keep **pytest + Vitest green**; update **PROGRESS.md** after each slice.

## Deliverable
A **sized, phased, checklisted build sequence** (backend-first per slice) covering: the stage model
+ migration (after confirming firm-wide stages + default names), the sourcing-pool ingest (IB DB +
CSV with dedup preview), pool search by mandate criteria, the "push to engagement" workflow (link
profile + start cadence + warm history), candidate enrichment cards, and the later-scale seams
(pluggable data-source interface + Groq AI-ranking hook). Include tests for each slice. Do **not**
start the migration until the firm-wide-stages decision and stage names are confirmed.
