# Project Upstream — Sourcing Layer Implementation Plan

### The research→active sourcing funnel + firm-wide pool + "Push to Project + Side" + AI ranking

> **Status:** Plan only. No code in this document. Grounded in `CLAUDE.md`, `PHASE2_REFINEMENT_PLAN.md`
> (esp. the §12 amendment), `SOURCING_LAYER_PROMPT.md`, and the current codebase (models, services,
> routers, frontend). File/line references are clickable. Scope = **the full feature: MVP + every
> "later" item (pluggable data sources + AI ranking) implemented now.**
>
> **Five hats.** Each section is written wearing all five: 🖥️ frontend, 🔗 full-stack, 🧭 product,
> 📋 PM, 🔎 reviewer/critic. §7 is the explicit four-perspective critique.
>
> **How to read this:** §0 research summary + decisions it drives · §1 the reconciliation &
> stage-model decision · §2 data model + migrations · §3 backend API surface · §4 frontend surfaces ·
> §5 AI design · §6 sized/phased/checklisted build sequence · §7 four-perspective review · §8
> supporting features to add elsewhere · §9 non-negotiables traceability.
>
> **Revision note (post-critic-review).** This revision resolves seven review findings: the
> pool-vs-placement stage split (the funnel now lives on a new `sourcing_candidates` (mandate ×
> profile) row, **not** `companies.stage_id`); httpx moved to **runtime** deps; a **verify-Groq-facts
> gate** before SL-8 (external specs below are a July-2026 snapshot, not gospel); **batched**
> warm-history (profile-id join, not per-row `find_duplicates`); an explicit **AI data-egress /
> confidentiality** control (§5.7); firm-wide **pool browsing** vs visibility-scoped overlays; and an
> explicit **`sourcing_layers` deprecation** to kill the naming collision. Changes are flagged inline.

---

## 0. Research summary (cited) and the decisions it drives

Sources are engineering blogs, government/academic write-ups, primary vendor docs, and papers —
chosen over SEO-farm content. Each finding is tied to a concrete decision in this plan.

### 0.1 Entity resolution / company dedup at scale

- **Fellegi–Sunter + blocking is still the backbone.** Modern record linkage computes a pairwise
  *match weight* from field-level agreement/disagreement, and uses **blocking** (candidate
  generation) to avoid the O(n²) all-pairs comparison — you only compare records that share a block
  key. Three outcomes per pair: *link*, *possible link* (send to human review), *non-link*
  ([Enríquez et al., "(Almost) All of Entity Resolution", arXiv 2008.04443](https://arxiv.org/pdf/2008.04443);
  [UK Gov Digital, "Splink: fast, accurate and scalable record linkage"](https://dataingovernment.blog.gov.uk/2022/09/23/splink-fast-accurate-and-scalable-record-linkage/)).
- **Partial match weights + a review tier.** Splink (UK Ministry of Justice) weights fields by
  discriminating power (a domain match ≫ a country match), combines them into a score, and ships
  **interactive visualisations to QA the model and explain predictions** — i.e. matching is
  auditable and human-reviewable, never a silent auto-merge ([Splink blog, above]).
- **Decisions it drives:** We already have the right primitives — `normalise_name` +
  `extract_domain` + tiered `find_duplicates` (exact_domain 1.0 → exact_name 1.0 → fuzzy
  `token_set_ratio ≥ 80`) at [cross_mandate.py:46-181](backend/app/services/cross_mandate.py#L46),
  and a **dry-run cluster report** at [dedupe_report.py](backend/scripts/dedupe_report.py). The pool
  ingest **reuses these unchanged**: `extract_domain` is our primary block key, `name_key` the
  secondary. The dry-run report becomes a **mandatory gate** before any apply, and the fuzzy
  (`0.80–0.99`) tier maps to Splink's "possible link" → **human-in-the-loop review queue** in the
  CSV importer, never auto-merged. No new matching engine; we scale what exists.

### 0.2 LLM-based ranking / lead scoring

- **Chain-of-thought before the score; anchored rubrics; low-cardinality outputs.** Forcing the
  model to reason first and emit a structured verdict improves reliability; excluding a reference
  answer causes the biggest quality drop, so **anchor examples ("what a 20 vs 60 vs 90 looks like")
  are the highest-value calibration lever**; binary/low-cardinality outputs beat free-form scores
  ([Eugene Yan, "Evaluating LLM-Evaluators"](https://eugeneyan.com/writing/llm-evaluators/);
  [Li et al., "LLMs-as-Judges: A Comprehensive Survey", arXiv 2412.05579](https://arxiv.org/html/2412.05579v2)).
- **Ground strictly in provided evidence to avoid hallucinated facts.** "Evidence-anchored" scoring
  — where the score must be justified only by supplied facts, not the model's world knowledge —
  materially reduces fabrication ([Hong et al., "From Rubrics to Reliable Scores" (Rulers), arXiv 2601.08654](https://arxiv.org/abs/2601.08654)).
- **Bias + evaluation.** Judges exhibit **position bias** (up to ~70% toward the first item) and
  **verbosity bias**; mitigate by randomising order or scoring pointwise, and **evaluate the
  evaluator with Cohen's κ** against analyst labels rather than correlation alone ([Eugene Yan, above]).
- **Decisions it drives:** (1) **Pointwise scoring** (each company scored independently against the
  mandate thesis) — sidesteps listwise position bias, makes the per-(mandate×company) cache
  reusable, and degrades gracefully under rate limits. (2) **Strict JSON schema** output:
  `fit_score` (0–100), `band`, per-dimension subscores, `rationale` (≤240 chars), and an
  `insufficient_data` flag. (3) **Rubric with anchor bands** baked into the system prompt. (4)
  **"Score only from the facts below; if a fact is absent, do not assume it — lower confidence"** —
  the anti-hallucination clause. (5) **Evaluation harness**: a small analyst-labelled set, Spearman
  rank-corr + Cohen's κ, score-distribution drift alerts.

### 0.3 Groq API specifics (drives the AI implementation)

> ⚠️ **Snapshot, not gospel (review finding #3).** The specifics below were fetched from Groq's live
> docs during this research (July 2026). Model IDs, strict-schema support, and rate limits **change
> monthly** — SL-8 carries a hard **re-verify gate** (§6) that re-checks these against live docs and
> confirms every cited source resolves *before* any Groq code is written. Do not hardcode these
> numbers as permanent fact.

From the primary docs ([Groq — Structured Outputs](https://console.groq.com/docs/structured-outputs),
[Groq — Supported Models](https://console.groq.com/docs/models), [Groq — Tool Use](https://console.groq.com/docs/tool-use)):

- **Structured Outputs.** `response_format: { type: "json_schema", json_schema: {…} }`. **Strict
  mode** = constrained decoding, "100% schema adherence, never invalid JSON" — but currently only on
  **`openai/gpt-oss-120b`** and **`openai/gpt-oss-20b`**. Strict requires **all fields `required`,
  `additionalProperties: false`, and optional fields modelled as `["type", "null"]` unions**.
  Best-effort mode also covers `meta-llama/llama-4-scout-17b-16e-instruct`. **Streaming and tool use
  are NOT supported together with Structured Outputs** — fine for us (we need neither for scoring).
- **Recommended models.** `llama-3.3-70b-versatile` (131k ctx, general) and `llama-3.1-8b-instant`
  (fastest/cheapest) are the general-purpose picks; `openai/gpt-oss-120b` (~500 t/s) and
  `openai/gpt-oss-20b` (~1000 t/s) are the ones that support **strict** structured output.
- **Rate limits.** Free tier ≈ **30 req/min and 6,000 tokens/min, per-model, per-key**, resetting
  each minute ([Groq rate-limit guidance / changelog](https://console.groq.com/docs/changelog)).
- **Decisions it drives:** (1) **Primary model `openai/gpt-oss-120b` in strict mode**; **fallback
  `openai/gpt-oss-20b`** (faster, also strict) then **`llama-3.3-70b-versatile`** best-effort with a
  JSON-repair pass. (2) **Key rotation across `GROQ_API_KEY` / `_2` / `_3`** = 3× the per-key RPM/TPM
  headroom; round-robin with per-key cooldown on HTTP 429. (3) **Batch N companies per request** (cap
  ~15–20, TPM-bounded) and **cache aggressively** to stay under limits. (4) A **thin httpx client**
  against Groq's OpenAI-compatible endpoint (rather than the `groq` SDK) so key rotation, timeouts,
  and fallback are fully under our control. **⚠️ Fix (review finding #2):** httpx is currently a
  **dev-only** dependency — under `[project.optional-dependencies].dev` at [pyproject.toml:32](backend/pyproject.toml#L32),
  **not** in runtime `dependencies` (lines 10–26), and no `app/` code imports it today. SL-8 **must
  add `httpx` to runtime `dependencies`** or the client 500s in prod ("works in tests, fails in
  prod"). Alternative: adopt the `groq` SDK (a runtime dep either way).

### 0.4 Sourcing / pipeline funnel UX

- **Offer both kanban and list over the *same* data, same filters.** Kanban answers "what stage is
  this in?" at a glance and enables **drag-to-change-stage in one motion**; list wins for sorting,
  filtering, and **bulk operations**. The anti-pattern is two separate systems; the pattern is one
  dataset, two views, shared saved filters ([synthesised from sales-pipeline view comparisons];
  principles from [NN/g, "Data Tables: Four Major User Tasks"](https://www.nngroup.com/articles/data-tables/)).
- **Bulk actions need: Select-All, a contextual action bar, clear feedback + Undo** ([NN/g, "Bulk
  Actions: 3 Design Guidelines"](https://www.nngroup.com/videos/bulk-actions-design-guidelines/)).
- **Progressive disclosure** for candidate cards / add forms: show the essentials, defer advanced
  fields ([NN/g, "Progressive Disclosure"](https://www.nngroup.com/articles/progressive-disclosure/)).
- **Decisions it drives:** The per-mandate **Sourcing funnel = kanban** (columns = stages,
  drag-to-advance, WIP counts) **and list** (bulk shortlist/push/assign, sort by AI score/cadence),
  toggled on one dataset with shared filters + **saved searches**. Candidate cards use progressive
  disclosure (facts first, enrichment/AI-rationale on expand). Bulk push/shortlist get a contextual
  action bar with Undo.

### 0.5 CSV ingestion UX / architecture

- **Canonical flow: file → parse → map → validate → submit**, with delimiter/encoding
  auto-detection, a **preview** (headers + first rows), a downloadable **template**, and an **error
  review step** (counts by type, filter to bad rows, download to fix & re-upload). Push cheap checks
  client-side, business/referential checks server-side.
- **Idempotent re-import.** Upsert requires a stable **identifier** (domain/name key here); dedup
  *before* insert; design handlers to be idempotent (dedup keys / `ON CONFLICT`).
  (Domain-expert write-ups: [Dromo — "5 best practices…"](https://dromo.io/blog/5-best-practices-to-streamline-your-csv-import-process),
  [OneSchema — "Building a CSV uploader"](https://www.oneschema.co/blog/building-a-csv-uploader),
  [CSVBox — "Validate CSV before DB"](https://blog.csvbox.io/validate-csv-before-db/) — cited as
  domain sources, treated as secondary to the principled UX sources above.)
- **Decisions it drives:** CSV import is a **4-step wizard** (Upload → Map → Validate & dedup preview
  → Apply), keyed for **idempotency by `domain_key`/`name_key`** and reusing `upsert_profile`. Every
  import is an auditable **`import_batches`** row; re-importing the same file/rows **upserts profiles,
  never duplicates**. The **dedup preview reuses `dedupe_report.py`'s clustering** so the analyst sees
  merges before apply — exactly the Splink "possible link" review tier.

---

## 1. The stage-model decision (the one thing to confirm before migrating)

### 1.1 Decision: stages are **firm-wide configurable** (recommended), not per-deal

**Default ordered stages (confirm names):**
`Research / Long-list → Shortlisted → Active outreach → Engaged → Passed`.

**Why firm-wide, not per-deal (the justification the prompt asks for):**
- **Comparable analytics.** "Response-rate by stage", "funnel conversion", and "time-in-stage"
  across every deal only mean something if the stages are the same vocabulary everywhere. Per-deal
  stages make cross-mandate roll-ups (the partner's core need) impossible — the same mistake the old
  6-value category enum vs free-text `bucket` made ([PHASE2_REFINEMENT_PLAN §4 BUG-10](PHASE2_REFINEMENT_PLAN.md)).
- **One funnel to learn.** Analysts move between deals; a single funnel is muscle memory.
- **Still flexible.** Firm-configurable (partner-managed vocabulary, like `company_categories` at
  [company_categories.py](backend/app/api/company_categories.py)) means a firm can rename/reorder/add
  a stage without a migration — we get consistency *and* self-service.
- **Trade-off (named):** a firm-wide funnel can't encode deal-specific thesis bands. That's fine —
  **thesis/priority bands were the *old* meaning of "sourcing layer"** ([PHASE2_REFINEMENT_PLAN §7.3](PHASE2_REFINEMENT_PLAN.md)),
  now **superseded** by this funnel per the §12 amendment. Bands, if still wanted, survive as an
  optional secondary grouping on the existing `sourcing_layers` table (see §1.2).

### 1.2 Reconciling "repurpose `sourcing_layers`" with additive-first migrations

The top-level brief says *"`sourcing_layers` … to be repurposed as the funnel"*; the detailed
`SOURCING_LAYER_PROMPT.md` redefinition says *"each company/placement carrying a `stage_id`."* These
point at a **new `stage_id`**, and the existing [`sourcing_layers`](backend/app/models/sourcing_layer.py)
table is **per-mandate** (`mandate_id NOT NULL`) — semantically wrong for a firm-wide funnel, and
dropping/renaming its NOT-NULL FK column in place is exactly the destructive SQLite operation our
non-negotiables warn against.

**Decision (reviewer hat): implement the funnel as a NEW firm-wide `sourcing_stages` vocabulary +
a NEW `sourcing_candidates` (mandate × profile) row that carries the funnel position, additively;
do NOT put `stage_id` on `companies`, and do NOT mutate `sourcing_layers` in place.**
- Satisfies "repurpose" **semantically**: in the UI the *term* "Sourcing layer" now surfaces as the
  funnel/stages; the old thesis-band grouping is retired (§1.4).
- Keeps migrations **additive and reversible** (a clean `upgrade→downgrade→upgrade`), which a
  rename-in-place would not.
- **No destructive drop** of `sourcing_layers` or `companies.sourcing_layer_id` now (deprecate;
  optional cleanup slice later) — reversible, and the thesis-band data isn't lost.

### 1.3 Where the funnel position lives — pool vs placement (resolves review finding #1)

**The bug in the first draft:** it put `stage_id` on `companies` (the per-mandate placement) and said
"push sets it to Active outreach." But **Research** and **Shortlisted** happen *before* a company is
pushed into any deal — at that point there is no `companies` row, only a pool `company_profiles` row.
So the first two kanban columns had nowhere to persist. Fixed by separating the two levels:

| Level | Entity | Stages that live here | Cadence? |
|---|---|---|---|
| **Pool (firm-wide inventory)** | `company_profiles` | *pre-funnel* — raw inventory, not yet in any mandate's funnel | no |
| **Candidate (mandate × profile)** | **`sourcing_candidates`** (new) | **Research / Long-list · Shortlisted · Active outreach · Engaged · Passed** — the whole funnel, single-sourced here | no (pre-Active); yes (Active+ via the linked placement) |
| **Placement (deep-work workspace)** | `companies` (+ schedule/events/contacts) | *none* — the placement exists once outreach starts; it has **no** stage column | yes |

- **`sourcing_candidates`** = one row per (mandate × profile): `stage_id`, `company_id` (**NULL until
  push**), `added_by_id`, + the AI score cache (folded in — §2.1). **Unique (mandate_id, profile_id).**
  Funnel position is single-sourced here, so there is no `companies.stage_id` to drift against.
- A candidate row is created the moment an analyst **acts** on a pool profile for a mandate — *Add to
  long-list* (Research), *Shortlist*, *Score* (AI scoring creates a Research candidate as its
  side-effect), or *Push* (Active). Pool profiles nobody has acted on have **no** candidate row; they
  are just inventory that the search surfaces.
- **"Push to Project + Side" is the materialisation transition:** Research/Shortlisted → **Active
  outreach** creates the `companies` placement + cycle-1 `AWAITING_INITIAL` schedule and sets
  `candidate.company_id`. Everything **Active onward** has a placement; everything before it is
  candidate-only. This is what makes the kanban's first two columns real (drag Research↔Shortlisted =
  a cheap candidate update; drag → Active = the push, an explicit confirm — see §4.1).
- **Engaged** auto-advances when a RESPONSE event is logged; **Passed** is manual (offers to stop the
  cadence). **COLD stays a derived cadence badge, independent of stage.**

### 1.4 Naming reconciliation — deprecate the old "sourcing layer" (resolves review finding #6)

Phase 2a shipped `sourcing_layers` (per-mandate thesis bands), `companies.sourcing_layer_id`,
`/sourcing-layers`, and analytics "response-by-layer". Introducing `sourcing_stages` +
`sourcing_candidates` would leave **two live "sourcing" concepts** — dev-confusing dead code. So the
deprecation is explicit and lands **in SL-1**, not deferred:
- **Rename in the UI/vocabulary:** the old concept becomes **"thesis bands"** everywhere it still
  shows; the word "sourcing layer/stage" refers *only* to the funnel.
- **Endpoints:** `/sourcing-layers` is marked **deprecated** (kept serving for back-comfort, removed
  from the nav/grid); no new callers.
- **Analytics:** the existing "response-by-layer" is relabelled **"response-by-thesis-band"** (kept
  only if a firm still uses bands) and the **new "response-by-stage"** becomes the funnel analytic
  (§8). This avoids two conflicting "by sourcing X" charts.
- **Data:** `sourcing_layers` / `companies.sourcing_layer_id` are **not dropped** now (reversible);
  an optional late cleanup slice archives them once no firm relies on bands.

---

## 2. Data model + migrations (each additive and reversible)

All new tables are **firm-scoped**, carry `archived_at` (soft-delete), `created_at/updated_at`, and
follow "one model per file". All migrations use `batch_alter_table` on SQLite and are proven with
`upgrade → downgrade → upgrade` in CI. New enum-like vocabularies are **data (lookup tables)**, not
DB enums, so a firm can extend them without DDL (the lesson from
[PHASE2_REFINEMENT_PLAN §7.2](PHASE2_REFINEMENT_PLAN.md)).

### 2.1 New tables & columns

| Entity | Purpose | Key columns |
|---|---|---|
| **`sourcing_stages`** (new) | Firm-wide funnel vocabulary (§1) | `id, firm_id, name, kind(enum), sort_order, archived_at` — **behaviour derives from `kind`** (RESEARCH·SHORTLIST·ACTIVE·ENGAGED·PASSED·CUSTOM), not free booleans, so rename/reorder is safe (review nit). |
| **`sourcing_candidates`** (new) | **The funnel entity** — one row per (mandate × profile); holds the pipeline position for **all** stages (incl. pre-push Research/Shortlisted) **and** the folded AI score cache (§1.3, review #1) | `id, firm_id, mandate_id, profile_id, stage_id, company_id(nullable→set at push), added_by_id,` **AI:** `fit_score(int), band, subscores(JSON), rationale(text), insufficient_data(bool), model, prompt_version, inputs_hash, score_status(enum OK/STALE/FAILED), scored_at,` `archived_at` ; **unique (mandate_id, profile_id)** |
| ~~`companies.stage_id`~~ | **Removed** — funnel lives on `sourcing_candidates`, not the placement (no drift). `companies` gains **no** stage column. | — |
| **`saved_searches`** (new) | Saved pool queries (per user, shareable firm-wide) | `id, firm_id, owner_id, name, scope(enum PRIVATE/FIRM), criteria(JSON), archived_at` |
| **`import_batches`** (new) | CSV/IB-DB ingest audit + idempotency | `id, firm_id, uploaded_by, source(enum CSV/IB_DB/PROVIDER), filename, file_hash, mapping(JSON), row_count, created_count, updated_count, skipped_count, status(enum PENDING/PREVIEWED/APPLIED/FAILED), created_at` |
| **`import_rows`** (new, optional but recommended) | Per-row outcome for re-import & error report | `id, batch_id, row_index, raw(JSON), resolved_profile_id, action(enum CREATE/UPDATE/SKIP/ERROR), message` |
| **`data_source_configs`** (new) | Pluggable-provider registry/config (creds stay in `.env`) | `id, firm_id, provider_key, kind(enum ENRICHMENT/RANKING), enabled(bool), config(JSON, non-secret), created_at` |

**Enums added to [enums.py](backend/app/models/enums.py)** (string enums, `native_enum=False`):
`SourcingStageKind`, `SavedSearchScope`, `ImportSource`, `ImportStatus`, `ImportRowAction`,
`DataSourceKind`, `CandidateScoreStatus`. **No new `CompanyStatus`/stage overlap** — COLD stays a
*derived cadence state*, never a stage or status.

**Stage-behaviour invariants (review nit).** Behaviour is derived from `kind`, and the
`/sourcing-stages` admin endpoints **validate**: **≤ 1** `ACTIVE`-kind stage (the cadence-start
transition), **exactly 1** `PASSED` terminal, and `RESEARCH`/`SHORTLIST` must sort *before* `ACTIVE`.
`CUSTOM` stages are allowed anywhere and carry no special behaviour. This prevents a partner reorder
from breaking the transition logic.

**Reuse, don't rebuild:** `company_profiles` ([company_profile.py](backend/app/models/company_profile.py))
**is** the sourcing pool. Ingest writes profiles; search reads profiles; candidates/scores key off
`(mandate_id, profile_id)`. No parallel "pool" table.

### 2.2 Migrations (ordered, all additive; each has a tested downgrade)

Migration labels are numbered to **land in slice order** so each Alembic `down_revision` chains
linearly in the order slices merge (review nit — avoids out-of-order revision graphs):

- **MIG-1 (lands SL-1) — `sourcing_stages` + `sourcing_candidates`.**
  - Create `sourcing_stages`; seed the 5 defaults (`kind` set) **per existing firm** (data migration).
  - Create `sourcing_candidates` (with folded score columns) + unique index `(mandate_id, profile_id)`.
  - **Backfill candidate rows from existing placements** (best-effort, reversible): for each current
    `companies` row with a `profile_id`, create a `sourcing_candidates` row (`company_id` = that
    company) with `stage` from current signals — RESPONSE/`RESPONDED` → *Engaged*; `DECLINED`/archived
    → *Passed*; schedule `ACTIVE`/`CONTACTED` or any INITIAL_EMAIL → *Active outreach*; else → *Research*.
    Emit a one-line audit report (like the dedupe report) so the backfill is reviewable.
  - **Downgrade:** drop `sourcing_candidates`, drop `sourcing_stages`. `upgrade→downgrade→upgrade`
    clean on SQLite. **No `companies` column changes** (no `stage_id`) → smaller blast radius.
- **MIG-2 (lands SL-2) — `import_batches` (+ `import_rows`)**.
- **MIG-3 (lands SL-3) — `saved_searches`.**
- **MIG-4 (lands SL-7) — `data_source_configs`**; seed one row per firm for the **mock** enrichment +
  mock ranking providers (so the seam is provable out of the box).
- **SL-8 needs no migration** — the AI score cache lives on `sourcing_candidates` (created in MIG-1).

Each migration ships in its own slice (§6) with its own up/down test. **No FK moves on
`outreach_schedules` / `outreach_events` / `contacts`** — the whole feature stays on the low-blast-radius
"bridge" model ([PHASE2_REFINEMENT_PLAN §8-A](PHASE2_REFINEMENT_PLAN.md)); Phase 2b convergence is
untouched and still optional.

---

## 3. Backend API surface

Conventions kept: JSON snake_case, ISO-8601 dates, list responses use the `{items,total,page,page_size}`
envelope, **`visible_mandate_ids()` scoping on every list/detail** ([deps.py:88](backend/app/core/deps.py#L88)),
soft-delete filters by default. New routers registered in [main.py](backend/app/main.py#L51) alongside
the existing ones.

### 3.1 Funnel stages — `/sourcing-stages` (firm-wide, partner-managed like categories)

| Method · path | Who | Body / query → response |
|---|---|---|
| `GET /sourcing-stages` | all | → ordered `{items:[{id,name,kind,sort_order}]}` |
| `POST /sourcing-stages` | **partner** | `{name, kind, sort_order?}` → created stage (invariants enforced, §2.1) |
| `PATCH /sourcing-stages/{id}` | **partner** | rename/reorder/kind (invariants re-checked) |
| `DELETE /sourcing-stages/{id}` | **partner** | soft-delete; candidates fall back to first stage |
| `PATCH /sourcing-candidates/{id}/stage` | analyst (visible mandate) | `{stage_id}` → applies **transition side-effects** (below), returns the enriched candidate |

**Stage transition side-effects** (server-computed; cadence stays separate & authoritative; the stage
lives on the **candidate**, §1.3):
- → `RESEARCH`/`SHORTLIST` kind: pure candidate update — **no placement, no cadence** (this is why the
  first two kanban columns persist).
- → `ACTIVE` kind: this **is the push** — materialise the `companies` placement + cycle-1
  `AWAITING_INITIAL` schedule (via the shared `push_to_mandate` service, §3.4), set
  `candidate.company_id`, return `prompt_log_initial:true`; never auto-fabricate an event. Because it
  has heavy side-effects, the UI drag into Active is an **explicit confirm**, not silent (§4.1).
- → `ENGAGED` kind: allowed manually; also **auto-advanced** when a RESPONSE event is logged (hook in
  `log_event`).
- → `PASSED` (terminal): offer to stop the cadence (`stop_schedule(MANUAL)`), logged as an event;
  **never** delete history.
- COLD is derived and shown as a badge regardless of stage — **not** settable.

### 3.2 Sourcing pool ingest

| Method · path | Purpose |
|---|---|
| `POST /imports/csv/preview` | multipart upload → detect delimiter/encoding, return headers + sample rows + a **suggested mapping** (fuzzy header→profile-field) + a `file_hash`. Creates `import_batches` (status `PREVIEWED`). No writes to profiles. |
| `POST /imports/csv/validate` | `{batch_id, mapping}` → per-row type/required validation **+ dry-run dedup preview** (reuse `dedupe_report` clustering + `find_duplicates`): counts of create / update(merge) / conflict / error, plus the merge clusters and conflicting facts. |
| `POST /imports/csv/apply` | `{batch_id, mapping, resolutions?}` → **idempotent** upsert into `company_profiles` via `upsert_profile` (block on `domain_key` then `name_key`); writes `import_rows`; sets batch `APPLIED`. Re-applying the same file = no duplicates. |
| `GET /imports/{batch_id}` | batch status + per-row outcomes + downloadable error rows. |
| `POST /imports/ib-db` (script + endpoint) | Bulk-load the firm's proprietary company/contact export (CSV/XLSX) → same pipeline, `source=IB_DB`, entering at **Research/Long-list** (pool profiles). Runnable as `python -m scripts.import_ib_db --dry-run` first. |

All ingest is **firm-scoped** (writes `firm_id = current_user.firm_id`) and **gated by the dry-run
preview** before apply.

### 3.3 Pool search + candidates + saved searches

| Method · path | Purpose |
|---|---|
| `GET /sourcing/candidates?mandate_id=&q=&category_id=&hq=&rev_min=&rev_max=&headcount_min=&headcount_max=&type=&has_score=&sort=score\|name\|rev&page=` | **The core search.** **Pool browsing is firm-wide** (review #7): it searches **all** `company_profiles` in the firm — including never-placed inventory — because the pool is a shared sourcing DB by design; `visible_mandate_ids()` is **not** a filter on the pool itself. Each row is overlaid with the **candidate state for the chosen mandate** (stage + AI `fit_score`/rationale/band from its `sourcing_candidates` row, left-joined; NULL if not yet a candidate) and **warm history** — and *those overlays respect visibility* (see below). |
| `GET /sourcing/candidates.csv?…` | export current result set. |
| `GET/POST/PATCH/DELETE /saved-searches` | CRUD saved pool queries (PRIVATE or FIRM scope). `POST /saved-searches/{id}/run` = shortcut to the candidates query. |

**Warm history is batched, not per-row `find_duplicates` (resolves review #4).** For pool candidates we
already hold `profile_id`, so warm history is a **single batched query** over `companies` (joined to
its latest event/contact) grouped by the page's `profile_ids` — **not** `find_duplicates` per card
(which scans ≤500 rows each → 50×500 on a page). `find_duplicates` stays only for the *free-text
add-company* path where no `profile_id` exists yet. **Overlay visibility:** the *existence* of prior
work is firm-wide (the point of a shared pool), but per-touch **detail** (client / POC / sentiment /
date) is shown only for **visible** mandates; work in a mandate the analyst isn't on renders as a
muted "worked by another team" with no details.

### 3.4 "Push to Project + Side" — one service, two entry points

**One code path** in a new `services/sourcing.py::push_to_mandate(...)`, reused by the endpoint and
callable from both the Master List row and a Sourcing candidate card. It **refactors the existing
create-company internals** ([companies.py:501-587](backend/app/api/companies.py#L501)) so profile
linking, type derivation, and schedule creation are shared, not duplicated.

`POST /sourcing/push` — body `{profile_id, project_id, side}` (side ∈ Sell/Buy/Raise). Resolution
matrix (all **visibility-scoped**):

| Situation | Response |
|---|---|
| **Exactly one** engagement of that side in the project | Push. `201` with the placement + warm history. |
| **Several** of that side | `200 {needs_choice:[{mandate_id,name,…}]}` — UI asks which. |
| **None** of that side, user = **partner** | `200 {can_create:true, existing_sides:[…]}` — offer to create the engagement, then push. |
| **None**, user = **analyst** | `200 {can_create:false, existing_sides:[…]}` — show existing sides only. |
| **Already present** (candidate row for profile+mandate already has a non-archived `company_id`) | `200 {already_present:true, company_id}` — **surface it, never duplicate.** (Unique `(mandate_id, profile_id)` on `sourcing_candidates` backstops this at the DB.) |

On a successful push the service:
1. Upserts/links the shared **profile** (facts carry over — no re-typing) via `upsert_profile` +
   `sync_company_from_profile` ([profiles.py](backend/app/services/profiles.py)).
2. **Derives company type from the side** using the existing map `_TYPE_BY_MANDATE_TYPE`
   (`SELL_SIDE→BUYER, BUY_SIDE→TARGET, CAPITAL_RAISE→INVESTOR`, [companies.py:60](backend/app/api/companies.py#L60)) —
   never a manual "type" question.
3. **Materialises the candidate → placement:** upserts the `sourcing_candidates` row (creating it if
   the push came straight from a pool row), sets its **stage = Active outreach**, creates the
   `companies` placement + cycle-1 **`AWAITING_INITIAL`** schedule
   ([companies.py:564](backend/app/api/companies.py#L564)), and sets `candidate.company_id`. Returns
   `prompt_log_initial:true` so the UI can log the initial email in the same action (split-button
   "Push & log initial email"). The clock still only starts on the `INITIAL_EMAIL` event via
   `activate_schedule` ([cadence.py:89](backend/app/services/cadence.py#L89)).
4. Returns **warm history** for the banner ("worked by Priya for GAIL — Positive, 18 May").

`POST /sourcing/engagements` (partner) — create an engagement of a side under a project when none
exists, returning the new `mandate_id` for an immediate push.

### 3.5 Master List — "My book" vs firm-wide

Extend the pool surface rather than fork it (`/company-profiles` already backs the Master List page —
[company_profiles.py](backend/app/api/company_profiles.py), [master/page.tsx](frontend/app/(app)/master/page.tsx)):

| Method · path | Purpose |
|---|---|
| `GET /my-book` | Analyst default: the **placements in my mandates**, grouped by Project, **sorted overdue → due-soon → awaiting-initial → rest** (reuse cadence enrichment + `today_ist()`). Batched cadence, no N+1. |
| `GET /company-profiles?scope=firm&group_by=analyst` | Partner: firm-wide pool + **group-by-analyst** for overlap/conflict (who's working whom). |
| `GET /company-profiles` (existing) | Firm-wide pool inventory (all profiles + placements), the Master List. |

### 3.6 AI ranking endpoints

| Method · path | Purpose |
|---|---|
| `POST /sourcing/score` | `{mandate_id, profile_ids?[]}` (default = current search result set). Batched, cached scoring → **upserts `sourcing_candidates` rows** (creating them at `RESEARCH` stage as the scoring side-effect, §1.3) with `fit_score`/band/subscores/rationale/insufficient_data. Runs via provider abstraction (§5); returns `202`+partial with `score_status` when rate-limited/degraded. |
| `GET /sourcing/score/status?mandate_id=` | coverage: how many candidates scored / stale / failed. |
| `POST /sourcing/candidates/{id}/score-feedback` | analyst thumbs-up/down on a score (ground-truth capture for later eval; ships in SL-8). |
| `POST /sourcing/score/eval` (partner) | **deferred (SL-9, review nit):** run the formal eval harness → κ, Spearman, distribution (§5.6). MVP ships feedback capture + call logging only. |

---

## 4. Frontend surfaces (Next.js 16 / React 19 / TanStack Query / shadcn)

New nav entry **"Sourcing"** in [nav.ts](frontend/components/layout/nav.ts) (all roles). New hooks
mirror the existing pattern (`use-profiles.ts`, `use-companies.ts`): `use-sourcing-stages`,
`use-candidates`, `use-saved-searches`, `use-imports`, `use-push`, `use-my-book`, `use-scores`.

### 4.1 Sourcing workspace (`/sourcing`)

- **Search panel** (mandate selector + criteria: category, HQ, size, type) with **saved searches**
  (save/apply/share). Progressive disclosure: primary filters visible, advanced under a disclosure
  ([NN/g Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)).
- **Two views over the same result set, shared filters** ([NN/g Data Tables](https://www.nngroup.com/articles/data-tables/)):
  - **List** — dense table; sortable by **AI score**, revenue, cadence; **row-select + contextual
    bulk action bar** (Shortlist / Push / Score selected) with **Undo** ([NN/g Bulk Actions](https://www.nngroup.com/videos/bulk-actions-design-guidelines/)).
  - **Kanban** — columns = **stages** over `sourcing_candidates` for the mandate; drag-to-advance
    calls `PATCH /sourcing-candidates/{id}/stage`, WIP counts per column. **Drag into *Active
    outreach* is an explicit confirm** (review nit) — it materialises a placement + starts the
    cadence (a heavy, hard-to-undo side-effect), so it opens the Push/"log initial email?" dialog
    rather than committing silently; Research↔Shortlisted drags are cheap and stay optimistic.
- **Candidate card** (reused on Master List): name · HQ · website · revenue · headcount · category ·
  key contact; **warm-history badge**; **AI fit_score badge + rationale on expand**;
  `insufficient_data` shown honestly ("not enough data to score"); actions **Push to Project + Side**,
  **Shortlist**, **View profile**.

### 4.2 "Push to Project + Side" dialog (shared component)

One `<PushToDialog>` opened from a candidate card **and** a Master List row. Steps: pick **Project**
→ pick **Side** → resolution (auto-push / choose-engagement / offer-create[partner] / already-present
banner) → success toast with warm-history line and a **"Log initial email"** follow-up. Optimistic
where safe; always reconciled to the server's resolution result.

### 4.3 CSV import wizard (`/sourcing/import`)

4 steps matching the researched flow: **Upload** (drag-drop, template download, delimiter/encoding
auto-detect + preview) → **Map** (columns → profile fields, fuzzy-suggested) → **Validate & dedup
preview** (counts by outcome, merge clusters, conflicting facts, filter to bad rows, download error
rows) → **Apply** (idempotent; success summary create/update/skip). A separate partner **IB-DB
import** entry uses the same wizard with a pre-baked mapping.

### 4.4 Master List (`/master`) — My book / firm-wide

Analyst lands on **"My book"** (grouped by Project, worklist sorted by attention) with a toggle to
the firm-wide pool; partner lands on **firm-wide + group-by-analyst**. Each row keeps the existing
placement chips and gains the shared **Push** action and (where scored) an AI badge.

### 4.5 Settings

Partner **"Manage sourcing stages"** panel (rename/reorder/add/flags), mirroring the existing
`category-manager.tsx`. Partner **"Data sources"** panel to enable/disable providers (creds live in
`.env`, never shown).

---

## 5. AI design (provider abstraction, Groq usage, rubric, schema, caching, fallback, evaluation)

### 5.1 Provider abstraction (build the seam now)

`services/providers/` with two Python `Protocol`s and a registry, so third-party APIs slot in without
rework:

- `RankingProvider.score(thesis: MandateThesis, candidates: list[CandidateFacts]) -> list[FitScore]`
- `EnrichmentProvider.fetch(profile: ProfileFacts) -> EnrichmentResult`
- **Registry** keyed by `provider_key`, selected per firm from `data_source_configs`.
- **Shipped now:** `GroqRankingProvider`, `MockRankingProvider` (deterministic, offline — used in
  tests and when AI disabled), `MockEnrichmentProvider` (proves the enrichment seam end-to-end so a
  real data vendor is a drop-in later). This satisfies "pluggable external data sources — ship at
  least a stub to prove the seam."

### 5.2 Groq usage (grounded in §0.3)

- **Client:** thin httpx client, OpenAI-compatible `chat/completions`, `response_format` =
  `json_schema` **strict**. **Model:** `openai/gpt-oss-120b` (strict); **fallbacks:**
  `openai/gpt-oss-20b` (strict, faster) → `llama-3.3-70b-versatile` (best-effort + JSON-repair).
- **Config (added to [config.py](backend/app/core/config.py), values from `.env`):** `groq_api_keys`
  (parsed from `GROQ_API_KEY`,`GROQ_API_KEY_2`,`GROQ_API_KEY_3`), `groq_model`,
  `groq_fallback_models`, `groq_timeout_s`, `groq_max_candidates_per_call`, `sourcing_ai_enabled`,
  `groq_daily_token_budget`. Note: current settings use `extra="ignore"`, so the `GROQ_*` keys are
  silently dropped today — **they must be declared** to be read. Secrets stay in `.env`.
- **Key rotation + limits:** round-robin across the 3 keys; on `429`/timeout, mark that key
  cooling-down and rotate; exponential backoff; **batch ≤ ~15–20 candidates/request** (TPM-bounded);
  a per-firm **daily token budget** guard. 3 keys ≈ 3× the free-tier 30 RPM / 6k TPM headroom.
- **Cost/latency guards:** scoring is **on-demand + cached**, never on every list render; only
  unscored/stale candidates are sent; a hard cap per request; short timeouts with fallback.

### 5.3 Rubric + prompt outline (anchored, evidence-only)

System prompt (versioned as `prompt_version`) contains: the **role** (M&A sourcing analyst scoring
fit to a mandate thesis), the **rubric with anchor bands** (e.g. **80–100** strong on
sector+size+geography+type; **60–79** strong on most; **40–59** partial; **20–39** weak; **0–19**
poor/irrelevant), the **dimensions** (sector/category fit, size fit, geography fit, type fit), and
the **anti-hallucination clause**: *"Score ONLY from the facts provided. If a fact is missing, do not
assume it — note it and lower confidence. Do not use outside knowledge about the company."*
([Eugene Yan](https://eugeneyan.com/writing/llm-evaluators/); [Rulers, arXiv 2601.08654](https://arxiv.org/abs/2601.08654)).
**CoT-before-score** (reason, then emit the structured verdict). **Pointwise** (each candidate scored
independently) to avoid position bias and keep the cache reusable ([LLMs-as-Judges survey, arXiv 2412.05579](https://arxiv.org/html/2412.05579v2)).

The user message carries **only facts we hold** for each candidate: name, category, HQ/geography,
revenue, headcount, website presence, relevant investments, and the mandate thesis (sector,
geography, size band, side). No web data, no invented fields.

### 5.4 Scoring schema (strict JSON)

Per candidate (array response), all fields `required`, `additionalProperties:false`, optionals as
`["…","null"]` per Groq strict rules:
```
{ profile_id:int, fit_score:int(0..100), band:enum(STRONG,GOOD,PARTIAL,WEAK,POOR),
  subscores:{sector:int, size:int, geography:int, type:int},
  rationale:string(≤240), insufficient_data:bool, evidence:[string] }
```

### 5.5 Caching & storage

The score cache lives **on `sourcing_candidates`** (folded — §2.1), unique on `(mandate_id,
profile_id)`, with `inputs_hash` = hash(thesis + candidate facts + `prompt_version` + model).
**Cache hit** when the hash matches → no API call. **Invalidate** (mark `score_status=STALE`) when
profile facts or the thesis change, or the prompt version bumps. Scores surface on candidate cards
and drive **sort/filter by score**. Graceful fallback: if scoring is unavailable, candidates simply
render **unscored** (feature-degraded, never broken); the last good score is retained and flagged
`STALE`.

### 5.6 Evaluation approach

- **Labelled set:** analysts thumbs-up/down or 1–5 a sample of scored candidates (store as ground
  truth). Small n is fine to start.
- **Metrics:** **Spearman rank-correlation** (does the model's order match the analyst's?) and
  **Cohen's κ** on banded agreement (more honest than raw correlation — [Eugene Yan](https://eugeneyan.com/writing/llm-evaluators/)).
- **Drift & ops:** log every call (model, key index, latency, tokens, prompt_version, cache hit);
  watch score-distribution drift; alert on rationale/`insufficient_data` rates. `POST
  /sourcing/score/eval` recomputes metrics on demand for the partner.
- **Regression tests:** `MockRankingProvider` gives deterministic scores so the whole pipeline is
  testable offline with zero API cost.
- **Scope (review nit):** SL-8 ships only **feedback capture + full call logging** (cheap, high
  value). The **formal κ/Spearman/drift harness + `/score/eval`** is **deferred to SL-9** so the AI
  slice isn't over-weighted for an MVP.

### 5.7 Confidentiality & data egress (resolves review finding #5)

Scoring sends the firm's proprietary target/investor facts to a **third-party LLM (Groq)** — for an
IB that is a **confidentiality/compliance** concern, not merely a cost one. Controls:
- **Off by default, per-firm opt-in.** `sourcing_ai_enabled` defaults **false**; a partner must
  enable it, ideally behind a one-time acknowledgement of the data-sharing terms.
- **Explicit egress allow-list.** Only these fields may leave: company name, category, HQ/geography,
  revenue **band**, headcount, website presence (boolean/domain), `relevant_investments` text, and the
  **mandate thesis**. **Never sent:** contact PII (names/emails/phones), internal notes/comments,
  analyst identities, other clients' names, or anything from `contacts`/`outreach_events`. A single
  `build_candidate_facts()` function is the **only** place that assembles the payload, so the
  allow-list is auditable in one spot and unit-tested to reject non-allow-listed keys.
- **Vendor due-diligence noted:** confirm Groq's data-retention / training-use terms before enabling;
  record the decision. This is a go/no-go item for the partner, not an engineering default.

---

## 6. Build sequence — sized, phased, checklisted (backend-first per slice)

Sizes: **S** ≈ ½–1 day, **M** ≈ 1–2, **L** ≈ 3+. Each slice ends **green** (pytest + Vitest/Playwright)
and updates **PROGRESS.md**. Backend lands before its frontend within each slice.

### SL-1 — Funnel stages + candidates model + old-name deprecation (backend-first). **M**
- [ ] `sourcing_stages` model (`kind`-driven) + `/sourcing-stages` router (partner, invariants §2.1) + schemas.
- [ ] `sourcing_candidates` model (mandate × profile, stage + folded score cache, unique (mandate,profile)); **MIG-1** = stages seed + candidates + **backfill candidate rows from existing placements** + audit report. **No `companies.stage_id`.**
- [ ] `PATCH /sourcing-candidates/{id}/stage` with transition side-effects (§3.1); RESPONSE-event → auto-Engaged hook in `log_event`.
- [ ] **Deprecate the old "sourcing layer" (§1.4):** relabel → "thesis bands", mark `/sourcing-layers` deprecated + drop from nav/grid, relabel "response-by-layer" analytics. No data drop.
- [ ] Settings "Manage sourcing stages" panel (FE).
- [ ] **Tests:** MIG-1 `upgrade→downgrade→upgrade` on SQLite; backfill mapping; **stage invariants** (reject 2× ACTIVE, missing PASSED); stage-change side-effects; **cadence invariants unchanged** (COLD derived, initial_date immutable); visibility. Vitest settings panel.

### SL-2 — Pool ingest: CSV + IB-DB (backend-first). **L**
- [ ] `import_batches` (+ `import_rows`); **MIG-2**.
- [ ] CSV preview/validate/apply endpoints; delimiter/encoding detect; fuzzy header mapping; **dry-run dedup preview reusing `dedupe_report` + `find_duplicates`**; idempotent `upsert_profile` apply.
- [ ] `scripts/import_ib_db.py` (dry-run first) + `POST /imports/ib-db`.
- [ ] CSV wizard UI (Upload→Map→Validate→Apply) + template download + error-row download.
- [ ] **Tests:** idempotent re-import (same file twice → 0 dupes); dedup preview clusters; bad-row handling; firm-scoping; dry-run writes nothing. Playwright happy-path import.

### SL-3 — Pool search + candidate cards + saved searches (BE + FE). **M/L**
- [ ] `GET /sourcing/candidates` (criteria filters, visibility-scoped, batched enrichment incl. warm history + placed-in-mandate flag).
- [ ] `saved_searches` model + CRUD; **MIG-3**.
- [ ] Sourcing workspace: search panel, **list view** (sort/select/bulk bar+Undo), candidate cards (progressive disclosure), saved searches.
- [ ] **Tests:** filter correctness; visibility (analyst sees only pool rows tied to visible mandates where applicable); warm-history payload; N+1 guard. Vitest cards/filters.

### SL-4 — "Push to Project + Side" (backend-first, one code path). **M/L**
- [ ] Refactor create-company internals into `services/sourcing.py::push_to_mandate`; `POST /sourcing/push` with the full **resolution matrix**; `POST /sourcing/engagements` (partner).
- [ ] Type derivation reuse; **materialise candidate → placement** (upsert `sourcing_candidates`, set stage=Active + `company_id`, create `companies` + cycle-1 `AWAITING_INITIAL`); warm history; **already-present surfacing (no dup)**.
- [ ] `<PushToDialog>` shared by candidate cards **and** Master List rows; "Push & log initial email".
- [ ] **Tests (the matrix):** 1/several/none-partner/none-analyst/already-present; type derived correctly per side; candidate row + placement created, schedule AWAITING_INITIAL (clock not ticking); unique (mandate,profile) blocks a dup; profile linked; append-only preserved. Playwright push→appears in grid→log initial→cadence ticks.

### SL-5 — Funnel kanban + bulk actions (FE-forward). **M**
- [ ] Kanban over `sourcing_candidates` for a mandate (columns=stages, drag→`PATCH /sourcing-candidates/{id}/stage`, WIP counts); **drag into Active = explicit Push confirm** (not silent); shared filters/saved-searches with list; bulk shortlist/push/score with contextual bar + Undo.
- [ ] **Tests:** Vitest drag-to-stage side-effects (cheap for Research↔Shortlist; confirm-gated into Active); Playwright kanban↔list parity on same filters.

### SL-6 — Master List "My book" / firm-wide / partner group-by-analyst (BE + FE). **M**
- [ ] `GET /my-book` (grouped by Project, sorted overdue→due-soon→awaiting-initial→rest, batched cadence); `?scope=firm&group_by=analyst` for partners.
- [ ] Master List page: My-book default (analyst) / firm-wide+group-by-analyst (partner) toggle.
- [ ] **Tests:** sort order; grouping; visibility; batched cadence correctness vs `today_ist()`.

### SL-7 — Provider seam + mocks (backend-first). **S/M**
- [ ] `services/providers/` Protocols + registry; `data_source_configs` (**MIG-4**, seed mock providers); `MockRankingProvider` + `MockEnrichmentProvider`; Settings "Data sources" panel.
- [ ] **Tests:** registry selection per firm; mock enrichment round-trip proves the seam; AI-disabled path returns unscored cleanly.

### SL-8 — AI ranking with Groq (backend-first). **L**
- [ ] **⚠️ Prerequisite gate (review #2/#3):** (a) **verify Groq live docs** — model IDs, strict-schema support, current rate limits — and that cited sources still resolve; (b) **add `httpx` to runtime `dependencies`** in `pyproject.toml` (it's dev-only today). Do not start until both are done.
- [ ] **No migration** — score cache is on `sourcing_candidates` (MIG-1). `GroqRankingProvider` (httpx, strict JSON schema, key rotation, backoff, batch cap, daily budget) behind the provider seam (SL-7); config keys wired from `.env` (declare `GROQ_*` in `config.py`, currently `extra="ignore"`).
- [ ] **Egress allow-list:** single `build_candidate_facts()` assembles the payload (§5.7); `sourcing_ai_enabled` firm toggle (default off).
- [ ] `POST /sourcing/score` (+ status) with caching (`inputs_hash`), fallback chain, degraded/partial responses; score badges + sort/filter in list & cards; **thumbs feedback capture + full call logging** (formal κ/Spearman deferred to SL-9).
- [ ] **Tests (mocked HTTP — no live Groq in CI):** schema adherence; **key rotation on 429**; **fallback when unavailable → unscored, app still works**; cache hit avoids a call; `insufficient_data` for sparse facts; **`build_candidate_facts` rejects non-allow-listed fields (no PII leaves)**. Vitest score UI.

### SL-9 — Analytics + formal eval + polish (secondary). **M**
- [ ] Response-rate **by stage** + funnel conversion + time-in-stage + pool-coverage; AI-score-vs-outcome (does high fit → higher response?). Version any `use-analytics` contract change and update the FE in the same slice ([BUG-10 precedent](PHASE2_REFINEMENT_PLAN.md)).
- [ ] **Formal AI eval harness** (deferred from SL-8): `POST /sourcing/score/eval` → κ / Spearman / distribution drift over the thumbs-feedback ground truth.
- [ ] Optional **data** cleanup: drop the now-unused `sourcing_layers` / `companies.sourcing_layer_id` (UI/nav deprecation already done in SL-1) — additive-safe, tested down-migration.

---

## 7. Four-perspective review / critique (risks · scope-creep · cut lines)

> **Resolved in this revision (post-critic-review):** stage-location split (§1.3), httpx-runtime
> (§0.3/SL-8), Groq verify-gate (§0.3/SL-8), batched warm-history (§3.3), AI data-egress control
> (§5.7), firm-wide pool vs scoped overlays (§3.3), old-name deprecation (§1.4/SL-1). The residual
> risks below are what remains.

### 🔗 Backend
- **Risks:** (1) Backfilling candidate rows from fuzzy status signals will misplace some — **mitigate**
  with the audit report + analyst-correctable kanban, and keep it reversible. (2) `sourcing_candidates`
  can grow large if we score the whole pool × every mandate — **mitigate** by creating candidate rows
  only when the analyst acts (add/shortlist/score/push), never the cartesian product (§1.3). (3) Groq
  rate limits are real (30 RPM/6k TPM/key) — key rotation + batching + caching are **load-bearing, not
  nice-to-have**; without them the feature stalls. (4) Two "push" call sites must not drift — enforce
  the single `push_to_mandate` service in review.
- **Scope-creep to resist:** no Celery/queue/webhooks this phase (guardrail); scoring is synchronous
  batched + cached (optionally `BackgroundTasks`), not a job system.

### 🖥️ Frontend
- **Risks:** kanban↔list parity (same filters, same data) is easy to get subtly wrong — one source of
  truth for query state. Optimistic drag-to-stage must reconcile with server side-effects (initial-email
  prompt). Bulk actions **must** have Undo and clear feedback ([NN/g](https://www.nngroup.com/videos/bulk-actions-design-guidelines/)).
- **Cut line if time-boxed:** ship **list view + push + AI** first; kanban (SL-5) is the most
  cuttable without losing the core workflow.

### 🧭 Analyst
- **Wins:** search the firm pool by my mandate's criteria, see warm history + an AI fit hint, push in
  one click into the right engagement with the clock ready, and never re-type facts or duplicate a
  company. My-book worklist sorts by what's actually due.
- **Risk:** over-trusting the AI score. **Mitigate:** always show the grounded rationale + an honest
  `insufficient_data`, and keep score **advisory** — it sorts, it never gates.

### 🧭📋 Product / PM
- **Risks:** (1) The stage-firm-wide decision (§1) should be **explicitly confirmed** before MIG-1 —
  it's the one hard-to-reverse call. (2) AI adds real cost/latency/ops surface; the mock provider +
  disabled-path keep the product shippable and demoable **without** Groq. (3) IB-DB ingest quality is
  a data-cleanliness risk — the dry-run gate is the safeguard.
- **Sequencing call:** SL-1→SL-4 deliver the whole non-AI workflow and are demoable on their own;
  SL-7→SL-8 layer AI on the proven seam. If pressed, **SL-9 analytics** and **SL-5 kanban** are the
  cut lines.

---

## 8. Supporting features to add elsewhere (so this works well)

- **Nav:** add **"Sourcing"** ([nav.ts](frontend/components/layout/nav.ts)).
- **Settings:** partner **stage manager** + **data-source manager** (mirror `category-manager.tsx`).
- **Config:** declare the `GROQ_*` + `sourcing_*` settings so `.env` is actually read
  ([config.py](backend/app/core/config.py) currently `extra="ignore"`).
- **Analytics:** response-rate/conversion **by stage**, pool coverage, AI-fit-vs-outcome ([analytics.py](backend/app/services/analytics.py)).
- **Scripts:** `scripts/import_ib_db.py` (dry-run) beside `dedupe_report.py`.
- **Seed:** seed default `sourcing_stages` + mock `data_source_configs` per firm so a fresh DB demos
  the funnel + the provider seam immediately ([seed.py](backend/app/seed/seed.py)).
- **Providers package** (`services/providers/`) as the extension point for future real vendors.

---

## 9. Non-negotiables traceability

| Guardrail | How this plan honours it |
|---|---|
| Append-only outreach | Push/stage changes append events (INITIAL_EMAIL, NOTE); never mutate/delete history. |
| Server-computed cadence; `today_ist()` | Cadence untouched; stage is separate from the clock; My-book sort uses `today_ist()`. |
| AWAITING_INITIAL + immutable `initial_date` | Push creates cycle-1 AWAITING_INITIAL; `activate_schedule` still the only anchor writer. |
| RESPONDED/BOUNCED/DECLINED/EXHAUSTED stop the clock | Unchanged; Engaged aligns with RESPONSE; Passed offers a MANUAL stop. |
| **COLD derived, never stored** | COLD stays a derived cadence state/badge; **not** a stage or status. |
| Firm-scoped + analyst visibility on every endpoint | `visible_mandate_ids()` on all new lists/detail; pool/candidate/push/score/my-book all scoped. |
| Soft-delete only | New tables carry `archived_at`; no hard deletes; `sourcing_layers` soft-retired, not dropped. |
| Derived primary contact | Unchanged; key-contact on cards derives from `is_primary`. |
| httpOnly-cookie auth; secrets only in `.env` | No auth change; Groq keys read from `.env` only, never returned/logged in plaintext. |
| No email/webhook send this phase | None added; AI is inbound scoring only. |
| Additive-first migrations, `batch_alter_table`, up→down→up | All of MIG-1..5 additive + reversible + CI-tested. |
| Dry-run dedup before any apply | CSV + IB-DB ingest gated by the dedup preview (reuses `dedupe_report`). |
| Keep pytest + Vitest green; update PROGRESS.md | Every slice ends green and updates PROGRESS.md. |

---

## Appendix — sources

**Entity resolution / dedup:** [(Almost) All of Entity Resolution, arXiv 2008.04443](https://arxiv.org/pdf/2008.04443) ·
[UK Gov Digital — Splink: fast, accurate and scalable record linkage](https://dataingovernment.blog.gov.uk/2022/09/23/splink-fast-accurate-and-scalable-record-linkage/).
**LLM ranking / scoring:** [Eugene Yan — Evaluating LLM-Evaluators](https://eugeneyan.com/writing/llm-evaluators/) ·
[LLMs-as-Judges: A Comprehensive Survey, arXiv 2412.05579](https://arxiv.org/html/2412.05579v2) ·
[Hong et al., "From Rubrics to Reliable Scores" (Rulers), arXiv 2601.08654](https://arxiv.org/abs/2601.08654).
**Groq:** [Structured Outputs](https://console.groq.com/docs/structured-outputs) ·
[Supported Models](https://console.groq.com/docs/models) · [Tool Use](https://console.groq.com/docs/tool-use) ·
[Changelog/limits](https://console.groq.com/docs/changelog).
**Funnel / table / bulk UX:** [NN/g — Data Tables: Four Major User Tasks](https://www.nngroup.com/articles/data-tables/) ·
[NN/g — Bulk Actions: 3 Design Guidelines](https://www.nngroup.com/videos/bulk-actions-design-guidelines/) ·
[NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/).
**CSV ingestion (domain sources, secondary):** [Dromo](https://dromo.io/blog/5-best-practices-to-streamline-your-csv-import-process) ·
[OneSchema](https://www.oneschema.co/blog/building-a-csv-uploader) · [CSVBox — validate before DB](https://blog.csvbox.io/validate-csv-before-db/).
