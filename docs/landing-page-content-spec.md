# Upstream — Marketing Landing Page: Content & Research Spec

> **Purpose.** This document is the content contract for the new public marketing page
> (the app today has no marketing surface — `frontend/app/page.tsx` just redirects to
> `/dashboard`). It maps the 8 chosen 21st.dev components to a page structure, states what
> each section needs, and supplies ready-to-use copy/data grounded in the *actual* product
> (`plan.md`, `CLAUDE.md`, `globals.css`) and in competitor research.
>
> **Status of copy.** Product facts (features, security, cadence) are true to the codebase.
> Firm logos and testimonials are **illustrative placeholders** — clearly fictional, never
> real endorsements — until real customers exist. Pricing is an **open decision** (see §8).
>
> **BUILD STATUS (2026-07-23): shipped.** The page is live at `/` (`frontend/app/page.tsx`),
> sections in `frontend/components/marketing/`. All copy below is in place. Two deviations from
> the plan: (1) the **Spline 3D hero was swapped** for a bespoke on-brand cadence artifact per
> the "clean / on-brand" directive — the stock robot read as off-brand; (2) no pricing section
> yet. Verified: typecheck clean, `next build` prerenders `/` static, desktop+mobile, zero
> console errors. Open decisions in §12 still stand.

---

## 0. The page at a glance

| # | Section | Component (21st.dev) | Job on the page |
|---|---------|----------------------|-----------------|
| 1 | Navbar | `hextaui/navbar-1` | Wayfinding + primary CTA |
| 2 | Hero | `serafim/splite` (Spline spotlight) | The one-line promise + 3D visual + CTA |
| 3 | Social proof | `efferd/logo-cloud-2` | "Real desks run on this" credibility |
| 4 | Features | `shadcnblocks/feature108` (tabbed) | The product, in 3 tabs = the 3 spreadsheets |
| 5 | Security | `aceternity/evervault-card` | "Sensitive deal data is safe here" |
| 6 | Reach | `aceternity/world-map` | IST-deterministic clock + global deal flow |
| 7 | Testimonials | `efferd/testimonials-columns-1` | Voice-of-customer, per persona |
| 8 | FAQ | `efferd/faqs-1` | Kill the last objections |
| + | Footer | (add; not in the set) | Nav, legal, brand line |

**Recommended vertical order:** Navbar → Hero → Logo cloud → Features → Security (Evervault)
→ Reach (World map) → Testimonials → FAQ → Footer.

---

## 1. Product truth (the single source of truth for all copy)

- **Name:** Upstream. Demo tenant in the seed: *Upstream Capital Advisors*.
- **Category:** Multi-tenant CRM for **M&A / investment-banking deal sourcing**.
- **One-liner (repo):** "Productises three spreadsheets — Master List, Email Schedule,
  Contact List — into one connected system."
- **Brand line (already in the login screen):** **"Deal intelligence, institutionalized."**
- **Who it's for:** boutique / lower-middle-market M&A advisory desks and investment banks;
  day-to-day users are **analysts/associates**, oversight users are **partners**.
- **The three moats (from `plan.md` / `CLAUDE.md` non-negotiables):**
  1. **Append-only outreach log** — every email/touch is a timestamped event; history is
     never overwritten or deleted (soft-delete only). This *is* the institutional memory.
  2. **Computed cadence engine** — next-due / days-remaining / overdue are computed
     server-side from a **fixed anchor = the initial-email date**, in **IST (Asia/Kolkata)**.
     The clock doesn't start until the first email is logged; it **stops** on
     response/bounce/decline. The frontend never recomputes it.
  3. **One connected system, firm-scoped** — Master List + Email Schedule + Contact List,
     with **cross-mandate duplicate detection** (advisory), and **RBAC** (analysts see
     assigned mandates, partners see all + analytics).
- **App modules (the live product surface, for feature imagery & screenshots):**
  Dashboard (work-queue triage) · Projects (deal room) · Sourcing (Discover) · Master List
  (registry) · Schedule (Outreach desk) · Contacts (rolodex) · Analytics (performance
  briefing) · Settings.
- **Security posture (real, from README/CLAUDE.md):** httpOnly + Secure cookie auth (no
  tokens in JS/localStorage); rotating, server-side-revocable refresh tokens ("log out
  everywhere"); firm-scoped tenancy; soft-delete only; password hashes never returned.

### Domain glossary (use these words, not generic CRM words)
Firm (tenant) · **Mandate** (a deal: sell-side / buy-side / capital-raise) · **Company**
(a Master-List target/buyer/investor) · **Contact** (a person at a company) · **Outreach**
(an append-only event) · **Cadence** (the computed follow-up schedule).

### Brand tokens (from `frontend/app/globals.css` — keep the marketing page on-brand)
- **Accent / primary:** warm **amber-orange** (`oklch(0.66–0.72, hue ~57)`). One accent only.
- **Light bg:** warm off-white (`oklch(0.975 …)`, "not a white room"); ink = warm near-black.
- **Dark bg:** near-black (`oklch(0.09 …)`) + the same amber accent — the hero/Evervault/map
  sections should live in **dark mode** (matches the login screen and the 3D/aceternity look).
- **Type:** serif **display/heading** (the wordmark "Upstream" is serif) + sans body + mono.
- **Status color language (reuse in feature art):** Responded = green, Interested = blue,
  Declined/ due-soon = amber, Bounced/overdue = red, Contacted = slate, needs-initial = violet.
- **Aesthetic north star:** "restrained, data-dense financial SaaS (Linear/Stripe-calm),
  generous whitespace, crisp 1px borders." The marketing page should feel like that, not like
  a loud consumer landing page.

---

## 2. Competitive landscape (research)

| Product | Who it targets | Positioning wedge | ~Price / onboarding |
|---|---|---|---|
| **DealCloud** (Intapp) | Large PE / IB / corp-dev | Highly configurable enterprise RI platform; deep integrations (Intralinks, Datasite, PitchBook, Sourcescrub) | $50–250k+/yr; **12–16 wk** implementation |
| **Affinity** | Relationship-led VC/PE/family offices | Auto-captures contacts/deals from email+calendar; network-graph "who knows whom" | $15–60k/yr; 2–4 wks |
| **4Degrees** | LMM challenger to Affinity | Relationship intelligence, warm-intro paths; fast setup | ~$5–25k/yr; 1–2 wks |
| **Dialllog** | Boutique M&A advisory | **Mandate-based**; CRM + "firm memory" (emails, notes, decisions); buyer lists per mandate | Boutique-priced |
| **MadeMarket** | Boutique / mid IB | Buyer-list building, bulk teaser/NDA distribution, client-ready reporting, Outlook/Gmail add-ins | Boutique-priced |
| **Grata / Sourcescrub** | Deal-sourcing *databases* | Company search/enrichment feeds (complementary, not a CRM) | — |

**Where Upstream sits & how to say it.** Upstream lives in the **Dialllog / MadeMarket lane**
(boutique, mandate-based, "firm memory") — *not* the DealCloud enterprise lane. Its
differentiated wedge, and the thing competitors don't lead with:

- **A cadence engine that makes "we forgot to follow up" structurally impossible** —
  deterministic, server-computed, anchored to the initial send. (Competitors talk about
  "automation"; Upstream makes the follow-up math a first-class, auditable system.)
- **True append-only institutional memory** — you cannot overwrite or delete history;
  it survives analyst turnover. (Dialllog markets "firm memory"; Upstream *enforces* it.)
- **Built out of the exact spreadsheets desks already run** — near-zero conceptual migration.
- **Fast, opinionated, and light** vs DealCloud's price + 12–16-week rollout.

**Messaging pillars (use across hero/features/FAQ):**
1. **Nothing slips.** A computed cadence fires every follow-up on schedule.
2. **Nothing is lost.** Append-only log + soft-delete = permanent institutional memory.
3. **Nothing is scattered.** Three spreadsheets become one firm-scoped source of truth.

**Positioning statement (north star, not for the page verbatim):**
> For boutique M&A and investment-banking desks drowning in Master-List, Email-Schedule and
> Contact-List spreadsheets, Upstream is the deal-sourcing CRM that turns those three sheets
> into one connected system — where a deterministic cadence engine fires every follow-up on
> time and an append-only log preserves every touch. Unlike enterprise platforms that cost
> six figures and take a quarter to roll out, Upstream is purpose-built, fast to adopt, and
> opinionated about the one workflow that matters: sourcing the deal.

---

## 3. Section 1 — Navbar (`hextaui/navbar-1`)

**Needs:** wordmark, 4–5 nav links, 1 secondary + 1 primary CTA.

- **Wordmark:** the "U" up-arrow mark + "Upstream" (serif). Reuse `components/brand/logo`.
- **Links:** `Product` · `Solutions` (use cases) · `Security` · `Pricing` · `Customers`
  (Docs optional → the live `/docs` API or user guide).
- **Secondary CTA:** **Sign in** → `/login`.
- **Primary CTA:** **Book a demo** (or **See it live** → the deployed app if you'd rather send
  people straight into the seeded demo: `partner@upstream.test` / `Passw0rd!`).

---

## 4. Section 2 — Hero (`serafim/splite` Spline spotlight)

**Needs:** eyebrow/badge, H1, subhead, primary + secondary CTA, right-side 3D scene, (optional
trust microline). This component is a **dark spotlight card** with copy left, 3D scene right.

- **Eyebrow / badge:** `Deal-sourcing CRM for M&A desks`
- **H1 (pick one):**
  - **"Every follow-up on schedule. Every touch on record."** ← recommended (states both moats)
  - "Your deal book, finally out of spreadsheets."
  - "The deal-sourcing CRM where follow-ups don't slip."
- **Subhead:** "Upstream turns your Master List, Email Schedule and Contact List into one
  connected system — with a cadence engine that fires every follow-up on time and an
  append-only record of every outreach."
- **Primary CTA:** `Book a demo` · **Secondary CTA:** `Explore the live demo` (or `Sign in`).
- **Trust microline (optional, under CTAs):** "Built for boutique M&A & investment-banking teams."
- **3D scene:** the component's default Spline robot is fine for v1; note it as a candidate to
  swap for a bespoke amber-lit scene later so it isn't recognizably the stock asset.
- **Note:** keep this section in **dark mode** to match login + the Spline lighting.

---

## 5. Section 3 — Logo cloud (`efferd/logo-cloud-2`)

**Needs:** one eyebrow line + 6–8 wordmark logos.

- **Eyebrow:** "Trusted by deal teams at boutique advisories and lower-middle-market banks"
- **Logos — PLACEHOLDER, fictional (swap for real customers or remove before launch):**
  Meridian Partners · Cornerstone Capital Advisors · Ashwood & Co. · Northgate M&A ·
  Silverline Advisory · Brightwater Partners · Keystone Deal Advisory · Latitude Capital.
- **Honesty note:** do **not** ship real firm names/logos as customers unless they truly are.
  If none exist yet, either use these clearly-generic names or replace the section with a
  metric strip (e.g., "403 outreach events · 137 live schedules · 136 companies" from the seed).

---

## 6. Section 4 — Features (`shadcnblocks/feature108`, tabbed)

**Needs:** section badge, heading, description, then **3 tabs**, each with: tab label, title,
description, 3–4 bullets, and an image (use real app screenshots — Master List, Schedule,
Analytics).

- **Badge:** `The system`
- **Heading:** **"Three spreadsheets. One source of truth."**
- **Description:** "Upstream productises the three sheets every deal desk already runs — and
  connects them so the numbers finally agree."

**Tab 1 — "Master List" (image: Master List registry)**
- **Title:** "Every target, buyer and investor in one registry."
- **Bullets:** All Master-List fields, firm-scoped · Linked to mandates (sell/buy/raise) ·
  Source + source-quality on every row · **Cross-mandate duplicate warnings** so you never
  cold-email a name another analyst is already working · Search / filter / sort with live
  summary aggregates.

**Tab 2 — "Cadence engine" (image: Schedule / Outreach desk)**
- **Title:** "Follow-ups that fire themselves."
- **Bullets:** Outreach is an **append-only event log** — never a column you overwrite ·
  A **fixed anchor** to the initial-email date makes every due-date deterministic (IST) ·
  Next-due, days-remaining and **overdue** computed server-side — the queue is always right ·
  Auto-**stops** the moment a company responds, bounces or declines · Overdue backlog +
  partner escalation surface automatically instead of waiting for someone to notice.

**Tab 3 — "Analytics" (image: Analytics / performance briefing)**
- **Title:** "Know what's working before the partner asks."
- **Bullets:** Response rate by sector / bucket · Analyst-performance view for partners ·
  Per-mandate benchmark ("vs mandate average") · Sourcing funnel: sourced → contacted →
  replied → interested.

---

## 7. Section 5 — Security (`aceternity/evervault-card`)

**Needs:** the Evervault card (encrypted-hover reveal) + a short heading + 4–5 proof bullets.
The card reveals a centered word/phrase on hover.

- **Heading:** **"Built for data you can't afford to leak."**
- **Card center text:** `Secure by default` (or a padlock glyph). **Do not** put a compliance
  badge here unless it's real.
- **Proof bullets (all true to the codebase):**
  - httpOnly + Secure cookie auth — **no tokens in the browser** (never localStorage).
  - Rotating refresh tokens, **server-side revocable** — "log out everywhere" in one click.
  - **Firm-scoped** multi-tenancy — analysts only ever see their assigned mandates.
  - **Soft-delete only** — records are archived, never destroyed; institutional memory is permanent.
  - Password hashes never leave the server.
- **Honesty note:** avoid claiming SOC 2 / ISO / GDPR unless certified. Frame as
  "security-first architecture," not certification.

---

## 8. Section 6 — Reach (`aceternity/world-map`)

**Needs:** heading, description, and an array of connection arcs (`{ start:{lat,lng},
end:{lat,lng} }`). Ties the IST/timezone story to global deal flow.

- **Heading:** **"Sourced on an IST clock. Sourced across every market."**
- **Description:** "Upstream keeps its cadence clock in Asia/Kolkata so due-dates are
  deterministic — while your outreach reaches counterparties in every major financial hub."
- **Arcs (Mumbai as hub → global):**
  - Mumbai `19.07, 72.87` → London `51.51, -0.13`
  - Mumbai `19.07, 72.87` → New York `40.71, -74.01`
  - Mumbai `19.07, 72.87` → Singapore `1.35, 103.82`
  - Mumbai `19.07, 72.87` → Dubai `25.20, 55.27`
  - Mumbai `19.07, 72.87` → Hong Kong `22.32, 114.17`
  - Mumbai `19.07, 72.87` → Frankfurt `50.11, 8.68`
- **Note:** the seed/domain is India-first (IST, Indian target companies). If you'd rather
  position globally-neutral, recenter the hub — but the IST angle is a genuine, ownable detail.

---

## 9. Section 7 — Testimonials (`efferd/testimonials-columns-1`)

**Needs:** ~9 testimonials, each `{ quote, name, role, firm, avatar }`. Scrolling columns.
**All fictional / illustrative** — label as such internally; replace with real quotes at launch.

1. "We stopped losing follow-ups the week we switched. The overdue queue is the first thing I open." — **Ananya Rao**, Analyst, Meridian Partners
2. "An analyst rolled off and we didn't lose a single relationship. The whole history was just… there." — **David Chen**, Partner, Cornerstone Capital Advisors
3. "It's the Email Schedule sheet, except it does the date math and never argues with the Master List." — **Priya Menon**, Associate, Ashwood & Co.
4. "Cross-mandate dedup caught two analysts about to email the same CFO. That alone paid for it." — **Marcus Hale**, VP, Northgate M&A
5. "Onboarding was days, not the quarter DealCloud quoted us." — **Sofia Almeida**, Head of Origination, Silverline Advisory
6. "Partners get the analyst-performance view without asking me for a status update every Monday." — **Rahul Iyer**, Managing Director, Brightwater Partners
7. "The cadence just runs. Nothing sits in an inbox until it's too late anymore." — **Emily Wright**, Analyst, Keystone Deal Advisory
8. "It reads like the spreadsheets my team already lived in — no six-week training." — **Tom Becker**, Principal, Latitude Capital
9. "Append-only means I trust the record. Nobody can quietly rewrite what happened on a deal." — **Neha Kapoor**, Partner, Meridian Partners

---

## 10. Section 8 — FAQ (`efferd/faqs-1`, accordion)

**Needs:** heading + 6–8 Q&A pairs.

- **Heading:** "Questions, answered."

1. **How is Upstream different from Salesforce or HubSpot?** Generic CRMs need heavy
   customization to fit a deal desk. Upstream is purpose-built around **mandates, companies,
   contacts and an append-only outreach log** — the model your analysts already think in.
2. **How does the follow-up cadence work?** Each schedule anchors to the date you log the
   **initial email** (immutable after that). Next-due, days-remaining and overdue are computed
   server-side in **IST** and **stop automatically** when a company responds, bounces or declines.
3. **Can we migrate off our spreadsheets?** Yes — Upstream maps 1:1 to the three sheets you
   already run (Master List, Email Schedule, Contact List), so there's almost nothing new to learn.
4. **Is our deal data secure?** Auth is httpOnly + Secure cookies (no tokens in the browser),
   refresh tokens are rotating and server-side revocable, data is firm-scoped, and deletes are
   **soft** — records are archived, never destroyed.
5. **What do analysts see vs partners?** Role-based: **analysts** see only their assigned
   mandates; **partners** see everything plus analytics and escalation.
6. **Does it stop us duplicating outreach across mandates?** Yes — **cross-mandate duplicate
   detection** flags when the same target/contact already appears on another mandate (advisory).
7. **How long is onboarding?** Fast — Upstream is opinionated and light, not a multi-month
   enterprise rollout.
8. **What does it cost?** *(OPEN — see below. Placeholder: "Simple per-seat pricing — book a
   demo for a quote.")*

---

## 11. Footer (add — not in the component set)

Brand block: wordmark + **"Deal intelligence, institutionalized."** · columns:
**Product** (Features, Security, Pricing, Live demo) · **Company** (About, Contact) ·
**Resources** (Docs, User guide, API) · **Legal** (Privacy, Terms) · copyright line.

---

## 12. Open decisions (need your call before build)

1. **Pricing.** Real tiers, or "Book a demo for a quote"? Competitors range from ~$5k
   (4Degrees) to $250k+ (DealCloud). Recommend a boutique-friendly per-seat number or
   demo-gated pricing — tell me which.
2. **Primary CTA target.** A real "Book a demo" form, a signup flow, or send visitors straight
   into the **live seeded demo** (`partner@upstream.test` / `Passw0rd!`)?
3. **Logos & testimonials.** Ship the fictional placeholders (clearly generic), replace with
   real customers, or swap the logo cloud for a **seed-metric strip**?
4. **Geographic framing.** Lean into the **India-first / IST** story (ownable, true) or present
   globally-neutral?
5. **Hero 3D asset.** Keep the stock Spline robot for v1, or commission a bespoke scene so it
   doesn't read as a recognizable template?

---

## Sources (competitor research)
- 4Degrees — CRM comparisons & PE CRM pricing guide: https://www.4degrees.ai/blog/affinity-dealcloud-or-4degrees--which-crm-is-right-for-your-firm , https://www.4degrees.ai/blog/private-equity-crm-pricing-explained-2026-guide-to-crm-costs-in-private-markets
- CT Acquisitions — Best M&A CRM 2026: https://ctacquisitions.com/best-ma-crm-software-2026/
- Affinity — IB CRM buyer's guide: https://www.affinity.co/guides/investment-bankings-guide-to-choosing-the-right-crm
- Dialllog — CRM for investment banking / firm memory: https://dialllog.co/crm-for-investment-banking
- MadeMarket — IB deal management: https://www.mademarket.com/
- Intralinks — IB M&A deal sourcing guide: https://www.intralinks.com/guides/investment-bank-ma-deal-sourcing
- MadeMarket CRM pain-points guide: https://www.mademarket.com/blog/the-crm-pain-points-guide--and-how-mademarket-fixes-them
