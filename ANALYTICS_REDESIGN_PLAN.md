# Analytics Redesign — Plan (v2, grounded in the live app + real data)

> **This supersedes the v1 draft.** v1 was written off the product spec and my own assumptions.
> v2 is written after reading the actual page code and looking at the running app (analyst view,
> "Priya Sharma"). Every claim below traces to a file or a live screenshot, not to the old plan.
> **Page:** `/analytics` · `frontend/app/(app)/analytics/page.tsx`

## Evidence base (what I actually read)
- **Live app** — analyst view screenshots: 4 KPI cards, the volume/responses chart, the "recent 6w
  vs previous 6w" tiles, response-rate-by-category & by-sourcing-layer bars, by-engagement table,
  and the 12-row source-quality table. Data is **sparse** (206 emails, **8 responses**, 8 bounced,
  75 companies).
- **Reference pages (read in full or in depth):** `schedule/page.tsx` (1935 ln — the daily driver),
  `projects/page.tsx` (the ledger), `dashboard/page.tsx`, and the two **other analytics surfaces**:
  `analytics/projects/page.tsx` and `sourcing/analytics/page.tsx`.
- **Signatures of every page** (from the `// ── … signature` markers): Sourcing = "Database lens";
  Master = "Coverage cells" (+ "My book" / "Firm database" modes); Contacts = "Rolodex rail" +
  "person card"; Projects = "Sides spectrum"; Schedule = "Horizon rail"; Dashboard = "Triage gauge".
- **Shared system:** `globals.css` (Obsidian Amber / Daylight), `components/dashboard/*`
  (`Section`, `MetricRail`, `RankedBars`, `PipelineFunnel`, `TriageCommand`), `lib/labels.ts`,
  `hooks/use-analytics.ts`, `hooks/use-funnel-analytics.ts`, company dossier `BenchmarkStrip`.

---

## Phase 1 — Cross-page map (grounded)

### 1.1 The pages and their one signature each
| Page (route) | Analyst job | Signature instrument | Reuse for Analytics |
|---|---|---|---|
| Dashboard | "What now" | Triage **gauge** cockpit | Vocabulary only — don't re-gauge |
| Projects (`/projects`) | Per-client/engagement | **Sides spectrum** (typed load bar) | Deal-type hues; drill target |
| Sourcing (`/sourcing`) | Find targets | **Database lens** | Source/layer dimensions originate here |
| Master (`/master`) | Whole universe | **Coverage cells** | Drill target for "these companies" |
| Schedule (`/schedule`) | Work the queue | **Horizon rail** | Honest-signals doctrine; `?deal=N` drill |
| Contacts (`/contacts`) | The people | **Rolodex rail** | — |
| **Analytics (`/analytics`)** ← target | "Is outreach working" | *(none yet — to design)* | — |

**Each page spends its boldness on exactly ONE signature and keeps everything else quiet.** Analytics
must earn its own, not clone the gauge or the funnel.

### 1.2 THE BIG FINDING — analytics is fragmented across three routes
The nav's **Insights** group (`components/layout/nav.ts`) has *Analytics* (all roles) and *Project
health* → `/analytics/projects` (**partner only**). A third surface, *Sourcing analytics* →
`/sourcing/analytics`, is an **orphan** — reachable only via a "← Workspace" link from Sourcing, in
no nav. All three are "analytics," they overlap, and they are at **three different quality bars**:

| Surface | Question it answers | Data hooks | Quality |
|---|---|---|---|
| `/analytics` (this page) | Is my **outreach** working? (volume, replies, rates, segments) | `useAnalyticsOverview/Timeseries/ResponseByCategory/Layer/Sources/ByEngagement/ByAnalyst` | Redesigned-ish, but flawed (see Phase 2) |
| `/analytics/projects` "Project health" | How healthy is each **project/engagement**? (overdue/cold/needs-first + analyst activity) | `useProjectAnalytics`, `useByAnalyst` | **Pre-redesign** (generic `Card`, no mono, no signature) |
| `/sourcing/analytics` | Is my **sourcing** working? (funnel by stage, response-by-stage, **does AI-fit predict response**) | `useFunnelAnalytics` | **Pre-redesign** |

**Consequences that must drive the redesign:**
- **Duplication:** the main page's partner "Analyst performance" table runs the *same* `useByAnalyst`
  query as `AnalystTable` on Project health — two different-looking tables of the same numbers.
- **Two different funnels exist and must not be confused:** the *sourcing* funnel (pipeline stages
  RESEARCH→SHORTLIST→ACTIVE→ENGAGED→PASSED, on `/sourcing/analytics`) vs. the *outreach* outcome
  funnel (contacted→replied→interested) that `/analytics` should own. Naming has to disambiguate.
- **Discoverability:** genuinely useful analysis (AI-fit-vs-response, per-engagement health) is
  hidden. The flagship page should **cross-link** to these, not ignore or duplicate them.

→ **IA recommendation (see open decision):** keep three *focused* surfaces, unify their design
language, and make `/analytics` the **outreach-performance flagship** that cross-links to the
sourcing funnel and project health. Don't build one mega-page; don't leave them stranded either.

### 1.3 Shared design language I must inherit (from the code, exactly)
- **Numerals:** every count/percentage uses `MONO` (JetBrains) with `tabular-nums`; headlines use
  `DISPLAY` (Cormorant). Both Schedule and Projects leave a comment that Cormorant's old-style figures
  *break multi-digit counts* — so **numbers are never set in the serif.**
- **Deal-type hues (cross-page constant):** SELL_SIDE = emerald, BUY_SIDE = sky, CAPITAL_RAISE =
  violet (`schedule` `DEAL_TYPE_STYLE`, `projects` `SIDE_BAR`). Analytics' by-engagement/by-type views
  must adopt these — today they're amber-only, which breaks the app's color language.
- **Status dots:** NOT_CONTACTED muted · CONTACTED sky · RESPONDED emerald · INTERESTED violet ·
  DECLINED amber · BOUNCED destructive (`schedule` `STATUS_META`, `PipelineFunnel`). The outreach
  funnel must use these, not invent new stage colors.
- **Amber = the one warm accent / "at-or-above benchmark"** (`RankedBars`, `globals.css`). Keep it for
  emphasis, not for categorical series.
- **State vocabulary (match verbatim):** error → `AlertTriangle` + "Couldn't load X." + "Try again"
  (`refetch`); empty → icon + plain line + a CTA; no-match → "Clear search." (Projects page).
- **Honest-signals doctrine (Schedule, verbatim):** *"Nothing here is a fabricated prediction… No
  reply-likelihood %, no email-open tracking (no backend signal exists for those)."* Anything "smart"
  on Analytics must be a **deterministic re-read of real fields**, with denominators shown.

### 1.4 Shared data model + **real** drill-through routes (verified in code)
- `/schedule?deal=<mandateId>` scopes the queue to an engagement (Schedule reads `?deal`).
- `/projects/<id>` and `/projects/<id>?book=<engagementId>` (Project health's "Book →" link).
- `/companies/<id>` (dossier — carries the `BenchmarkStrip`: Touches, Days-to-response, Mandate
  response rate, each vs the mandate average).
- `/master` (the universe grid). These are the doorways Analytics figures should open. **Today every
  Analytics chart is a dead end.**

---

## Phase 2 — Audit (what the LIVE page + real data actually show)

### 2.1 Problems visible in the running app (analyst perspective)
1. **Noise shown as signal (the #1 issue).** With 8 total responses, segment rates are tiny fractions
   dressed as percentages: source-quality shows **PROPRIETARY·MEDIUM 50% (=1/2)**, REFERRAL·LOW 25%
   (=1/4); by-layer "Primary targets 20%" is 1/5. The page ranks and colors these as if they're
   real. **An analyst would be actively misled.** The app already solved this on `/sourcing/analytics`
   by always printing `(responded/placements)` and gating claims — Analytics must adopt that.
2. **Redundant KPIs.** "RESPONSE RATE 11%" and "RESPONDED 8 of 75" are the same number twice
   (8/75 ≈ 11%). One tile is wasted.
3. **Wrong denominator.** `responded_pct = responded/total` counts never-contacted companies against
   you (`services/analytics.py`). Reply rate should be replied ÷ **contacted**.
4. **The combined chart fails at this scale.** 8 responses vs 206 emails on one axis → the green
   response line hugs zero and reads as flat/empty; and the Y-axis tick labels render out of order
   ("4, 8, 2, 6, 0" in the screenshot). The instrument is unreadable exactly when the analyst needs
   the response signal most.
5. **"Recent 6w vs previous 6w" tiles are a confusing construct** — nobody thinks in split-halves;
   "was 0 prior → ↑9%" is an artifact of the window, not an insight.
6. **Everything dead-ends.** No figure links to the work.
7. **Messy dimension vocab in the data** (by-layer shows "Strategics" *and* "Strategic buyers",
   "Primary/Secondary targets" *and* "Secondary") — the page can't fix the data, but ranking noisy,
   near-duplicate buckets amplifies confusion; low-n recession (see 3.1) mutes it.

### 2.2 Feature audit — keep / modify / redesign (every control)
| Feature (live) | Verdict | Grounded reason & change |
|---|---|---|
| Header + "Last 12 weeks" select | **MODIFY** | Only the trend is period-scoped; the rest is all-time. Keep the control but label each panel "last N wks" vs "to date" (today it implies it filters everything). |
| KPI: Emails sent | **KEEP** | Real, useful; add period delta (`Metric.delta`). |
| KPI: Response rate 11% | **REDESIGN** | Recompute as reply ÷ contacted; becomes the primary headline number with coverage shown beside it. |
| KPI: Responded 8/75 | **REMOVE (merge)** | Duplicate of the rate. Reclaim the slot for **Interested** (pipeline value) or **Health** (overdue+needs-first from `overview`). |
| KPI: Bounced 8 | **KEEP→MODIFY** | Keep, but frame as a **hygiene** signal (bounce rate) with the status-red + icon, not a bare count. |
| Volume & responses chart | **REDESIGN** | Split into volume (**initial + follow-up**, stacked — `initial` is already in the payload, unused) and a separate **reply-rate strip**; fix the axis; never dual-axis. |
| Recent-6w-vs-previous-6w tiles | **REMOVE** | Replace with real period-over-period in the KPI deltas + the finding line. |
| Response rate by category (`RankedBars`) | **KEEP→FOLD** | Strong instrument; fold into one **Driver Board** with a dimension switch. Apply low-n recession. |
| Response rate by sourcing layer (`RankedBars`) | **FOLD** | Second copy of the same instrument → same board, switch dimension. |
| By-engagement table | **MODIFY** | Adopt deal-type hues; add overdue/needs-first (from `useProjectAnalytics`); make rows drill to `/projects/<id>?book=<id>`; show denominators. Complements Project health — cross-link, don't duplicate. |
| Source-quality (12-row table) | **REDESIGN** | It's a 2-D relation (source × quality) → **heatmap matrix**, cell = rate with **n in the cell**, low-n cells recessed. |
| Analyst performance table (partner) | **REDESIGN** | Stop duplicating `/analytics/projects`. Either cross-link to Project health, or keep a lean redesigned leaderboard here and drop it there — pick one home (open decision). Analyst (non-partner) gets a **personal scorecard** (your book vs firm) instead. |

### New features (each justified from the live gaps)
| New | Why (analyst value) | Data | Honest-signals check |
|---|---|---|---|
| **Finding line** (computed thesis) | Turns the wall of numbers into one plain, paste-into-a-partner-update sentence. | existing hooks | Deterministic ranker, min-sample gated (3.3) |
| **Conversion Spine** (outreach funnel: contacted→replied→interested) | The correct reframe of "response rate" + shows *where outreach leaks*; benchmark ghost + drill-through. | `overview.by_status` | Aggregate counts are healthy-n; safe |
| **Low-n recession (system-wide)** | The trust fix — signal separated from noise everywhere. | all rate hooks | This *is* the doctrine, applied |
| **Reply-timing** (touches & days-to-reply, firm/analyst) | Directly tunes cadence; generalizes the dossier's existing `BenchmarkStrip`. | **new endpoint** (5.3) | Distribution + median, denominators shown |
| **Cross-links** to Sourcing funnel & Project health | Surfaces the two hidden surfaces; ends the dead-ends. | existing routes | — |

---

## Phase 3 — Micro-UX

### 3.1 Low-n recession — the signature *treatment* (applies to every rate on the page)
A single shared helper decides how much to trust a rate:
- **Always print the denominator** next to every rate: `14% · 3/21` (pattern already on
  `/sourcing/analytics`).
- **Sample floor** `MIN_N` (start at 5, tunable): a rate whose `total < MIN_N` renders **muted/greyed
  with a "· n=2" tag**, is **excluded from ranking and from "best/worst" findings**, and never gets
  the amber "above-benchmark" treatment. Sort those rows to the bottom under a quiet "thin data" note.
- **Benchmark line stays**, but only healthy-n rows are compared to it.
This is the difference between the current page (misleading) and a trustworthy one — and it's the most
important single change.

### 3.2 States (match the app's vocabulary, no dead ends)
Loading = sized skeletons (no reflow). Empty = icon + directional line ("No outreach logged yet —
send a first email from the queue" → links `/schedule`). **Error = `AlertTriangle` + "Couldn't load
X." + "Try again"** (`refetch`) — currently absent on every Analytics panel. Hover = dataviz tooltips
with denominators; panels use `.hover-lift`. Focus = real focusable links (drill-through). Success =
counters animate (existing `useCounter`/`AnimatedNumber`), `.reveal` on scroll.

### 3.3 The "smart" feature done honestly — Finding line
Not AI. A deterministic ranker over data already fetched, obeying the doctrine and the sample floor:
- reply-rate Δ vs prior equal period (from `timeseries`) → *"Reply rate is 14% — up 3 pts on the prior 6 weeks."*
- best vs worst **healthy-n** segment → *"Referrals reply more often than public sourcing (n≥5)."*
- worst funnel step → *"Most drop-off is contacted → replied."*
- health → *"12 companies are overdue a touch."*
Pick the highest-salience finding for the headline (Cormorant), two more as chips; each carries the
drill-through of the thing it names. **Never** a claim built on n<MIN_N.

### 3.4 Copy & hierarchy
Vocabulary = the Dashboard funnel's plainer set: **"replies / reply rate"** (reserve *RESPONDED* for
the DB status badge). Reply rate = replied ÷ contacted, with raw responded/total shown as **coverage**
so nothing misleads. **Decision (from prior turn): fix app-wide** via one shared
`replyRate(contacted, replied)` helper, switching Dashboard's KPI too. Hierarchy: Finding → KPIs →
Spine (the one bold thing) → evidence (trend, timing, driver board, matrix, engagements) → role split.

---

## Phase 4 — Design system & build

### 4.1 Tokens — inherit, extend (no new palette)
Obsidian Amber / Daylight as-is. **Categorical** series use the app's existing hues in fixed order —
**deal types → emerald/sky/violet**, funnel stages → the **status-dot** colors, replies → green
`chart-2`; **amber stays reserved** for "at/above benchmark" and the one signature. **Sequential**
(heatmap, funnel magnitude) = single-hue amber ramp (the `PipelineFunnel` gradient already proves it).

### 4.2 Signature — the Conversion Spine (the *outreach* funnel)
A wide, editorial funnel: **Contacted → Replied → Interested** (built from `overview.by_status`, using
status-dot colors), each stage with count + conversion-from-prior + a **benchmark ghost** (firm avg /
prior period) and an auto **drop-off marker** on the worst step (feeds the finding). Every stage
drills to `/master` filtered to that status. Framed and titled as **"Outreach funnel"** so it never
reads as the sourcing funnel; a quiet "Sourcing funnel →" link points to `/sourcing/analytics`. This
is where boldness is spent; everything else stays quiet. It's healthy-n (total 75), so it's honest.

### 4.3 Layout (prose + wireframe)
Editorial single column that argues claim → proof.
```
Analytics                                             [ Last 12 weeks ▾ ]
▍ THE FINDING (Cormorant) — "Reply rate is 14% among contacted, up 3 pts.
   Referrals lead; public sourcing lags."   [drop-off chip →] [12 overdue →]
[ Sent 206 ↑ ] [ Reply rate 14% · 8/57 ] [ Interested 5 ] [ Bounce 4% ⚑ ]
── OUTREACH FUNNEL ────────────────────────────  ◇ firm avg   Sourcing funnel →
   Contacted 57 ▸ Replied 8 (14%◇) ▸ Interested 5 (63%)   └ biggest drop-off
── VOLUME · last 12 wks ───────────┬── REPLY TIMING ───────────────────────
   ▟ initial + follow-up (stacked)  │  days-to-reply · touches-to-reply
   ░ reply-rate % strip (own scale) │  (median + distribution; new endpoint)
── WHAT'S DRIVING REPLIES  [ Category · Layer · Source · Type ] ───────────
   ranked, denominators shown, n<5 recessed, click → /master filtered
── SOURCE × QUALITY (heatmap: rate + n per cell, low-n recessed) ──────────
── BY ENGAGEMENT (deal-type hues · overdue/needs-first · → deal room) ─────
── [PARTNER] leaderboard → Project health   |  [ANALYST] your book vs firm
```

### 4.4 Dataviz compliance
One axis per chart (volume counts vs reply-rate % are **two** stacked charts, never dual-y). Legend
for ≥2 series; denominators in tooltips; heatmap cells carry their number and are contrast-checked
light+dark. **Run `scripts/validate_palette.js` on the categorical set (deal-type + status hues) and
the amber ramp, `--mode light` and `--mode dark`, before merge.** Screenshot both themes + mobile;
check the (currently broken) trend axis renders monotonic.

### 4.5 Build order (files)
1. `lib/analytics.ts` — shared `replyRate()`, `MIN_N`, low-n classifier, finding ranker (pure, tested).
2. `components/analytics/finding.tsx` — the computed thesis line + chips.
3. `components/analytics/conversion-spine.tsx` — signature (from `by_status`).
4. `components/analytics/driver-board.tsx` — dimension switch over `RankedBars`, low-n aware.
5. `components/analytics/source-quality-matrix.tsx` — heatmap (rate + n).
6. `components/analytics/engagement-ledger.tsx` — deal-type hues + Project-health fields + drill.
7. `components/analytics/reply-timing.tsx` — touches/days distribution (new endpoint 5.3).
8. Reframe KPIs + rebuild trend in `page.tsx`; fix Dashboard KPI to shared `replyRate()`.
9. Role split (partner leaderboard/cross-link vs analyst scorecard); wire all drill-throughs; add
   empty/error/loading everywhere; self-critique screenshots; revise once.

---

## Phase 5 — Data appendix
### 5.1 Endpoint → panel (existing)
`overview` → KPIs + Spine (all-time) · `timeseries?weeks` → trend + reply-rate strip + deltas + finding
(**period-aware**) · `response-by-category|layer` + `sources` → Driver Board + heatmap (all-time) ·
`by-engagement` **+ `projects` (`useProjectAnalytics`)** → engagement ledger · `by-analyst` → leaderboard.
Cross-link (not fetch): `sourcing/funnel-analytics` (`useFunnelAnalytics`).
### 5.2 Honest labeling
Only trend + reply-rate delta are period-scoped; everything else is all-time. **Label per panel.**
### 5.3 New endpoint — `/analytics/response-latency` (IN SCOPE, decided prior turn)
Firm/analyst + visibility-scoped aggregation of *touches-to-reply* and *days-to-reply* into histogram
buckets + median. The per-company math already exists in `services/benchmark.py`
(`avg_touches_to_response`, `avg_days_to_response`) and is shown on the dossier `BenchmarkStrip`; this
generalizes it. Add `useReplyTiming` + pytest. Always render with denominators.

---

## Decisions locked
- **IA = A (Flagship + cross-link).** `/analytics` is the outreach-performance flagship; it
  **de-duplicates** the analyst table by cross-linking to Project health rather than re-rendering it,
  and links to the Sourcing funnel. The two deep-dives stay separate routes and get the same design
  language in a follow-up — not consolidated into one page (avoids fighting partner-only scoping and
  the two-funnels distinction).
- **Reply rate** = replied ÷ contacted, fixed **app-wide** via one shared `replyRate()` helper.
- **Reply-timing** panel + `/analytics/response-latency` endpoint are **in scope** for this build.

## Acceptance bar
- [ ] Every rate shows its denominator; `n < MIN_N` is recessed and excluded from ranking/findings.
- [ ] Reply rate = replied ÷ contacted via one shared helper, on **Analytics *and* Dashboard**.
- [ ] Trend axis renders correctly; volume and reply-rate never share an axis; response signal legible
      at low volume.
- [ ] Deal-type/status hues + MONO numerals + `AlertTriangle`/"Try again" states match the app.
- [ ] Every figure drills to `/master`, `/projects/<id>?book=<id>`, `/schedule?deal=<id>`, or `/companies/<id>`.
- [ ] No duplicated analyst table across `/analytics` and `/analytics/projects`.
- [ ] Reply-timing live on `/analytics/response-latency` (+pytest), visibility-scoped.
- [ ] Palette validated (light+dark); responsive; visible focus; reduced-motion respected.
- [ ] **Final test:** the analyst opens Analytics and instantly separates signal from noise, sees how
      they're doing and what's working, and clicks straight to the fix.
