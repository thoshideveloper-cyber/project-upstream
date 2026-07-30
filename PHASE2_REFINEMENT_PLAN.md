# Project Upstream — Phase 2 Refinement Plan
### "Work Like the Analyst Works" — reconciling the prototype with the real Excel workflow

> **Status:** Plan only. No code in this document. Every claim below is grounded in the three
> `phase_2/` workbooks (read row-by-row) and the current codebase (models, schemas, services,
> routers, migration, seed; frontend pages, hooks, dialogs, types). File/line references are
> clickable.
>
> **How to read this:** §1 sets the north star. §2 documents the Excel reality field-by-field.
> §3 maps Excel → current model → API → UI and marks every gap. §4 is the bug list. §5 is the
> redundancy/removal list. §6 is the connectivity map. §7 is the redesigned classification /
> segmentation / add-company model (requirement D) — the centrepiece. §8 covers requirements
> A–E as concrete backend + frontend changes. §9 is the intended feature set and screen layout.
> §0 reconciles with the just-built Phase 8. §10 is the four-perspective review. §11 is the
> sized, phased, checklisted build sequence.

---

## 0. Reconciliation with Phase 8 ("Work Like the Analyst Works" — already built, uncommitted)

**Assumption: this plan assumes Phase 8 is merged.** Phase 8 (`async-tinkering-robin.md`) is
implemented but **not yet committed** — see `git status`: `project.py`, `api/projects.py`,
migration `c1d2e3f4a5b6`, `test_slice1..6.py`, and the cadence-cycle columns on
`outreach_schedule.py`. This plan *builds on* Phase 8 and **consciously reworks three of its
choices**. That churn is deliberate; the table below is the contract so it is never accidental.

| Phase 8 built | This plan | Why |
|---|---|---|
| `Project` entity + `/projects` + partner overview + migration `c1d2e3f4a5b6` | **KEEP as-is** | Correct hierarchy parent; matches "one workbook per client". |
| Cadence **cycles** (`cycle_number`, `is_current`, `StoppedReason.EXHAUSTED`, restart) | **KEEP entirely** | Already matches "4 follow-ups → cold → swap contact → restart". **COLD stays a derived cadence state, never a `CompanyStatus`.** |
| `firms.follow_up_cap` + nullable `mandates.follow_up_cap` | **KEEP** | Maps the Excel "4 follow-ups" rule, configurable. |
| `CompanyCategory` **6-value enum** (incl. `FINANCIAL_SPONSOR`) | **CHANGE** → firm-configurable **vocabulary** table; `FINANCIAL_SPONSOR` folds into `PRIVATE_EQUITY` | The enum loses PMS / PE-PC / PE-VC (real Excel codes) and invents `FINANCIAL_SPONSOR`. **Extend, don't discard** — Phase 8's values become seed rows. |
| Backfill **`bucket` → `category`** (migration step 8c) | **SUPERSEDE** | `category` stays; `bucket` *also* seeds the new **sourcing layers**. One messy column can't cleanly source both axes — the layer backfill is **best-effort and needs analyst review** (§11). |
| Grid **grouped by `category`** (`/projects/[id]/grid`) | **CHANGE** → **nested grouping: Sourcing-layer bands, Category sub-grouped within each band** | Confirmed "both/nested": the analyst's layered segmentation is Band → Category → companies (the MVP "Sourcing Layers" feature). |
| **Company-per-mandate** (`companies.mandate_id` NOT NULL) | **KEEP per-mandate rows + add a shared `company_profiles` table in the MVP (confirmed *interim bridge*)**; full master/placement is a **later convergence (Phase 2b)** | Shared profiles deliver Req A's "one company record, enriched by all analysts" **now** without re-pointing schedules/events/contacts; the risky FK cutover is deferred. |

**Consequence for the rest of this doc (per the three confirmed scope decisions).**
**Phase 2a (MVP)** keeps per-mandate `companies` **and adds a shared `company_profiles` table** (the
*interim bridge* — shared static facts enriched by all analysts, §8-A), plus a firm-configurable
**`company_categories`** vocabulary and per-engagement **`sourcing_layers`**, and makes **no FK
moves** on `outreach_schedules`/`outreach_events`/`contacts`. **Phase 2b** is the later convergence
to one master `Company` + `engagement_placements`. Wherever §7–§8 says **"master company"** or
**"placement,"** read it as *"the `company_profiles` record + its per-mandate `companies` row in
Phase 2a; the unified master + placement in Phase 2b."* §11 is the authoritative, sized sequence.

---

## 1. North star (what the MVP actually is)

The product is **two sheets**: the **Master Sheet** (the company database) and the **Contact
List**. Everything else exists to automate relationship-building on top of those two. Two major
features sit on that base and complete the MVP:

1. **The Email Scheduler** — the bi-weekly follow-up cadence engine.
2. **Sourcing Layers** — the way an analyst segments a long list into priority/thesis bands.

Everything else — analyst POV, MD POV, analytics, email automation, contact auto-population — is
**secondary** and comes *after* these are nailed.

The hierarchy the analyst lives in:

```
Project (client)                     e.g. "22by7", "GAIL", "Medanta"
  └─ Engagement (deal side)          sell-side | buy-side | fundraise | (a project may hold several)
       └─ Category (counterparty)    Strategic | PE | VC | Family Office | PMS | PE/Credit | …
            └─ Sourcing layer        Direct/Secondary/Strategics | "Indian PE w/ related portfolio" | …
                 └─ Company (row)     static facts + inline contact + Initial email + Status
                      └─ Contact(s)   captured when they respond → flow into the firm-wide Contact List
                           └─ Outreach (append-only event log; drives the scheduler)
```

**The one hard reconciliation.** In Excel the analyst *overwrites* the `Status` cell in place —
a date for "last follow-up sent", or a text token ("Got response", "Bounced") that freezes the
scheduler. Our non-negotiables forbid mutating history: outreach is an **append-only event log**
and status/cadence are **computed server-side**. The plan's job is to give the analyst the exact
*feel* of overwriting one cell, while under the hood we append an event and recompute. This is
already the right architecture in the codebase — the gap is that the **UI doesn't yet make
logging feel like editing one cell**, and the response path doesn't capture the person. Both are
fixed here without ever mutating an event.

---

## 2. The Excel reality, documented (every column)

Three workbooks were read in full. Two are **per-client Master workbooks**; one is the
**firm-wide Contact List**.

### 2.1 Workbook = one client project

- `Investors outreach.xlsx` → **GAIL** capital-raise ("[Client] target/buyer name", exchange
  rate header, count = 70). Tabs: `Company list 1/2/3` (master sheets; 2 & 3 are empty
  spares) + `Emailing schedule`.
- `PE related buyers.xlsx` → **22by7** buy-side/sell-side. Tabs: nav divider
  `Master sheets and emailers >>>` (a summary pivot: Ongoing/Got response/Bounced/Total/Response
  rate), `PE names final`, `PE porfolio names final`, `Emailing schedule`, `Additional >>>`,
  `Remaining PE companies` (backlog long-list), `PE summary analysis` (pivots), `PE names`
  (research long-list).

**Takeaways that drive the model:**
- One workbook per **client**, multiple **master sheets** inside (by engagement or sub-list),
  each with its **own linked Email Scheduler** sheet.
- There is a **research → active** pipeline: `PE names` / `Remaining PE companies` are long-list
  staging (richer research columns: *Cheque size, Portfolio companies, Deal rationale*) that get
  **promoted** into the active master sheet (`PE names final`).
- `PE porfolio names final` carries **two inline contacts** per row and a **Holding company**
  cross-link (portfolio company → owning PE), plus `PE summary analysis` pivots on holding
  company + thesis. Multiple contacts and company-to-company links are real requirements.

### 2.2 Master Sheet — column dictionary (union of both workbooks)

| # | Excel column | Meaning | Type / example | Filled by | Update trigger | Owner |
|---|---|---|---|---|---|---|
| 1 | **Company Name** | The target/buyer/investor | text — "Mandala Capital" | analyst on add | once | analyst |
| 2 | **HQ** | Head-office location | text — "Mumbai" | analyst on add | static | analyst |
| 3 | **Initial email** | Date first email sent (**the cadence anchor**) | date — 2026-05-18; *or* a text token when not yet sent ("Priya Mam reach out", "Contact not found") | analyst | once, on first send | analyst |
| 4 | **Status** | **Overwrite-in-place**: date of latest follow-up **or** a text token that STOPS the schedule ("Got response", "Bounced", "Vishnu got response", "Contact not found") | date **or** text | analyst | every touch / on reply/bounce | analyst |
| 5 | **Type** | **Counterparty category** — PE, FO, PMS, PE/PC, PE/VC, VC, Strategic | short code | analyst on add | rare | analyst |
| 6 | **Rationale** | Deal thesis for *this* company | free text | analyst | as learned | analyst |
| 7 | **Revenue from source** | Raw revenue as sourced | text/number, often blank | analyst | static | analyst |
| 8 | **Rev (INR Cr)** | Converted via the sheet's exchange rate | number | analyst / formula | static | analyst |
| 9 | **Headcount** | Employee count | number, often blank | analyst | static | analyst |
| 10 | **Website link** | Company site | url | analyst | static | analyst |
| 11 | **Contact Name (1/2)** | Inline person(s) — *final* sheets carry **two** | text | analyst | when found | analyst |
| 12 | **Designation (1/2)** | Their title | text | analyst | when found | analyst |
| 13 | **Email Id (1/2)** | Their email | email | analyst | when found | analyst |
| 14 | **Linkedin (1/2)** | Their LinkedIn | url | analyst | when found | analyst |
| 15 | **Relevant Investments** | Portfolio cos relevant to the deal | text — "Godavari Biorefineries" | analyst | as researched | analyst |
| 16 | **Bucket** | **SOURCING LAYER** — priority/thesis band. **Meaning is per-engagement:** GAIL → *Direct / Secondary / Strategics*; 22by7-PE → *"Indian PEs with related portfolio companies" / "Foreign PE … having Indian offices" / …*; PE-portfolio → *"Expand Indian presence" / "Expand Asian presence" / "Offshore/onshore expansion"* | free-text label | analyst on add | rare | analyst |
| 17 | **Previous contact** | Have we contacted them before (**warm/duplicate flag**) | Yes/No | analyst | on add | analyst |
| 18 | **Regarding** | Which client/deal this outreach is about (for shared sheets) | text | analyst | on add | analyst |
| 19 | **Holding company** + website | Portfolio co → owning PE cross-link | text/url | analyst | static | analyst |

Header block per sheet: `[Client] target/buyer name`, `Exchange rate as on date = X`, a running
**count**.

### 2.3 Email Scheduler sheet — column dictionary

| Excel column | Meaning |
|---|---|
| **Company name** | Mirror of the master row |
| **Check to previous sheets/page** | "Yes" if this company already exists on another sheet — a **cross-list dedup/join check** |
| **Regarding** | The deal/client context |
| **Initial date** | Mirror of the master's Initial email (**fixed anchor**) |
| **Status** | Mirror of master Status — **text here blanks the whole follow-up row (= STOP)** |
| **Bi-weekly follow up ×4** | **Computed** dates: `initial + 14, +28, +42, +56` |
| trailing cells | "Done" per completed follow-up, or a **number = days remaining**, e.g. `Done | Done | 10 | 24` = FU1&2 done, next in 10d, one after in 24d |
| **Follow ups (in days)** | 10 / 24 / 38 … days-until-next columns |
| Header **"Next set of emails due in (days)"**, **Count**, **Check** | queue countdown + integrity check |

**Mechanics proven by the data:** interval = **14 days**, **4 follow-ups**, then **cold**; any
text token in Status freezes the row; "Check to previous sheets = Yes" is a duplicate signal.

### 2.4 Contact List — column dictionary (firm-wide, response-driven)

| Excel column | Meaning | Example |
|---|---|---|
| **Company** | The company they're at | "Cohesive Networks" |
| **Company type** | Strategic / PE / PE portfolio / FO / Investment bank / Independent consultant / PE-PC / PE-VC | mirrors master Type |
| **Contact person** | The person | "Patrick Kerpan" |
| **Designation** | Title | "CEO" |
| **Email / Phone number** | Either | email or +91… |
| **Reason** | **The client/mandate** this touch belongs to | "22by7", "GAIL", "22by7/GAIL", "Various" |
| **Engagement** | Buy-side / Sell-side / Fundraise / Various | |
| **Date Connected** | When they connected/replied | date |
| **Mode** | Email / Phone call / LinkedIn | |
| **POC** | The analyst who owns it | "Vighnesh" |
| **Remark** | **Positive / Negative** outcome | |
| **Comments** | Running free-text log of the interaction | "Scheduling call; call done; …" |

**Takeaways that drive the model:**
- The Contact List is **built from responses** — only contacted/connected companies appear.
- **Multiple contacts per company** = multiple rows (Cohesive ×2, Abacus ×2, Happiest Minds ×2,
  Midis ×2, FFL ×2, Asha ×2, Stakeboat ×2, I-Tracing ×2, Digitide ×2).
- **The same company recurs across clients/engagements** — Trunorth is on 22by7 *sell-side* **and**
  GAIL *fundraise*; Convergent Finance on GAIL *fundraise* **and** a PE *buy-side*; Kedaara,
  Samara, Navis, Gaja repeat. This is a **firm-wide global contact DB with cross-mandate reuse**,
  keyed by (person, company) and *tagged* with client + engagement + POC per interaction.
- `Reason` proves a single contact can serve **multiple clients** ("22by7/GAIL", "Various").

---

## 3. Field-by-field mapping: Excel → data model → API → UI (with gaps)

Legend: ✅ present & correct · ⚠️ present but wrong/partial · ❌ missing.

### 3.1 Master Sheet → `companies` (+ derived primary `contacts`) + `outreach_schedules`

| Excel column | Data model (today) | API (today) | UI (today) | Verdict |
|---|---|---|---|---|
| Company Name | `companies.company_name` | `company_name` | grid/table/detail | ✅ |
| HQ | `companies.hq` | `hq` | shown | ✅ |
| Initial email (date) | `outreach_schedules.initial_date` (set on first `INITIAL_EMAIL`, immutable) | `initial_date` computed in `_enrich_company` | detail/grid | ✅ correct (append-only anchor) |
| Status (date part) | derived from events + cadence | `days_remaining`/`next_due_date` | CadenceBadge | ✅ |
| Status (text token) | `companies.status` enum **+** schedule stop | `status` | StatusBadge | ⚠️ stored **and** event-driven → drift (see BUG-1) |
| **Type (PE/FO/VC/Strategic…)** | split across `companies.category` (6-enum) **and** dead `companies.bucket` | `category` | grid groups by category; detail shows `bucket` | ⚠️ **lossy + inconsistent** (§4 BUG-2, BUG-3) |
| Rationale | `companies.rationale` | `rationale` | detail Notes | ✅ but not on add form (❌ BUG-6) |
| Revenue from source | `companies.revenue_source` | `revenue_source` | detail | ⚠️ not on add form |
| Rev (INR Cr) | `companies.revenue_inr_cr` | `revenue_inr_cr` | detail | ⚠️ not on add form; exchange-rate conversion not wired (mandate has `exchange_rate` but nothing converts) |
| Headcount | `companies.headcount` | `headcount` | detail | ⚠️ not on add form |
| Website link | `companies.website` | `website` | detail/add | ✅ |
| **Contact Name/Designation/Email/LinkedIn (inline)** | `contacts.*` (separate row) | `primary_contact` summary | Contacts tab | ❌ **not captured on add**; Excel's inline contact is lost (BUG-6, requirement A/B) |
| Relevant Investments | `companies.relevant_investments` | `relevant_investments` | detail Notes | ⚠️ not on add form |
| **Bucket (sourcing layer)** | `companies.bucket` `String(100)` — **"preserved, not read"** ([company.py:45](backend/app/models/company.py#L45)) | passthrough | detail only; free-text on add | ❌ **the MVP "Sourcing Layers" feature lives in a dead column** (BUG-3) |
| Previous contact (warm flag) | — (only advisory fuzzy dedup) | `duplicate_warnings` | banners | ⚠️ company-level only; **no warm-contact reuse** (§6) |
| Regarding | `outreach_schedules.regarding` | `regarding` | detail | ✅ under-surfaced |
| Holding company link | ❌ none | — | — | ❌ missing (secondary) |
| Exchange rate | `mandates.exchange_rate` | on mandate | not used in company revenue | ⚠️ orphan field |

### 3.2 Contact List → `contacts`

| Excel column | Data model | API | UI | Verdict |
|---|---|---|---|---|
| Company | `contacts.company_id` (→ company → **one** mandate) | join | — | ⚠️ **mandate-siloed**, not firm-wide (BUG-4) |
| Company type | join `companies.category` | — | — | ⚠️ (via category, lossy) |
| Contact person | `contacts.contact_person` | ✅ | list/detail | ✅ |
| Designation | `contacts.designation` | ✅ | ✅ | ✅ |
| Email / Phone | `contacts.email` + `contacts.phone` | ✅ | email only in list | ⚠️ phone hidden in list |
| **Reason (client)** | `contacts.reason` (free text) | ✅ | ❌ not shown/filtered | ❌ can't slice contacts by client |
| Engagement | `contacts.engagement` enum | ✅ | shown/filter | ✅ |
| Date Connected | `contacts.date_connected` | ✅ | ❌ not in list | ⚠️ |
| Mode | `contacts.mode` enum | ✅ | ❌ not shown | ⚠️ |
| POC | `contacts.poc_owner_id` | ✅ | ❌ not shown/filter | ❌ can't slice by owner |
| Remark (Positive/Negative) | `contacts.remark` (free text) | ✅ | edit only | ⚠️ should be a typed sentiment + shown |
| Comments | `contacts.comments` | ✅ | ❌ not in contact-dialog at all | ❌ can't capture the running log |

The **fields exist** on the model; the **capture flow and the firm-wide surface do not**.

### 3.3 Email Scheduler → `outreach_schedules` + computed cadence — ✅ the strongest area

`compute_cadence` ([cadence.py:54](backend/app/services/cadence.py#L54)) implements exactly the
Excel math (`initial + (n)·interval`, days-remaining, overdue). `/schedule/needs-initial`,
`/due`, `/overdue`, `/cold` ([schedule.py](backend/app/api/schedule.py)) reproduce the queue.
Cold-after-cap + restart-as-new-cycle (Slice 2) match "after 4 follow-ups it goes cold; analyst
swaps a contact and restarts." **Gaps:** the scheduler isn't shown *beside* the master sheet as
the linked view the analyst knows; "Check to previous sheets" is only the company dedup; the
14-day interval is per-schedule but not exposed as a firm/engagement default.

---

## 4. Bug & defect list (location · root cause · fix)

**BUG-1 — Company status is half-stored, half-computed (drift risk).**
`companies.status` is mutated directly by `PATCH /companies` and by `RESPONSE`/`BOUNCE` events
([companies.py:435](backend/app/api/companies.py#L435), [:617](backend/app/api/companies.py#L617)),
yet non-negotiable #2 says current status is computed. Two writers + a stored column → the master
Status can disagree with the event log. **Fix:** make `companies.status` a **derived projection**
recomputed from the latest status-bearing event (RESPONSE/BOUNCE/DECLINE/INITIAL/FOLLOW_UP) inside
the same transaction that appends the event; forbid free-form manual status edits except via a
logged event (the "overwrite one cell" UX still appends). Keep the column as a **cache** with a
single writer (a `recompute_status(company)` helper) so analytics stay fast but never drift.
`recompute_status` **must respect Phase 8's decision that COLD is a derived cadence state, not a
`CompanyStatus`** — the single writer maps events → NOT_CONTACTED/CONTACTED/RESPONDED/… only; cold
is read from the current cycle's `EXHAUSTED` stop, never written into the status column.

**BUG-2 — Two add paths write two different classification fields → guaranteed inconsistency.**
`CompanyDialog` writes `bucket` and leaves `category=OTHER`
([company-dialog.tsx:88-96](frontend/components/features/company-dialog.tsx#L88)); the grid's
`InlineAddRow` writes `category` and never sets `bucket`
([grid/page.tsx:176-183](frontend/app/(app)/projects/[id]/grid/page.tsx#L176)). A company added
from the Master List page is invisible to the grid's category grouping; one added from the grid
has an empty Bucket on its detail page. **Fix:** one add component, one classification model (§7).

**BUG-3 — The "Sourcing Layers" MVP feature is a dead column.**
`companies.bucket` is explicitly "preserved, not read" ([company.py:45](backend/app/models/company.py#L45));
the grid hardcodes the 6-value `CompanyCategory` for grouping. The analyst's real segmentation
axis (Direct/Secondary/Strategics; thesis bands) has no first-class home. **Fix:** promote
sourcing layer to a first-class per-engagement dimension (§7.3).

**BUG-4 — Company (and therefore Contact) is mandate-scoped; the "firm-wide Master List / global
contact DB" cannot exist.** `companies.mandate_id` NOT NULL ([company.py:27](backend/app/models/company.py#L27)),
`contacts.company_id` NOT NULL ([contact.py:24](backend/app/models/contact.py#L24)). The same
entity is physically duplicated per mandate (the seed even creates 8 deliberate dupes on purpose).
Requirement A (single source of truth, continuously enriched, cross-engagement reuse) is
structurally impossible today. **Fix:** master-company + engagement-placement model (§8-A).

**BUG-5 — Response logging never captures who responded (requirement B, "not good today").**
`LogOutreachDialog` collects only `event_type`, `occurred_on`, `notes`
([log-outreach-dialog.tsx:31-35](frontend/components/features/log-outreach-dialog.tsx#L31)). A
`RESPONSE` stops the schedule and sets status, but the person, their designation/email, the
positive/negative remark, and the comment are never captured — the Excel workflow's entire point.
`OutreachEvent.contact_id` exists but the UI can't set it. **Fix:** dedicated response-capture
flow (§8-B).

**BUG-6 — Add-company forms don't offer Excel column parity.**
`CompanyDialog` asks only name/mandate/**type**/source/hq/**bucket**/website; the grid inline row
asks name/**type**/hq. Revenue, headcount, rationale, relevant investments, inline contact,
category, and sourcing layer are all absent. **Fix:** full-parity add form (§7.4).

**BUG-7 — `CompanyType` (TARGET/BUYER/INVESTOR) is a redundant question with no Excel origin.**
It's derivable from `mandate.type` yet is asked on every add ([company-dialog.tsx:22](frontend/components/features/company-dialog.tsx#L22),
[grid/page.tsx:49](frontend/app/(app)/projects/[id]/grid/page.tsx#L49)) and randomly assigned in
seed ([seed.py:597](backend/app/seed/seed.py#L597)). It adds a decision the analyst never makes in
Excel. **Fix:** drop it from the add forms and **derive** it from `mandate.type`. Keep the column
as a *derived read* (don't hard-drop) until we confirm no buy-side deal needs to hold both targets
*and* buyers in one engagement — if it does, the derivation becomes the default, still not a form
question.

**BUG-8 — Dual "Grid view / Table view" for the same data (requirement C).**
Project detail links both `/projects/[id]/grid?mandate_id=` **and** `/companies?mandate_id=`
([projects/[id]/page.tsx:184-195](frontend/app/(app)/projects/[id]/page.tsx#L184)). Two layouts,
two code paths, two add behaviours (BUG-2). **Fix:** one unified engagement view (§8-C).

**BUG-9 — `find_duplicates` runs on every list enrich indirectly and on every create/detail.**
`GET /companies/{id}` calls `find_duplicates` (full candidate scan, cap 500) on every open
([companies.py:399](backend/app/api/companies.py#L399)); the list endpoint enriches each row with a
separate schedule query + follow-up count (`_enrich_company` per item,
[companies.py:268](backend/app/api/companies.py#L268)) — N+1 across the page. **Fix:** batch the
per-row schedule + follow-up counts in the list path (one query keyed by `company_id`), and make
detail dedup lazy/on-demand. (Cross-mandate service is already batched internally; the caller isn't.)

**BUG-10 — `analytics.get_response_by_bucket` is mislabeled and groups by the wrong axis.**
It groups by `category` but emits a field literally named `"bucket"`
([analytics.py:132-168](backend/app/services/analytics.py#L132)). The `"bucket"` key is an
**intentional compatibility shim** (docstring: "bucket→category cutover",
[analytics.py:137](backend/app/services/analytics.py#L137)), not a plain bug. Once sourcing layer
becomes real (§7.3), analytics must distinguish **category** response-rate from **sourcing-layer**
response-rate. **Fix:** two endpoints/keys, correctly named — and note this is a **breaking change
to the `use-analytics.ts` / dashboard contract** (response shape + key rename), not just an
internal relabel; version it and update the frontend consumer in the same slice.

**BUG-11 — `list_companies` re-runs the filter twice** (once for IDs via `base_q.whereclause`,
once paginated) ([companies.py:249](backend/app/api/companies.py#L249)). Works, but fragile
(`.whereclause` drops joins) and doubles query cost. **Fix:** single filtered subquery reused for
count + page.

**BUG-12 — Contact `remark` is free text but semantically Positive/Negative** (the Excel column is
effectively an enum). No way to filter "show me all positive responses." **Fix:** add a typed
`sentiment` (POSITIVE/NEGATIVE/NEUTRAL) alongside free-text remark; surface as a filter.

---

## 5. Redundancy / removal list (what to cut and why)

| Remove / collapse | Where | Why |
|---|---|---|
| **`CompanyType` enum on the add UX** | forms, grid, dialog | Redundant with `mandate.type`; no Excel origin (BUG-7). Derive server-side; keep the column only as a derived read if analytics need it, else drop. |
| **The `bucket` *string* as a free-text field** | add dialog | Replace with the structured **sourcing layer** picker (§7.3). Keep the column during migration for backfill only, then retire. |
| **`FINANCIAL_SPONSOR` category** | `CompanyCategory` | Overlaps `PRIVATE_EQUITY`; invented, not in Excel. Collapse into PE (or into the new firm-configurable vocabulary). |
| **"Table view" route** | `/companies?mandate_id=` link on project detail | Superseded by the single unified engagement view (§8-C). Keep `/companies` only as the **firm-wide master search**, not as a per-mandate table. |
| **Two add code paths** | `CompanyDialog` + `InlineAddRow` | Collapse to one `<AddCompany>` used both as a dialog and as an inline grid row (§7.4). |
| **Random `source`/`source_quality`/`type` in seed** | [seed.py:591-607](backend/app/seed/seed.py#L591) | Not in Excel; makes analytics noisy. Keep source/source_quality as optional secondary fields, but stop randomising; default them and hide behind an "advanced" disclosure. |
| **Double filter execution** | `list_companies` | BUG-11. |

**What we should *not* be doing (scope discipline):** no email/webhook send integration this
phase (hard guardrail carried from async-tinkering-robin.md); analytics beyond response-rate /
overdue / cold / by-analyst are secondary; source-quality analytics stay minimal. The two MVP
features (Scheduler, Sourcing Layers) and the two core sheets come first.

---

## 6. Connectivity / interconnectivity map (requirement E)

Target model — every arrow is a live link, not a coincidence of names:

```
        ┌─────────────┐        ┌──────────────────┐
        │   PROJECT   │ 1───n  │    ENGAGEMENT     │  (= Mandate: sell/buy/raise)
        │  (client)   │        │  + follow_up_cap  │
        └─────┬───────┘        │  + exchange_rate  │
              │                └─────────┬─────────┘
              │                          │ 1
              │                          │ defines
              │                          n
              │                 ┌────────────────────┐
              │                 │   SOURCING LAYER   │  (per-engagement, ordered bands)
              │                 └────────┬───────────┘
              │                          │ 1
   firm-wide  │                          │ n
┌─────────────▼─────────┐   n   ┌────────▼────────────┐
│   COMPANY (master)    │◄──────│ ENGAGEMENT PLACEMENT│  (company × engagement)
│  static facts, shared │   1   │  category, layer,   │
│  enrichment by ALL    │       │  rationale, status  │
└──────┬────────────────┘       └─────────┬───────────┘
       │ 1                                 │ 1
       │ n                                 │ n
┌──────▼────────┐                 ┌────────▼──────────┐
│   CONTACT     │◄────────────────│ OUTREACH SCHEDULE │ (cycle; anchor; cadence)
│ (firm-wide,   │   targets       │  is_current,      │
│  company-     │                 │  cycle_number     │
│  scoped)      │                 └────────┬──────────┘
└──────┬────────┘                          │ 1
       │                                    │ n
       │        ┌───────────────────────────▼──────────┐
       └───────►│  OUTREACH EVENT (append-only log)     │
        logged  │  INITIAL/FOLLOW_UP/RESPONSE/BOUNCE/…   │
        against │  → recomputes placement.status        │
                │  → RESPONSE captures/links a CONTACT   │
                └───────────────────────────────────────┘
```

**Broken/absent links today and the fix:**

1. **Company ↔ Project** — only via `mandate`; the firm-wide master doesn't exist. → master
   Company + placements (§8-A).
2. **Response ↔ Contact** — `OutreachEvent.contact_id` exists but is never set by the UI. →
   response-capture flow writes the contact and links the event (§8-B).
3. **Contact ↔ multiple engagements/clients** — a contact is stuck on one mandate-siloed company.
   → firm-wide contact on the master company; per-touch client/engagement come from the events
   (§8-A/B). This makes "Trunorth reused across GAIL + 22by7" one record with two engagement tags.
4. **Sourcing Layer ↔ grid/analytics/scheduler** — layer is dead. → first-class dimension used to
   group the grid, filter the scheduler, and slice analytics (§7.3, §8-C, BUG-10).
5. **Warm-contact reuse detection** — dedup is company-name-only. → extend the intelligence to
   surface *"this company/person was already contacted by <analyst> for <client> — reply was
   Positive on <date>"* (the Excel "Previous contact = Yes"), on add **and** on response (§8-E).
6. **Exchange rate ↔ revenue** — `mandates.exchange_rate` is an orphan. → use it to render
   `revenue_source` → `revenue_inr_cr` on entry (§9 add form).
7. **Research long-list ↔ active master** — `PE names` / `Remaining PE companies` staging has no
   home. → an optional **Long-list/backlog** status on a placement, promotable into active outreach
   (secondary; §9).

---

## 7. Redesigned classification, segmentation & add-company (requirement D — the centrepiece)

### 7.1 The problem, precisely

The analyst has a **two-axis** mental model inside an engagement:

- **Category** = *what kind of counterparty* (PE, VC, Strategic, Family Office, PMS, PE/Credit…).
- **Sourcing layer / Bucket** = *which priority/thesis band* (Direct vs Secondary vs Strategics;
  "Indian PE w/ related portfolio" vs "Foreign PE…"; "Expand Indian presence" vs "Offshore…").

The prototype **flattened both into one 6-value `CompanyCategory` enum**, kept a **dead `bucket`
string**, and added a **third redundant `CompanyType`**. Result: lossy (PMS, PE/PC, PE/VC can't be
expressed), inconsistent (two add paths write different fields — BUG-2), and the MVP's "Sourcing
Layers" feature has no real implementation (BUG-3).

### 7.2 Axis 1 — Category as a **firm-configurable vocabulary**, not a rigid enum

Replace the fixed enum with a firm-scoped lookup so real-world codes survive:

- New table `company_categories` (`id, firm_id, name, code, sort_order, archived_at`), seeded with
  **Strategic, Private Equity, Venture Capital, Family Office, PMS, Private Credit, Investment
  Bank, Holding/Corporate, Other**. A firm can add one (e.g. "Sovereign Fund") without a migration.
- **Phase 2a:** `companies.category_id` FK (replaces the `category` enum on the existing per-mandate
  company). **Phase 2b:** moves to `placement.category_id`, so the *same* master company can be a
  "Strategic" buyer in one deal and an "Investor" in a raise, exactly as Excel shows.
- Keep a stable `code` so analytics/colour mapping are deterministic; `native_enum=False` is no
  longer needed because it's data, not DDL.
- **Migration:** map current `CompanyCategory` → seeded rows (STRATEGIC→Strategic,
  PRIVATE_EQUITY+FINANCIAL_SPONSOR→Private Equity, VENTURE_CAPITAL→Venture Capital,
  FAMILY_OFFICE→Family Office, OTHER→Other). Preserve old `bucket` text as the seed for Axis 2.

> Trade-off: a lookup table is slightly more join-heavy than an enum, but it's the only way to
> stop losing PMS/PE-PC/PE-VC and to let firms self-serve. Cache the small per-firm list.

### 7.3 Axis 2 — **Sourcing layers** as a first-class, per-engagement, ordered dimension (the MVP feature)

- New table `sourcing_layers` (`id, firm_id, mandate_id, name, sort_order, archived_at`). Layers
  belong to an **engagement** because their meaning is per-engagement (GAIL's *Direct/Secondary/
  Strategics* ≠ 22by7's thesis bands).
- **Phase 2a:** `companies.sourcing_layer_id` FK (nullable → "Unsorted"). **Phase 2b:** moves to
  `placement.sourcing_layer_id`.
- When an engagement is created, seed it with a sensible default set the partner/analyst can
  rename/reorder/add to (e.g. *Direct, Secondary, Strategic* for a raise; empty for a fresh deal).
- **This drives the working grid's confirmed nested grouping:** Sourcing-layer **bands** →
  **Category** sub-groups within each band → company rows (Band → Category → companies), both levels
  collapsible; a Group-by control can flatten. See §8-C. *(Note: this confirms "Sourcing Layers" =
  the segmentation bands, not a research→active funnel — the funnel stays a secondary "stage" idea.)*
- **Migration/backfill (best-effort — NOT a clean split):** Phase 8 already consumed `bucket` to
  seed `category`; the *same messy column* now also seeds layers, so it cannot be a clean source
  for both. For each engagement, create layers from the distinct legacy `bucket` values seen on its
  companies, in first-seen order; point companies (Phase 2a) / placements (Phase 2b) at them;
  everything unmapped → **"Unsorted"**, flagged for analyst review in the grid. Treat this backfill
  as a starting point the analyst corrects, not ground truth. (See §11 for the migration harness.)

> Why per-engagement and ordered: the Excel bands are ordered priority tiers ("Direct" before
> "Secondary") and differ by deal. A global enum can't model "Expand Indian presence" for one
> deal and "Direct" for another. Ordering gives the grid its band sequence for free.

### 7.4 The redesigned Add-Company experience (Excel-column parity, one component)

**Before (today):**

```
New company
─────────────────────────
Company name*         [__________]
Mandate*              [▾ select ]
Type   [▾ Target]     Source [▾ Proprietary]
HQ [______]   Bucket [free text]     ← dead column
Website [https://]
                       [Cancel] [Create]
```
Problems: asks the redundant Type; free-text dead Bucket; no revenue/headcount/rationale/contact;
writes `bucket`, not `category` (BUG-2/6/7).

**After — one `<AddCompany>` used as a dialog *and* as the grid's inline expander:**

```
Add company — Engagement: 22by7 · Sell-side           [why these fields? ⓘ]
──────────────────────────────────────────────────────────────────────────
Company name*  [ Mandala Capital            ]   ⚠ warm: contacted by Priya for
Website        [ mandala-capital.com        ]      GAIL · reply Positive 18 May → reuse?
HQ             [ Mauritius ]   Headcount [   ]
────────────────────────── Classify ─────────────────────────────
Category*      [▾ Private Equity ]     Sourcing layer* [▾ Direct ▾ +new]
Rationale      [ Food & agriculture focused …                       ]
Relevant investments [ Godavari Biorefineries                       ]
Revenue (source) [ $70m ]  →  Rev ₹Cr [ 585 ] (auto @ 83.6)  [advanced ▾]
────────────────────────── Primary contact (optional) ───────────
Name [ Aditya Mody ]  Title [ Managing Director ]
Email [ amody@… ]     LinkedIn [ … ]        [+ add second contact]
──────────────────────────────────────────────────────────────────────────
                                    [Cancel]  [Add & log initial email ▾] [Add]
```

Key changes:
- **Engagement is the context, not a question** (prefilled from the grid/route). Category +
  Sourcing layer are the two real axes; **Type is gone** (derived from engagement).
- **Full Excel parity**: HQ, headcount, rationale, relevant investments, revenue (with live
  exchange-rate conversion from the engagement's `exchange_rate`), and the **inline primary
  contact** (one or two — matching `PE porfolio names final`).
- **Warm/duplicate nudge inline at the name field** — company- *and* contact-level (§8-E),
  advisory, non-blocking; offers "reuse existing company/contact."
- **"Add & log initial email"** split-button starts the cadence in one action (the analyst's
  real first move), appending an `INITIAL_EMAIL` event — never mutating anything.
- One component, one write path → BUG-2 gone.

---

## 8. Concrete backend + frontend changes for requirements A–E

### 8-A. Master List = firm-wide company DB (requirement A) — **interim bridge in the MVP, converge later**

> **Confirmed scope: the "interim bridge."** Requirement A ("single source of truth… firm-wide DB
> continuously enriched by all analysts") is honoured **in the MVP** via a shared `company_profiles`
> table — *without* the risky FK cutover. The full master/placement split is a **later convergence
> (Phase 2b)**, not a blocker. This gives "one company record, enriched by all" now and defers only
> the highest-risk data op.

**Phase 2a — the interim bridge (ships in the MVP):**
- New `company_profiles` (firm-scoped): the **shared, deduped company record** — name, hq, website,
  linkedin, headcount, revenue_source, revenue_inr_cr, plus normalized `name_key`/`domain_key`.
  This is the "single source of truth" enriched by **every** analyst.
- Existing per-mandate `companies` gains `profile_id` FK and keeps **deal-specific** fields only
  (category_id, sourcing_layer_id, rationale, relevant_investments, status cache). Schedules,
  events, and contacts **stay exactly where they are** — no FK moves, no cadence risk.
- **Enrichment writes to the profile.** Add-company (§7.4) upserts the profile by name/domain then
  attaches the per-mandate row; `PATCH` of a static fact writes the **profile** (so a colleague's
  update to Trunorth's revenue shows on every engagement); logging a response can enrich it too
  (Req A "logging a response updates it"). Appends an enrichment `NOTE` for audit.
- **API:** `GET /companies` = firm-wide master search over profiles (name/domain/category/HQ),
  each with its per-engagement placements summary. `GET /companies?mandate_id=` still returns the
  per-mandate rows for the grid. `POST /companies` upserts profile + creates the per-mandate row.
- **Migration (lower blast radius than the full split):** create `company_profiles`; dedupe existing
  per-mandate `companies` into profiles by `normalise_name`/`extract_domain` (reuse
  [cross_mandate.py:46-66](backend/app/services/cross_mandate.py#L46)); set each `companies.profile_id`.
  **Because schedules/events/contacts are untouched, an imperfect dedupe is recoverable** (worst case:
  two profiles for one entity — merge later), not a broken-cadence outage. Still gated by the
  dry-run dedupe report below.

**Phase 2b — convergence to a single master + placements (later, optional):**
- Fold `company_profiles` + per-mandate `companies` into one master `Company` +
  `engagement_placements` (`id, firm_id, mandate_id, company_id, category_id, sourcing_layer_id,
  rationale, relevant_investments, status, …`); re-point `outreach_schedules`/`outreach_events` to
  the placement; contacts become firm-wide on the master company. Only do this once the bridge has
  proven the shared-record model in production.

**Migration & rollback harness (applies to the bridge dedupe *and*, more strictly, the 2b cutover —
this is the SQLite footgun Phase 8 hit on the unique-constraint swap):**
1. **Dry-run dedupe report.** A read-only script emits the proposed profile merges
   (`normalise_name`/`extract_domain` clusters + conflicting facts). A human reviews/approves —
   dedupe is *never* auto-applied.
2. **Additive-first.** Bridge: add `company_profiles` + `profile_id` alongside; dual-write. 2b:
   build master + placements alongside before any FK move.
3. **Cutover with `batch_alter_table`** (2b only): re-point `outreach_schedules.*`,
   `outreach_events.company_id`→placement, flip `companies.mandate_id` nullability (the mechanism
   migration `c1d2e3f4a5b6` used).
4. **Verification invariants.** After each step assert: profile/placement counts vs. source rows;
   no orphaned schedule/event/contact; one `is_current` cycle per company; `initial_date` immutable.
5. **Reversible.** Tested `downgrade`; run `upgrade`→`downgrade`→`upgrade` clean on SQLite in CI.

### 8-B. Response → Contact capture (requirement B)

**Frontend — a dedicated "Log response" flow** (replaces the generic dialog for RESPONSE, and
upgrades it for all types):
- When the analyst clicks **Log → Response** (from grid row, company detail, or the scheduler
  queue), the dialog expands to capture the **person**: pick an existing company contact **or**
  create new (name, designation, email/phone, LinkedIn), **Mode** (Email/Call/LinkedIn),
  **Sentiment** (Positive/Negative/Neutral), and **Comments** (the running log).
**Where does client / engagement / POC / sentiment / comments live — the contact, or the touch?**
The Excel Contact List proves a *single contact serves multiple clients* (Reason = "22by7/GAIL",
"Various"). A single-valued column on the contact row cannot represent that. **Decision (resolves
the review's contradiction): the per-touch context lives on the EVENT, not the contact.**

- **Contact row = identity + latest-touch *cache*.** Identity fields (name, designation, email,
  phone, LinkedIn, `is_primary`) are the durable person record. The existing
  `contacts.{reason, engagement, mode, date_connected, remark, comments}` columns are **repurposed
  as read caches of the *most recent* touch** (recomputed from the newest event referencing this
  contact), so lists render fast without a join. Migration note: keep the columns; add a one-line
  backfill that seeds them from each contact's latest event; they are henceforth cache, never the
  source of truth.
- **Touch context = the event.** Each `RESPONSE`/`CALL`/etc. carries its own `client`(= mandate
  → project), `engagement`, `mode`, `occurred_on`, `sentiment`, and `notes`. A contact touched for
  two clients is two events → the firm-wide Contact List shows the person once with *both* client
  tags (one row per person, expandable to touches — exactly the Excel rows).
- On submit: append a `RESPONSE` event **with `contact_id` + touch context**; upsert the contact
  *identity*; refresh its latest-touch cache; optionally set primary; the schedule stops (RESPONDED)
  and status recomputes via the single writer — one transaction, events append-only.

**Backend:** extend `POST /companies/{id}/events` (Phase 2b: `/placements/{id}/events`) to accept an
optional inline-contact payload **and per-touch context** (`sentiment`, `mode`, `engagement`);
when present, upsert the contact *identity*, set `event.contact_id`, and refresh the contact's
latest-touch cache. Add typed `sentiment` (POSITIVE/NEGATIVE/NEUTRAL) — to the **event** as source
of truth, mirrored to the contact cache (BUG-12). Keep `EVENT_STOP_MAP`/`EVENT_STATUS_MAP`
([cadence.py:135](backend/app/services/cadence.py#L135)) but drive company/placement `status` via
the single `recompute_status` writer (BUG-1; COLD stays derived, never a status).

### 8-C. Unified company view — drop the Grid/Table split (requirement C)

- **One view per engagement:** keep the dense, sticky-header, category-collapsible **grid** as the
  single surface ([grid/page.tsx](frontend/app/(app)/projects/[id]/grid/page.tsx) is the base) and
  **delete the "Table view" link** on project detail
  ([projects/[id]/page.tsx:190-195](frontend/app/(app)/projects/[id]/page.tsx#L190)).
- **Nested grouping (confirmed "both/nested"):** default view is **Sourcing-layer bands →
  Category sub-groups → company rows**, both levels collapsible with sticky band + sub-group
  headers. A **Group-by** control [Band→Category (default) | Category only | Status | None]
  flattens when the analyst wants a flat sort. (Excel parity: Bucket bands with Type segmentation
  inside them.)
- Grid columns (Excel-faithful, dense): Company · HQ · Rev ₹Cr · Status · Cadence (badge +
  why-tooltip) · Next due · Days (server-computed ↻) · Primary contact · Log — with a small Category
  chip on each row for when the view is flattened. Inline add row per Category sub-group (the §7.4
  component, collapsed).
- `/companies` remains, repurposed as the **firm-wide Master search** (not a per-mandate table),
  with category/HQ/status filters and cross-engagement columns.
- **Backend:** Phase 2a — `GET /companies?mandate_id=&sourcing_layer_id=&category_id=` (2b —
  `GET /placements?…`) with grouping metadata in the summary envelope; batch cadence enrichment
  (BUG-9).

### 8-D. Redesigned classification/segmentation — see §7 (backend model + grid grouping + add form).

### 8-E. Interconnectivity & warm intelligence (requirement E)

- **Warm-contact/company reuse** on add and on response: extend `find_duplicates`
  ([cross_mandate.py:69](backend/app/services/cross_mandate.py#L69)) to also return, per match,
  the **latest contact + sentiment + client + POC** ("contacted by Priya for GAIL — Positive, 18
  May"). Surface it inline at the add form's name field and as a banner when logging a response.
  Advisory, non-blocking, batched (already O(1)-capped).
- **Global Contact List surface:** a firm-wide `/contacts` upgraded to show Company · Category ·
  Person · Designation · Email/Phone · **Client (reason)** · Engagement · Date · Mode · **POC** ·
  **Sentiment** · Comments, filterable by client / engagement / POC / sentiment — the Excel Contact
  List, live.
- **Exchange-rate wiring:** compute `revenue_inr_cr` from `revenue_source` × engagement
  `exchange_rate` on entry (kills the orphan field, §3.1).

---

## 9. Intended feature set & screen/structure layout (end-to-end)

**Navigation (sidebar):** Dashboard · **Projects** · **Master List** (firm-wide companies) ·
**Contacts** (firm-wide) · **Scheduler** · Analytics · *(Partner)* Project Health · Settings.
Remove "Engagements" as a top-level (engagements live inside a project); keep a partner mgmt entry
under the project.

1. **Projects (individual "my book")** — analyst sees every project they're on; partner sees all.
   Row → project. *(Add a personal "My Companies" cross-engagement master as a secondary tab —
   answers the brief's "single master sheet vs multiple": offer **both**, engagement-grid default +
   personal roll-up.)*
2. **Project detail** — engagements grouped by side (sell/buy/raise) with headline stats; a project
   may hold several engagements (covers "mixture"). Each engagement → **one** grid (no dual view).
3. **Engagement grid (the heart)** — **nested**: Sourcing-layer bands (collapsible, ordered) →
   Category sub-groups → company rows → static facts + **server-computed cadence** → inline **Log**
   (initial/follow-up/response) → inline add row per sub-group with full parity + warm nudges. This
   *is* the Master Sheet + Email Scheduler fused, with the nested Sourcing-layer/Category structure.
4. **Company detail** — **shared profile facts (enriched by all analysts — the bridge)** · its
   per-engagement placements · contacts · append-only timeline · cadence/cycles (cold + restart).
   Show Category + Sourcing layer (not the dead `bucket`).
5. **Scheduler** — needs-initial / due / overdue / **cold** queues (already built); add
   sourcing-layer + engagement filters and a "restart cold" action inline.
6. **Contacts (firm-wide)** — the live Excel Contact List (§8-E), response-driven, cross-client.
7. **Analytics / Project Health (MD/partner)** — per-project + per-engagement health (built,
   [analytics.py:226](backend/app/services/analytics.py#L226)); add **response-rate by category**
   *and* **by sourcing layer** (fix BUG-10), per-analyst activity, cold load, layer coverage.
8. **Secondary (post-MVP):** research long-list/backlog status on placements (promotable),
   holding-company cross-links + PE-portfolio pivots, source-quality analytics, email send.

---

## 10. Four-perspective review

**Backend developer.** *MVP (bridge):* `company_profiles` (shared record) + `companies.profile_id` +
firm-config `company_categories` + per-engagement `sourcing_layers`; **schedules/events/contacts stay
put** (no FK moves); `recompute_status` single-writer (BUG-1, COLD stays derived); batched list
enrichment (BUG-9/11); dedupe backfill behind the dry-run report (reuse the normaliser). *Phase 2b:*
converge to one master `Company` + `engagement_placements` (schedules/events FK the placement,
contacts firm-wide). Every list endpoint keeps `visible_mandate_ids` scoping and soft-delete; the
cadence engine and cold/restart stay exactly as-is (they already match Excel).

**Frontend developer.** One `<AddCompany>` (dialog + inline) with Excel parity + warm nudges; one
engagement grid grouped by sourcing layer with a Group-by control; response-capture dialog that
writes the contact; firm-wide Contacts and Master List surfaces; company detail shows Category +
Sourcing layer, not `bucket`. Keep the dense, keyboard-first, server-computed-cadence design
language from DESIGN.md.

**Analyst.** Open my project → pick the engagement → see companies in **my sourcing-layer bands**
with live deadlines → add a company under a band with all its facts and the person, in one place →
one click logs the initial email and the clock starts → a reply lets me capture *who* replied and
whether it's positive, and that person appears in the firm Contact List against this client → after
4 silent follow-ups it goes cold; I swap the contact and restart → and when I add someone a
colleague already worked, the tool warns me and offers the warm contact. That is the spreadsheet,
automated.

**Full-stack.** The spine is **Project → Engagement → Sourcing Layer → (Company×Engagement
placement) → Contact → append-only Outreach → computed Scheduler**, with a firm-wide master Company
and Contact enabling reuse and the MD roll-up. Fixing the master-company split, the sourcing-layer
promotion, and the response→contact capture removes the three structural disconnects at once and
makes A–E cohere.

---

## 11. Build sequence — sized, phased, checklisted

**The ordering rule that fixes the review's contradiction:** Phase 2a keeps outreach
schedules/events FK'd to `company_id` (**untouched**) and adds the shared record as a *profile* the
per-mandate row points at — **no `placement` and no FK re-point until Phase 2b.** This delivers the
whole analyst experience *and* Req A's shared record without the master rewrite. Sizes are coarse:
**S** ≈ ½–1 slice-day, **M** ≈ 1–2, **L** ≈ 3+.

### Phase 2a — MVP (interim-bridge model; the analyst experience + Req A shared record)

**Slice A1 — Classification model (backend-first). Size: M.**
- [ ] `company_categories` — **firm-configurable vocabulary table** (confirmed), seeded from Phase 8's
      enum values **plus** PMS, Private Credit, Investment Bank, Holding/Corporate;
      `FINANCIAL_SPONSOR`→Private Equity. Include a partner-only **manage-categories** admin surface
      (Settings) since firms now self-serve the vocabulary.
- [ ] `sourcing_layers` (per-`mandate`, ordered `sort_order`) + a partner/analyst **manage-layers**
      control (rename/reorder/add) on the engagement.
- [ ] `companies.category_id` + `companies.sourcing_layer_id` (nullable) FKs — **on `companies`,
      not a placement.**
- [ ] Migration (`batch_alter_table` on SQLite): `category` enum → `category_id`; `bucket` →
      `sourcing_layers` **best-effort** (distinct non-null bucket per mandate → ordered layers;
      unmapped → "Unsorted"; flagged for review). Do **not** drop `bucket` (backfill source).
- [ ] Verification query + `upgrade`→`downgrade`→`upgrade` clean on SQLite; update Phase-8 tests
      that assert the `category` enum; pytest green.

**Slice A2 — Shared company profiles (the interim bridge, backend-first). Size: M/L.**
- [ ] `company_profiles` (firm-scoped shared record: name, hq, website, linkedin, headcount,
      revenue_source, revenue_inr_cr, `name_key`/`domain_key`); `companies.profile_id` FK.
- [ ] Dedupe backfill behind the **dry-run dedupe report** (§8-A): cluster existing per-mandate
      companies by `normalise_name`/`extract_domain`, human-approve, create profiles, set
      `profile_id`. **No FK moves on schedules/events/contacts** → imperfect dedupe is recoverable.
- [ ] Enrichment routing: static-fact `PATCH` writes the **profile** (visible on every engagement);
      `GET /companies` = firm-wide master search over profiles; per-mandate deal fields stay on
      `companies`. pytest: enrich Trunorth once → shows on both its engagements; dedupe invariants.

**Slice A3 — Unified grid + one add path (FE + light BE). Size: M/L.**
- [ ] Delete the "Table view" link on project detail (BUG-8); `/companies` = firm-wide master search.
- [ ] **Nested grouping (confirmed "both/nested"):** grid renders **Sourcing-layer bands →
      Category sub-groups → company rows**, both levels collapsible, sticky headers. A **Group-by**
      control [Band→Category (default) | Category only | Status | None] flattens on demand.
- [ ] One `<AddCompany>` (dialog **and** grid inline) with Excel parity: hq, headcount, rationale,
      relevant investments, revenue + live exchange-rate conversion, **category_id**,
      **sourcing_layer_id**, optional inline primary contact; **upserts the profile** then attaches
      the per-mandate row. Kills BUG-2/6/7. Type dropped from the form (derived).
- [ ] `GET /companies?mandate_id=&sourcing_layer_id=&category_id=` + **batched** per-row cadence
      enrichment and single filtered subquery (BUG-9/11).
- [ ] Company detail shows Category + Sourcing layer (not dead `bucket`) and the shared profile
      facts. Vitest nested grouping/add; Playwright add→appears, log-initial→cadence ticks.

**Slice A4 — Response → contact capture (FE + BE). Size: M.**
- [ ] Response dialog captures person (pick existing / new) + Mode + **Sentiment** + Comments.
- [ ] `POST /companies/{id}/events` accepts optional inline-contact + **per-touch context**; sets
      `event.contact_id`; upserts contact *identity*; refreshes the contact's latest-touch cache
      (per §8-B decision — context on the event, cache on the contact).
- [ ] `sentiment` typed on the event (source) + mirrored to contact cache (BUG-12).
- [ ] `recompute_status` single-writer (BUG-1); **COLD stays derived — no cold status enum.**
- [ ] Firm-wide Contacts surface: one row per person, client/engagement/POC/sentiment tags from
      events; filters by client/engagement/POC/sentiment.
- [ ] pytest: response sets `contact_id`; one contact shows under two clients; status recomputed;
      cold still derived. Vitest response dialog. *(B, BUG-1/5/12, req E contact surface.)*

> **End of 2a = the MVP.** Two core sheets + nested Sourcing Layers + Email Scheduler + a shared,
> all-analyst-enriched company record (the bridge) are live. Ship, demo, gather feedback before 2b.

### Phase 2b — Converge the bridge → single master + placements (later, highest risk). Size: L.

Runs **only after 2a** and **only behind the §8-A migration/rollback harness** (dry-run dedupe
report → additive dual-write → `batch_alter_table` cutover → verification invariants → tested
downgrade). Optional — the bridge may be sufficient for a long time; converge only when firm-wide
reuse (shared contacts, one physical company row) is worth the FK cutover.
- [ ] **B1 (additive):** fold `company_profiles` + per-mandate `companies` → one master `Company` +
      `engagement_placements`; dual-write; no FK moves yet.
- [ ] **B2 (cutover):** re-point `outreach_schedules`/`outreach_events`/contacts to placement/master;
      move `category_id`/`sourcing_layer_id` from `companies` → `placement`; verification invariants
      pass; `/companies` becomes true firm master, `/placements?mandate_id=` feeds the grid.
- [ ] **B3 (retire):** drop `companies.mandate_id` and the legacy `bucket` column; final down-migration
      tested. *(A, BUG-4.)*

### Phase 2c — Warm intelligence + analytics correctness + MD polish (secondary). Size: M.
- [ ] Contact-level warm-reuse nudges on add and response (Excel "Previous contact = Yes"); §8-E.
- [ ] Analytics: response-rate **by category** *and* **by sourcing layer** (BUG-10) — **breaking
      change to `use-analytics.ts`**, versioned + FE updated same slice; per-analyst / cold / layer
      coverage on the MD overview.
- [ ] Post-MVP: research long-list/backlog status (promotable), holding-company cross-links +
      PE-portfolio pivots, source-quality analytics. **No email/webhook send this phase.**

**Guardrails (every slice):** append-only events (restart = new cycle + logged event, never an edit);
server-computed cadence via `today_ist()`; AWAITING_INITIAL + immutable per-cycle `initial_date`;
firm-scoping/visibility on every endpoint; soft-delete; derived primary contact; COLD derived (not a
status); httpOnly cookie auth. Keep pytest/Vitest/Playwright green after each slice; update
PROGRESS.md.

---

## 12. Amendment (post-2a) — Sourcing Layer as the research→active funnel + "Push to Project + Side"

> Added after Phase 2a shipped. This **overrides the §7.3 decision** that "Sourcing Layers =
> segmentation bands, not a research→active funnel." Product owner's call — recording it so the
> churn is intentional. Full implementation prompt lives in `SOURCING_LAYER_PROMPT.md`.

**Redefinition.** **Sourcing layer now = the research→active sourcing funnel (ordered pipeline
stages), not per-deal thesis/priority bands.** A company flows:
`Research/Long-list → Shortlisted → Active outreach → Engaged → Passed`. Stage = the analyst's
*manual* pipeline position; **cadence stays the *computed* email clock, separate**. Entering
**Active outreach** prompts "log initial email" (starts the clock); **Engaged** aligns with a
RESPONSE event; **COLD stays derived, never a stage.** Open decision: make stages **firm-wide
configurable** (one funnel for all deals → clean "response-rate by stage" analytics) vs per-deal.

**Sourcing Layer feature (MVP).** Find buyers/targets/investors for a mandate and push them into
the CRM. Data = the firm's proprietary IB analyst DB + public sources (manual/CSV); external feeds
and AI ranking come later.
- **Ingest:** load the IB analyst DB into a firm-scoped **sourcing pool**, deduped/normalised
  (reuse `normalise_name`/`extract_domain` + `company_profiles`); add public companies via **CSV**
  with a dry-run dedup preview. Ingested companies enter at **Research/Long-list**.
- **Search the pool** by mandate criteria (sector/category, geography/HQ, size, type).
- **Enrichment cards:** revenue, headcount, HQ, website, key contact from the profile.
- **Later (architecture seams):** pluggable external data-source interface; Groq **AI-assisted
  ranking** by fit to the mandate thesis (`GROQ_API_KEY*` in `backend/.env`).

**"Push to Project + Side" (the core workflow — one shared action, two entry points).** Available on
**both** Sourcing Layer candidates **and** Master List rows. User picks a **Project** then a **Side**
(Sell/Buy/Raise); the company is pushed into **that project's engagement of that side** — the
analyst's active workspace (the grid). On push: link the shared **profile** (facts carry over), set
stage = **Active outreach**, **start the cadence**, **derive company type from the side**
(sell→Buyer, buy→Target, raise→Investor), and show **warm history** if worked before.
Side→engagement resolution: one match → straight in; several → ask which; none yet → offer to create
(partner) or show only existing sides; already present → surface, never duplicate. One code path.

**Master List = the firm-wide pool** (all companies, Research stage + everything sourced, all
details from every analyst/partner). Analyst default = **"My book"** (my companies grouped by
Project, sorted overdue → due-soon → awaiting-initial → rest); partner = firm-wide + group-by-analyst
for overlap/conflict. Grid = work one deal deeply; My book / Master = the cross-deal pool + worklist.
