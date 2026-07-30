# Upstream — Landing & Product UI System
### Audience psychology · content requirements · full 21st.dev catalog · production build prompts

> **Product truth (read first).** Upstream is a **relationship / deal-sourcing CRM for M&A and
> investment-banking desks**. It is **NOT** a robotics or humanoid-robot product — an earlier
> prompt said "humanoid robots" *by mistake*; disregard it entirely. Every word below is for the
> M&A CRM.
>
> **Locked decisions.** Stay Upstream (CRM) · code separated into **two apps, two ports (done)** —
> landing = `marketing/` (:3001), product = `frontend/` (:3000) · landing theme = **dark default +
> light toggle (to build)**.
>
> **What this doc is.** The blueprint for a production-quality build: *who* we persuade and *how*,
> *what information* each section must carry, *which* 21st.dev components build it, and two
> ready-to-run build prompts. Nothing here is speculative filler — every recommendation ties to a
> persuasion principle or a product fact.

---

## 1. Who we're persuading (and what they actually feel)

Two humans decide, and they feel different things. Design for both.

| | **Analyst / Associate** (daily user, champion) | **Partner / MD** (economic buyer) |
|---|---|---|
| Job to be done | Work the book without dropping a follow-up | Make sure no deal — and no fee — slips; run an accountable desk |
| Awake at 3am about | "Did I forget to follow up? Will a partner ask me a question I can't answer in the Monday meeting?" | "Is the pipeline real, or three analysts' spreadsheets that disagree? What happens to our relationships when an analyst quits?" |
| Emotional drivers | **Relief** (end the manual grind) · **Pride** (look on top of it) · **Fear** (embarrassment / career risk) | **Control** (visibility) · **Trust** (sensitive data, system-of-record) · **Loss aversion** (a missed deal = lost fee + lost face with the client) |
| What earns the "yes" | It reads like the sheets I already use; nothing to relearn | Purpose-built rigor; fast to adopt; my data is safe; my team is accountable |

**The one lever that matters most: loss aversion.** Kahneman & Tversky showed the pain of a loss is
felt ~2× the pleasure of an equivalent gain — and in B2B it's *professional* loss (a missed deal, a
bad-decision-that-costs-my-job). Upstream's entire promise — **"nothing slips, nothing is lost"** —
is a loss-aversion play. **Lead with the loss we prevent, not just the gain we offer.**

---

## 2. The persuasion & UX principles we'll use (and where)

Grounded in Cialdini's 7 principles + the B2B emotion research (≈95% of B2B decisions are
emotionally driven; trust · relief · pride · fear are the quartet). Each maps to a concrete tactic.

| Principle | How Upstream uses it | Lives in |
|---|---|---|
| **Loss aversion** (Kahneman) | Frame the cost of the status quo — deals slipping, memory lost | Hero, Problem, Final CTA |
| **Social proof** (Cialdini) | Peer testimonials (analyst *and* partner), "desks like yours" logos | Logos, Testimonials |
| **Authority** | "Purpose-built for M&A," the cadence engine's deterministic rigor, real screenshots | Features, Security |
| **Specificity = credibility** | Concrete numbers over adjectives (136 companies · 403 events · 7% reply), exact security facts | Stats band, Security |
| **Commitment / micro-yes** | Low-friction "See the live demo" before "Book a demo"; scannable proof points the reader silently agrees with | Hero, CTAs |
| **Relief / reduced cognitive load** | One idea per section, no jargon, generous whitespace — the reader never works to understand | Whole page |
| **Risk reversal** | "Maps 1:1 to your spreadsheets" (low switching cost), "days not a quarter" (vs enterprise rollouts), demo-first | Features, FAQ, Pricing |
| **Unity / liking** | Speak the desk's vernacular (mandate, the book, cadence, tombstone) — "we're one of you" | Copy everywhere |
| **Trust** | Security section, precise un-hyped language, real product UI, an obvious human path to a demo | Security, FAQ |

**Copy rule (from the research):** pair an **emotional hook** (the outcome) with a **logical
justification** (a specific fact). Single-stat / value-prop heroes beat decorative image heroes;
story-driven visual demos beat static taglines. Kill jargon — it raises cognitive load and lowers trust.

---

## 3. Landing page blueprint — section by section

For each: **Job** (what it must accomplish) · **Information to capture/present** (the content that
must be there) · **Psychology** (the lever) · **Components** (21st.dev + libraries). ★ = add now.

### 3.1 Nav
- **Job:** wayfinding + always-visible primary CTA.
- **Information:** wordmark · 4–5 anchor links (Product, Security, Reach, Customers, FAQ) · Sign in (secondary) · **Book a demo** (primary).
- **Psychology:** commitment (CTA never off-screen); clarity.
- **Components:** `navbar-1` (hextaui) ✓ · Floating/Resizable Navbar (Aceternity) · Announcements bar (21st) for a launch note.

### 3.2 Hero — *the 5-second test*
- **Job:** in one glance, say who it's for, what it is, and the outcome — and prove it.
- **Information:** (1) audience tag ("for boutique M&A / IB desks") · (2) what it is (deal-sourcing CRM) · (3) the outcome headline (*"Every follow-up on schedule. Every touch on record."*) · (4) a ≤2-line lede (the three-sheets→one-system mechanism) · (5) primary + secondary CTA · (6) a live **proof visual** (our cadence artifact) · (7) a micro-trust line (proof points).
- **Psychology:** loss aversion (headline names the slip we prevent) · story-driven demo (the artifact shows the transformation) · micro-yes (proof points) · cognitive load (one message).
- **Components:** ✓ Spotlight + cadence artifact · Heroes / Animated Heroes, Hero Highlight, Lamp, Container-Scroll (Aceternity) · single-stat hero variant to A/B.

### 3.3 Problem / agitation  ★ *(missing today)*
- **Job:** make the reader feel the status-quo pain before offering relief.
- **Information:** 3–4 concrete pains — spreadsheets drift out of sync · follow-ups slip when a date passes unnoticed · the pipeline a partner sees ≠ reality · relationships walk out the door when an analyst leaves.
- **Psychology:** loss aversion / fear (agitate), then relief; mirroring (their exact world).
- **Components:** Comparisons ("spreadsheet vs Upstream"), Grids & Bento of pains, Cards.

### 3.4 Social proof — logos
- **Job:** "serious desks like yours run on this."
- **Information:** eyebrow ("built for boutique M&A / LMM desks") + 6–8 firm wordmarks (placeholder until real).
- **Psychology:** social proof + unity.
- **Components:** `logo-cloud-2` (efferd) ✓ · Clients (logo marquee / partner grid / logo+quote) · Marquee (Magic UI).

### 3.5 Stats band  ★
- **Job:** concrete credibility in one strip.
- **Information:** real figures — 136 companies · 403 outreach events · 137 live schedules · 7% reply rate (seed-true; swap for customer aggregates later).
- **Psychology:** specificity = credibility; numbers anchor.
- **Components:** Stats & KPIs (21st) · **Number Ticker** (Magic UI) count-up on scroll.

### 3.6 Features — the three moats
- **Job:** turn capabilities into outcomes, with proof.
- **Information (per moat):** the capability · the **benefit** (the outcome, not the feature) · 3–4 bullets · a **real screenshot**. Moats: Master List (registry + cross-mandate dedup) · Cadence engine (append-only log, IST, auto-stop) · Analytics (response rate, benchmarks, funnel).
- **Psychology:** benefit-led (relief) · authority (rigor) · specificity.
- **Components:** `feature108` tabs (shadcnblocks) ✓ · **Bento Grid** ★ · **Animated Beam** ("three sheets → one system") ★ · **Animated List** (a live outreach feed) ★ · Sticky Scroll Reveal, Tracing Beam, Feature/Focus/Wobble/3D Cards (Aceternity).

### 3.7 How it works  ➕ *(optional)*
- **Job:** shrink the perceived effort of switching.
- **Information:** 3 steps — import your sheets → log the first email (sets the anchor) → the cadence runs itself.
- **Psychology:** risk reversal (low switching cost) · commitment.
- **Components:** Steppers, Timelines (21st).

### 3.8 Security & trust
- **Job:** make sensitive-deal-data fear disappear.
- **Information:** httpOnly+Secure cookies (no tokens in the browser) · rotating, revocable refresh tokens · firm-scoped tenancy · soft-delete (nothing destroyed) · hashes never leave the server. **No unverified compliance badges.**
- **Psychology:** trust (the single biggest risk-reducer for a system-of-record decision).
- **Components:** Evervault Card (Aceternity) ✓ · Borders/Shine-Border framing · proof list with icons.

### 3.9 Reach
- **Job:** signal scale + the ownable IST-clock detail.
- **Information:** headline (IST-deterministic cadence) + arcs Mumbai→global hubs.
- **Psychology:** authority / scale.
- **Components:** World Map (Aceternity) ✓ · Globe / Maps (21st) alternative.

### 3.10 Testimonials
- **Job:** peers model the win.
- **Information:** quotes from **both** an analyst and a partner persona · name · role · firm · a *specific* outcome (not "great tool") — e.g., "an analyst rolled off and we lost nothing."
- **Psychology:** social proof + pride (career upside modeled) + specificity.
- **Components:** `testimonials-columns-1` (efferd) ✓ · Animated Testimonials, Infinite Moving Cards (Aceternity) · marquee wall / carousel (21st, 139 options).

### 3.11 Pricing  ★ *(missing today)*
- **Job:** remove cost-uncertainty; route to sales.
- **Information:** 2–3 tiers (per-seat) *or* a clear "book a demo for a quote" · what each tier includes · the fast-onboarding promise.
- **Psychology:** risk reversal + anchoring + transparency (uncertainty causes "cold feet").
- **Components:** Pricing Sections (21st, 216+) · shadcnblocks / Cult UI pricing (monthly/annual toggle, comparison table).

### 3.12 FAQ — objection handling
- **Job:** dissolve the last doubts (the "devil-you-know" bias).
- **Information:** vs generic CRM · how cadence works · spreadsheet migration · security · analyst-vs-partner roles · cross-mandate dedup · onboarding time · cost.
- **Psychology:** reduce anxiety/uncertainty · authority.
- **Components:** `faqs-1` (efferd) ✓ · Accordions (Origin UI).

### 3.13 Final CTA
- **Job:** one clean decision.
- **Information:** restated outcome · Book a demo (primary) · See the live demo (secondary).
- **Psychology:** commitment + a last loss-aversion beat.
- **Components:** Calls to Action (21st) · Shimmer/Shiny/Pulsating Button (Magic UI).

### 3.14 Footer
- **Information:** brand + "Deal intelligence, institutionalized." · nav columns · legal · copyright.
- **Components:** Footers (efferd / 21st, 81 options).

---

## 4. Product / app UI system (`frontend/`)

Same brand, but the psychology shifts from *persuade* to *earn daily trust*: the app must feel
**fast, certain, and correct** — because the product's whole promise is that the numbers are right.

**UX principles:** reduce cognitive load on dense data (alignment, tabular numerals, hairlines) ·
**immediate feedback** on every action (optimistic UI + toast) · **trust in the data** (cadence
computed server-side, never client — reinforce visually) · **keyboard-first** (respect the power
user) · progressive disclosure (filters/detail on demand) · every empty/loading/error state designed.

| Area | Components (source) | Priority |
|---|---|---|
| **Command palette (⌘K)** | Menus / Search Bars / cmdk / kbar | **High** |
| **DataTable** | Tables + TanStack / Kibo UI / Origin UI — faceted filters, URL-state, column-vis, sticky header, bulk actions | **High** |
| **Timeline** (outreach history) | Timelines (Origin UI / Aceternity) | **High** |
| **AI chat / prompt input** (Groq drafting) | AI Chats (21st / Kibo UI) | Medium |
| **Charts** | Charts & Data Viz — shadcn Charts / Tremor / REAVIZ / visx | Medium |
| **KPI cards** | Stats & KPIs + Number Ticker | Medium |
| **Kanban / board** | Kibo UI Kanban / dnd-kit | Medium |
| **Sidebar / nav** | Sidebars, Navigation Menus, Breadcrumbs, Tabs | Medium |
| **Filters & inputs** | Selects, Date Pickers, Search Bars, Tags, Checkboxes, Radio, Toggles, Sliders (Origin UI) | Medium |
| **File upload / import** | File Uploads / Dropzone (Kokonut UI / Kibo UI) | Medium |
| **Overlays** | Dialogs/Modals, Popovers, Tooltips, Toasts, Alerts, Notifications | Medium |
| **States** | Empty States, Spinner Loaders, Progress, Skeletons | Medium |
| **Calendar / scheduler** | Calendars, Date Pickers (Schedule page) | Low |
| **Misc** | Avatars, Badges, Tags, Paginations, Steppers, Profiles, Onboarding | Low |

---

## 5. Full 21st.dev catalog (nothing left on the table)

Every 21st.dev category, tagged **L** (landing) / **P** (product) / **–** (skip for us). Install any
via `npx shadcn@latest add "https://21st.dev/r/<author>/<slug>"`, then re-skin to our tokens.

**Marketing blocks:** Heroes **L** · Features **L** · Pricing **L** · Testimonials **L** ·
Clients **L** · Footers **L** · Navigation Menus **L/P** · Calls to Action **L** · FAQs **L** ·
Stats & KPIs **L/P** · Comparisons **L** · Steppers **L/P** · Timelines **L/P** · Maps **L** ·
Marquees **L** · Backgrounds **L** · Gradients **L** · Shaders **L** · Borders **L** · Docks **L/P** ·
Galleries **L** · Images **L** · Videos **L** · Texts (animation) **L** · Announcements **L** ·
Team Sections **L** · Scroll Areas **L** · Hooks **P** · ASCII Art **–**.

**UI components:** Buttons **L/P** · Cards **L/P** · Grids & Bento **L/P** · Tables **P** ·
Charts & Data Viz **P** · Dashboards **P** · Sidebars **P** · Command/Menus **P** · Search Bars **P** ·
AI Chats **P** · Forms **P** · Inputs **P** · Selects **P** · Date Pickers **P** · Calendars **P** ·
Checkboxes/Radio/Toggles/Sliders **P** · File Uploads **P** · File Trees **P** · Lists **P** ·
Dialogs/Modals **P** · Popovers **P** · Tooltips **L/P** · Toasts **P** · Alerts **P** ·
Notifications **P** · Empty States **P** · Progress **P** · Spinner Loaders **P** · Paginations **P** ·
Tabs **P** · Accordions **L/P** · Carousels **L** · Avatars **P** · Badges **L/P** · Tags **P** ·
Numbers (tickers) **L/P** · Globes **L** · Cursors **L** · Icons **L/P** · Links **L** ·
Sign Ins/Sign Ups **P** · Onboarding **P** · Profiles **P** · Dropdowns **P** · Text Areas **P** ·
Radio Groups **P**.

---

## 6. Build prompts (production-quality)

> **Both prompts, before anything:** *This is Upstream, an M&A / IB deal-sourcing **relationship
> CRM**. It is NOT a robotics/humanoid product — ignore any earlier "robot" framing. First invoke
> the design skills (`frontend-design`, `ui-ux-pro-max`, and `impeccable` / `design-taste-frontend`
> for review). Make heavy, deliberate use of 21st.dev + Aceternity / Magic UI / shadcnblocks /
> Origin UI / Kibo UI / Cult UI — install real components and **re-skin every one to the
> Obsidian-Amber tokens** (Cormorant / Outfit / JetBrains Mono; amber `oklch(0.72 0.16 58)`;
> hairline borders). Apply the psychology in §1–3.*

### 6.1 PROMPT — Landing page (`marketing/`)

```
GOAL: Elevate the Upstream marketing landing to production quality. Upstream = deal-sourcing CRM
for boutique M&A / IB desks (NOT robotics — disregard any robot wording). Invoke frontend-design +
ui-ux-pro-max first; review with impeccable. Keep Obsidian-Amber identity; reuse marketing/ tokens.

PERSUASION (do this, per the study §1–3):
- Lead with LOSS AVERSION: the headline/first section names the deal that slips and the memory that
  walks out the door — then relief.
- Pair every emotional hook with a specific fact (numbers, exact security claims). Kill jargon.
- Sequence: Nav → Hero(proof visual) → PROBLEM/agitation(new) → Logos → STATS band(new) →
  Features(benefit-led, real screenshots) → How-it-works(new) → Security(trust) → Reach →
  Testimonials(analyst + partner, specific outcomes) → PRICING(new) → FAQ(objections) → Final CTA.

COMPONENTS (use generously, re-skinned): Number Ticker (stats), Animated Beam ("3 sheets → 1
system"), Animated List (live outreach feed), Bento grid (features), a subtle amber Aceternity
background (one), Pricing block w/ toggle, Comparison (spreadsheet vs Upstream), Shimmer button (CTA).

THEME: add a light/dark toggle (default dark; reuse components/theme.ts + Daylight tokens); design
the LIGHT hero deliberately — do NOT auto-invert.

QUALITY BAR: see §7. No walls of text; one idea + one signature motion per section; prefers-
reduced-motion respected; contrast >=4.5:1 both themes.
```

### 6.2 PROMPT — Product / app (`frontend/`)

```
GOAL: Upgrade the Upstream product app to production quality. Same brand; the job is to feel fast,
certain, correct (the product promise is that the numbers are right). Invoke frontend-design +
ui-ux-pro-max first; review with impeccable. Reuse globals.css tokens + shadcn primitives; make
deliberate use of Origin UI / Kibo UI / shadcn / Magic UI components, re-skinned.

DO:
1. Global COMMAND PALETTE (Cmd/Ctrl-K): jump to page/mandate/company/contact + quick actions.
2. DataTable pattern on Master List / Contacts / Schedule: faceted filters, URL-persisted state,
   column visibility, sticky header, bulk actions, tabular numerals.
3. TIMELINE for the append-only outreach history (status-color language per plan.md 7.3).
4. Analytics: shadcn Charts w/ legends, tooltips, empty + loading states; KPI cards w/ Number Ticker.
5. Systematize states: skeletons >300ms, empty states w/ CTA, confirm+undo on destructive (sonner),
   inline validation on blur. Optional: Kanban board view for pipeline/triage.

NEVER: recompute cadence client-side; regress firm-scoping/visibility rules (CLAUDE.md).
QUALITY BAR: see §7. Keyboard-first; a11y; don't break existing tests / Playwright paths.
```

---

## 7. Production-quality & verification checklist (meticulous — verify every item)

- **Accessibility:** contrast ≥4.5:1 (both themes) · visible focus rings · full keyboard nav ·
  aria-labels on icon buttons · `prefers-reduced-motion` honored · logical heading order.
- **Responsive:** 1440 / 1024 / 768 / 390; no horizontal scroll; wide content scrolls in its own box.
- **Performance:** next/image or unoptimized-for-static; lazy-load below fold; reserve space (CLS<0.1);
  code-split heavy client components.
- **Correctness:** `tsc --noEmit` clean · `next build` prerenders static routes · zero console /
  hydration errors · existing tests + Playwright critical paths green.
- **Design fidelity:** every borrowed component re-skinned to tokens (no stock palettes) · one accent ·
  tabular numerals for figures · one signature motion per view.
- **Copy:** benefit-led, specific, jargon-free; each CTA names what happens; consistent verbs.
- **Proof pass:** screenshot every changed page (desktop + mobile, both themes) and *look* at it;
  keyboard-only walkthrough of the palette + one data table.
- **Content honesty:** placeholder logos/testimonials clearly generic; no fabricated customers or
  compliance badges.

---

## 8. Phased build plan

Each phase is **one focused session**: plan → build → verify against §7 → screenshot (desktop +
mobile; both themes where relevant) → update `PROGRESS.md`. Every phase is independently shippable
and uses the §6 prompt for its app. The two apps are independent, so **Track L and Track P can run
in parallel**; the linear order below is the recommended value/dependency sequence.

**Recommended order:** `L1 → P1 → L2 → P2 → L3 → P3 → L4 → P4 → L5 → P5` — front-load the
highest-visibility landing work (theme + copy) and the highest daily-value product win (⌘K palette).
Effort: **S** ≈ half-day · **M** ≈ 1 day · **L** ≈ ~2 days (with the agent doing the lifting).

### Track L — Landing (`marketing/`, prompt §6.1)

**L1 · Theme + copy foundation** — *M · depends: none*
- Light/dark toggle in the nav (reuse `components/theme.ts` + Daylight `:root` tokens); **deliberately
  design the light hero** (amber-on-paper, softer glows — never auto-invert).
- Loss-aversion copy pass on existing sections (hero, features, security); cut jargon.
- **Done:** toggle works + persists across reloads; both themes ≥4.5:1; light hero designed on purpose;
  hero copy leads with the loss we prevent.

**L2 · Problem + Stats** — *M · depends: L1*
- New **Problem/agitation** section (§3.3) and **Stats band** (§3.5, Number Ticker on seed-true figures).
- **Done:** both live, on-brand, reduced-motion-safe.

**L3 · Mechanism** — *M · depends: L1*
- Features upgraded with **Animated Beam** ("three sheets → one system"); new **How-it-works** 3-step
  (Steppers) (§3.6–3.7).
- **Done:** beam animates with a reduced-motion fallback; the three steps read at a glance.

**L4 · Conversion** — *M · depends: L1*
- **Pricing** section (§3.11), **Testimonials** upgraded to an analyst + a partner quote with specific
  outcomes (§3.10), Final CTA polish (Shimmer button) (§3.13).
- **Done:** pricing, testimonials, and CTA match their §3 specs.

**L5 · Landing hardening** — *S · depends: L1–L4*
- Motion discipline (one signature per section), responsive 390–1440, a11y, perf, full screenshot proof
  pass in **both themes**. Ship.

### Track P — Product (`frontend/`, prompt §6.2)

**P1 · Command palette (⌘K)** — *M · depends: none*
- Global jump-to (page / mandate / company / contact) + quick actions (log outreach, new company).
- **Done:** keyboard-first, accessible, no route regressions.

**P2 · DataTable pattern** — *L · depends: none*
- Pilot on **Master List** (faceted filters, URL-persisted state, column visibility, sticky header,
  bulk actions, tabular numerals), then roll to Contacts + Schedule.
- **Done:** one list fully upgraded and the pattern reused; server-side sort/paginate where the API allows.

**P3 · Outreach timeline** — *M · depends: none*
- Timeline for the append-only outreach history on company/contact detail; status-color language (plan.md §7.3).
- **Done:** legible; honors the append-only + firm-scoping rules (CLAUDE.md).

**P4 · Analytics + states** — *M · depends: none*
- Charts with legends/tooltips/empty/loading; KPI cards with Number Ticker; systematize skeletons (>300ms),
  empty states with a CTA, confirm + undo on destructive actions.
- **Done:** meets §7; existing tests + Playwright critical paths stay green.

**P5 · Board + product hardening** — *M · depends: P2 · optional*
- Kanban board view for pipeline/triage; final a11y / perf / screenshot pass. Ship.

> Track P phases (P1–P4) have no hard dependencies on each other — reorder by whichever daily pain is
> loudest. Track L phases all build on **L1** (theme + copy), so do L1 first within that track.

---

## Sources
**Psychology:** Cialdini, *Influence* (7 principles) · Kahneman & Tversky, prospect theory / loss
aversion · [CXL — Cialdini for conversion](https://cxl.com/blog/cialdinis-principles-persuasion/) ·
[Loss aversion in B2B sales](https://www.sybill.ai/blogs/loss-aversion-in-sales) ·
[Fear in B2B](https://themarketingmeetup.com/blog/fear-in-b2b/) ·
[Emotions in B2B buying](https://www.adience.com/blog/insights/how-emotions-affect-b2b-buying-behavior/) ·
[SaaS hero psychology](https://www.gravitasvision.com/post/the-psychology-of-the-landing-page-5-elements-that-drive-b2b-conversions).
**Components:** [21st.dev — all categories](https://21st.dev/community/components) ·
[Aceternity](https://ui.aceternity.com/components) · [Magic UI](https://magicui.design/) ·
[shadcnblocks](https://github.com/shadcnblockscom/shadcn-ui-blocks) · [Origin UI](https://originui.com/) ·
[Kibo UI](https://www.kibo-ui.com/).
