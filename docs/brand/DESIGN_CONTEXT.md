# DESIGN CONTEXT DOCUMENT

### The MVP currently code-named "Upstream"

**For:** an external product / brand / UX designer rethinking this product's name, brand direction, logo, visual identity, positioning, messaging and landing page.

**Purpose:** to reconstruct accurately what this MVP *is today* — how it works, who it serves, what it looks and feels like, and what evidence exists for future decisions. A research handoff, not a redesign.

---

### How this was produced

**Read, in implementation rather than in filenames:** the FastAPI backend (models, enums, services, every API router), the Next.js product application `frontend/` (~20,000 lines), the standalone landing-page app `marketing/`, both stylesheets and token files, the content file holding every word of the landing page, seed and pool data, and the project's own planning documents.

**Inspected while running.** Backend and frontend were run locally against a seeded demo database. Every top-level screen was captured and viewed at 1440×900 in both themes, at 390×844 mobile, plus the command palette, the log-outreach dialog, Focus mode, the pipeline board, a company record, a contact record, and a second session as a non-partner analyst. The rendered text of every screen was dumped separately, so all copy quoted here is what a user actually sees.

**Verified against the database and the API,** not only against page code: SQL queries against the seeded demo book, and a full enumeration of every write endpoint. Several conclusions below exist because a screen and the schema behind it disagreed.

**Limits.** Nothing about the business is knowable from this repository — pricing, customers, funding, roadmap, launch date, go-to-market, founder story. §19 lists what remains open. Production deployments were not inspected; local instances running the same code were.

**Demo figures.** Two seeded databases exist: a Faker demo book, and a "bootstrap" firm carrying the shipped company dataset. Figures come from the Faker demo book unless stated. They are seeded values, not product claims.

### Evidence labels

| Label | Meaning |
|---|---|
| **FACT** | Directly demonstrated by the implementation or by user-visible copy |
| **STRONG INFERENCE** | Not stated anywhere, but supported by several independent pieces of evidence |
| **UNCERTAIN** | A plausible reading the evidence does not sufficiently support |
| **UNKNOWN** | The codebase cannot answer it |
| **INTENT** | Stated by the product owner and checked against the build. Where the build does not match, that is said. Never presented as a current capability |

### A note on the `marketing/` app

It is **a reference implementation of a landing page**, not a second production brand. Its copy, voice, house style, objection-handling and image assets are genuine raw material for whoever builds the next one, and they are documented here in full. Its visual system — palette, typefaces, scroll mechanics, motion devices — is a previous attempt at the artifact the new designer is being asked to make, and is summarised rather than catalogued. **The product app is the brand as it currently exists.**

### One judgement, flagged

This document's only significant interpretive leap: **that the working relationship between the software and the analyst — it works alongside them and never acts for them — is the product's most distinctive quality, and the firm-wide record its most defensible one.** The underlying mechanics are FACT; the strategic weight is STRONG INFERENCE. No customer evidence exists in the repository either way.

---

## 1. PRODUCT — WHAT IT ACTUALLY IS

### A. One sentence

**It is one place for the whole of an analyst's origination and outreach work — the firm's own lists, the people, the follow-ups, and a platform-kept database of new companies to approach — built to work *alongside* the analyst rather than in place of them.**

### B. In detail

**The work as it is done today (FACT for the spreadsheets, INTENT-corroborated for the research).**
An analyst running origination and outreach for a client works across four disconnected things: a **Master List** spreadsheet of companies for that deal, an **Email Schedule** spreadsheet of follow-up dates, a **Contact List** spreadsheet of people, and — for any company the client's list did not contain — a browser: web searches, industry directories, fund and portfolio pages, and increasingly an LLM, assembled by hand into something to send the client.

Nothing joins up. The same company is typed into three files. A follow-up date sits in a column nobody sorts. Yesterday's research is in a tab that is now closed. Every one of these is a place where the analyst is doing the software's job by hand.

The first three are named identically in `README.md`, `CLAUDE.md` and the plan document; the real client workbooks the importer was built against are in the repository. The app's information architecture is exactly those three surfaces plus sourcing and analytics.

**What the product is.**
One place where all of that happens instead: the firm's own workbooks come in whole, the search for *new* companies happens against a database the platform itself keeps, outreach is logged where it happens, the follow-up schedule keeps itself, and reporting comes out of the same material. It is end-to-end across the work it covers — find a company, put it on a deal, contact the right person, keep the follow-ups, hold the record, read the result — and it stops deliberately where a deal enters execution, which the product says out loud in its own FAQ.

**Two bodies of company data sit under that, and the distinction is central (INTENT).**
The advisory firm is the *customer*. What they upload is **their own book** — companies they already work, with their history. Alongside it sits **the Upstream database**: the platform's own, first-party, continuously grown set of researched companies, which every firm can search for names they do not yet have. The first tells an analyst what the firm has already done; the second is where new candidates come from. The owner describes the second as the core of the product — the reason a firm keeps the tool between mandates. **§4.7 sets out how far the build implements this, and it is materially less than the model describes.**

**The stance: it works alongside the analyst, never for them (FACT — the most consistent design decision in the product).**
Not a positioning line; visible in nearly every feature, and in several cases written into the source:

- The importer will not guess which deal a spreadsheet tab belongs to — *"Sheet names don't say which deal they belong to, so this is your call — not a guess."* It parses everything, then asks.
- It refuses to invent what a spreadsheet did not say: no anchor date is fabricated, no precision faked, and fourteen named flags tell the analyst what it had to decide.
- The duplicate check is **advisory and never blocks** — *"Advisory only — never blocks company creation"*; on screen, *"these matches may or may not be the same entity."*
- The pipeline board will not let a status be set by dragging — *"Drag a card, or use its move menu — a column is never written directly."* State follows real events, not gestures.
- AI drafts an email but never sends one — *"Drafts from real deal context — cadence, touches, notes. **You edit, you send**"*, and afterwards *"AI draft — read it as the recipient before you send."*
- Email goes out *"one message at a time, when you press send. No relay, no shared sending domain, no bulk send."*
- Fit scoring is advisory, and the analyst can mark it right or wrong.
- Analytics quarantines its own figures when there is too little data to mean anything (**THIN DATA · N<5**).

Everything the software does automatically is a *derivation from something the analyst did* — never an action taken on their behalf. **The product's relationship with its user is its actual subject:** a colleague that keeps the book, not a robot that works the desk.

**What the analyst gets back for working here (FACT).**
One act in, everything else derived. Logging the *first* email sets an immutable anchor date. Every follow-up is then `anchor + n × interval` (default 14 days), and it never shifts even when a follow-up is sent late — deliberate, because a date that reschedules itself cannot be trusted. From the same append-only log the system computes the day's priority queue, each company's state, the outreach funnel, reply rate, reply timing, and per-analyst and per-deal performance. The analyst enters nothing else and does no bookkeeping. On screen this is "84d" against a company nobody typed a number for.

This is why it does not read as a CRM to the person using it: **there is no second job.** The maintenance that made previous tools fail is collapsed into an act the analyst was performing anyway.

**What accrues while they work (FACT).**
Because the work happens in one place, a firm-level record builds itself. A company exists **once for the whole firm** as a deduplicated profile, and every appearance on a deal is a *placement* hanging off it, carrying that deal's status, category and analyst. Nothing is deleted, only archived. The outreach log is append-only and cannot be edited. So when a company reappears on a second deal months later, the record it carries was written by the first — and the software says so before the second analyst writes an email. **Nobody set out to build that record; it is what working in one place produces.**

*Verified in the demo data:* 136 placements resolve to 118 distinct company profiles; Cipla Ltd sits on three engagements, Tata Power Company on two.

**An important qualification (FACT).** *Companies* are deduplicated firm-wide. **People are not.** A contact row is attached to a per-deal company row, so the same person contacted on two mandates exists as two unrelated rows. The contacts screen presents a single firm-wide list — *"one shared book of who the firm knows"* — and that is true of *visibility*, not of *identity*. Treat company memory as implemented and person memory as a presentation over per-deal rows.

**The core job-to-be-done (STRONG INFERENCE).**
*"Run my client's outreach properly — find the right companies, reach the right people, keep every follow-up on time — without my working day spread across four files and a browser, and without a second job spent keeping a system up to date."* The analyst is not trying to maintain a record; they are trying to do the work. Every maintenance step a tool asks for is one they will skip. The project's own research note names the objection it was built against: *"we bought one and nobody updated it."*

**In ten seconds:** *everything you currently do across three spreadsheets and a dozen browser tabs happens in one place — you keep working the way you work, and the follow-ups, the record and the reporting keep themselves.*

**Two things it deliberately does not do.**
- **It does not reach out (FACT).** No notification, reminder, digest, scheduled job or background worker exists anywhere in the codebase. The clock runs, but only speaks when the analyst opens the app. It surfaces a lapse reliably *on arrival*; it does not chase to prevent one. Whether that is scope discipline or a gap is unresolved (§19).
- **It does not go past outreach (FACT).** Execution, bid management and diligence are explicitly out of scope — *"we are the wrong tool today"* for a firm that needs them. "End to end" means end to end *across origination and outreach*.

---

## 2. TARGET USERS

### Primary — FACT, heavily supported

**The analyst at a boutique or mid-market M&A advisory desk.**

- Exactly two roles exist in code and interface: `ANALYST` and `PARTNER`.
- Navigation is grouped *Pipeline → Outreach → Insights → Admin*, described in its own source as mirroring "the analyst's workflow: find & organize → act → learn."
- The dashboard addresses the user by first name and hands them a backlog.
- The densest, most-invested screen (the Outreach desk, ~1,965 lines) is a single-purpose queue-clearing instrument with keyboard navigation (`j/k`, `L`, `x`, `f`, `?`) and a Focus mode that dims the interface to one company. Built for someone doing this for hours.

### Secondary — FACT

**The partner.** Partners see everything; analysts see only assigned engagements. Partner-only: **Project health** and **Settings** (firm config, team roster, workspace reset, email templates, category vocabulary, funnel stages).

### A structural caveat about the team (FACT, verified across the whole API)

The multi-user model is fully built — assignment, visibility scoping, "Worked by", team stacks, per-analyst analytics — **but there is no way for a firm to add a second person through the product.** `GET /users` is the only route in the users router; the only user-creating endpoint anywhere is `POST /auth/signup`, which creates *a new firm*. Settings → Team is a read-only roster. The demo's extra users came from a seeding script.

**Two readings (UNCERTAIN):** an unbuilt invite flow, or a deliberate closed-beta posture in which firms are provisioned by hand — the landing page does say access is opening to *"a small number of desks first"*, and a bootstrap script provisions firms directly. Either way the consequence is the same: **the collaborative half of this product cannot be experienced by anyone who signs up today.**

### Category

**Business / professional, small-team B2B** (STRONG INFERENCE). Not enterprise: no SSO, no admin hierarchy beyond two roles, no audit console, no permissions beyond firm plus assignment. Not consumer: every object is a firm asset. Self-serve signup creates a whole firm workspace with its first user as partner.

### Technical sophistication

**Spreadsheet-fluent, not technical** — STRONG INFERENCE about the *designed-for* user; **UNKNOWN** about actual users, since no research, analytics or support artifacts exist. Onboarding is "upload the .xlsx you already keep." The interface assumes fluency with dense financial tables, sorting, filtering and column control, and exposes nothing developer-facing.

### Market geography — FACT as built, UNKNOWN as positioning

Built around **India**: cadence maths hard-coded to **Asia/Kolkata (IST)**, shown in Settings as a fixed value rather than a setting; the revenue column is **"REV ₹CR"** and size bands are `< ₹100 Cr` / `₹100–500` / `₹500–2,000` / `> ₹2,000`; shipped and demo data are India-weighted. **But the landing page never mentions India, geography or currency,** and a deal carries an `exchange_rate` field. "India-market build" is FACT; "India-only positioning" is UNKNOWN.

### What frustrations the product assumes they have

**The everyday frustration it is actually shaped around (STRONG INFERENCE, from what the build optimises for).** The work is scattered, and the scattering costs time daily: the same company typed into three spreadsheets; a follow-up date in a column nobody sorts; a contact whose last conversation is in a file someone else owns; and, whenever the client's list runs out, a fresh round of web searching and LLM prompting whose output must be reassembled by hand, cannot be checked, cannot be repeated, and knows nothing about who the firm has already approached. None of it is dramatic. It is friction, repeated — and it is what every major surface removes.

**The consequential version, which is how the reference landing page states it (FACT, verbatim copy).**

| # | Event | Found out | Cost |
|---|---|---|---|
| 01 | Two analysts email the same CFO | From the CFO | One reply, spent twice |
| 02 | The follow-up date passes on a Tuesday | Three weeks later | A warm thread, cold |
| 03 | A buyer you have known for years opens as a stranger | You don't | The same ground, walked twice |
| 04 | An analyst leaves on Friday | In the handover | Ten years of instinct, out the door |

**A note for whoever writes next.** These four are the *consequences* of the daily friction, not the friction itself, and they are pitched at a partner's fear rather than an analyst's day. Strong, true, worth keeping — but a page built only on them describes a product that prevents disasters, when what the software does is make an ordinary working day less scattered. The two framings need each other.

---

## 3. CORE USER JOURNEY

### 3.1 The workflow the product is organised around

**Sign in → open (or create) a project → fill it, by import or by sourcing → work the outreach → read the result.** The navigation encodes exactly this.

Read as a replacement for how the day is spent today, the sequence maps one-to-one onto what it removes:

| Surface | What it replaces |
|---|---|
| Import | Re-typing the client's spreadsheets |
| Sourcing | The browser tabs and the LLM prompt |
| Master List | The file kept in sync by hand |
| Schedule | The follow-up column nobody sorts |
| Contacts | The third spreadsheet |
| Analytics | The Monday morning compile |

The nav is, in effect, a list of the things the analyst no longer leaves the tool to do.

**One structural mismatch, stated rather than resolved (FACT).** `/`, login and signup **all redirect to `/dashboard`** — a firm-wide backlog screen — not to a project. Projects is one click away as the first Pipeline item, but the front door is the queue, not the deal. Master List, Contacts, Analytics and the desk are likewise firm-wide by default and only *filterable* by project.

Two readings, and the codebase does not choose: an artifact of build order (the dashboard shipped early), or a deliberate "attention first" opinion. **An open product decision, not a defect** — §18-D.

### 3.2 First run, for a real firm (FACT, traced end to end)

1. **`/signup`** — firm name, your name, email, password. *"A private workspace with the company database ready to search. Your deal book starts empty — import your spreadsheets and it fills."* The firm is created with that user as **partner**, and the shipped company dataset is planted immediately.
2. **The book is empty on purpose.** Only Discover has content on day one. A deployment has three tiers — configuration, the company database, the book — and only the first two ship.
3. **`/import`** — the real onboarding. **Upload → Project & engagements → Review → Apply.** Drop every workbook for that client at once; map each tab to an engagement; read the flag summary; apply. Ends on *"{Project} is live"* with **Open {project}**.
4. **The project now exists with history** — companies, contacts, backdated outreach events, cadences already in their correct live state, including companies already late. This is why a freshly imported firm opens on a large backlog rather than zeros.
5. **`/sourcing`** — with an engagement selected, search for companies the client's spreadsheet did not have and **Push** them onto the deal. The dialog offers to log the initial email and start the clock.
6. **`/schedule`** — the daily loop from then on.

### 3.3 The daily loop (FACT, observed running)

1. **Open the desk** (`/schedule`, titled **Outreach desk**). A progress line (*"0 / 55 done · ~28 min left"*), a week horizon strip (**ALL 55 · LATE 39 · TODAY 0 · FRI 4 … · NEW 16**), a promoted **NOW · your highest priority** row, then **OVERDUE** ordered by lateness (*"38 · oldest 68d · avg 29d"*).
2. **Each row states one relationship in one line:** days late · company · deal-type chip · client · the person · *"Last touch 4 Jun"* · status · action.
3. **The act.** *Log follow-up* — Type, Date, Contact, Notes, each type carrying a live consequence line — or *Send follow-up* through the compose sheet, ending in **"Send & log follow-up."** The row menu also offers **Mark replied**, **Mark bounced**, **Log call**, **Log meeting**: the relationship is not only email.
4. **The payoff.** The row animates away (green flash, then collapse), the counter ticks, the queue reorders, and the dashboard, analytics, master list and that company's timeline all recompute. Nothing else is entered.

### 3.4 Critical moments

| Moment | What happens | Assessment |
|---|---|---|
| **Import completes** | A client's spreadsheets become a live project with history | **Highest-stakes moment.** If it fails, nothing else matters. Also the best story: "your book, already running" |
| **"2 prior" appears on a candidate** | The firm's memory speaks before the analyst acts | The truest expression of what the product is. Small on screen, large in meaning |
| **Push → "Log the initial email to start the cadence clock?"** | Sourcing becomes outreach in one dialog | The seam between the two halves, in one interaction |
| **The dashboard number** | One large red figure states the backlog | Strongest immediate orientation; also the most emotionally costly first impression |
| **Logging one touch** | Row clears, counter ticks, queue reorders | The mechanic everything rests on, and it is satisfying |

### 3.5 Friction, and where value is not communicated (FACT)

- **The reference landing page's CTA is a dead end.** Every call to action reads *"See it running"*; every one lands on `/coming-soon`, which says *"Not open yet… There is nothing to sign up for yet."* No capture of any kind.
- **The front door is a backlog, not a deal.** A first-time user's first impression of their own workspace is a red alarm reading `HEAVY PRESSURE`.
- **A brand-new firm's app is nearly empty and nothing says "import."** Import is a nav item among nine; the dashboard does not point to it.
- **The relationship intelligence is under-displayed.** Warm history, "Worked by", the "Deals" count and the duplicate warning are the differentiator, and all four render as small grey elements.
- **Raw system values leak.** The company record shows `TARGET`, `REFERRAL`, `MEDIUM`; the duplicate warning says *"mandate 12"*.
- **Two vocabularies for one thing.** Nav says "Schedule"; the page says "Outreach desk." Nav says "Sourcing"; the tabs say "Discover." Nav says "Master List"; its tabs say "My book / Firm database."

### 3.6 When something goes wrong

Per-panel error blocks with retry; a route-level error boundary; a written 404; toasts on every mutation, with **undo** on archive; the import's preview rolls back everything it touched and a failed apply leaves the book untouched; the duplicate check warns and never blocks.

---

## 4. FEATURES

Ranked by centrality to what the product is, then by evidence of investment.

**One pattern runs through all of them:** every feature either **takes over work the analyst currently does by hand in another tool**, or **hands them something they could not previously have** — and none acts on their behalf. Read the list as a working relationship, not a capability matrix.

### Core

**1. The firm-wide company record ("Firm database")** — `/master`
One deduplicated row per company for the whole firm, carrying its **placements** (every engagement it has appeared on, as clickable chips), **"Worked by"** (analyst initials), a **"Deals"** count, revenue, staff, category. Sortable by **Most worked**; filterable by *worked in ≥N engagements*, category, side, status; group-by-analyst for partners; CSV export.
*Why:* to answer "does the firm already know this company, and who worked it?"
*Who:* partners by default (their landing lens), analysts by choice.
**Landing-worthy — the differentiator rendered as a table.**

**2. Warm history in Discover** — `/sourcing`
Every candidate row carries a prior-work chip (**"2 prior"**, tooltip *"Worked before in 2 engagements"*) expanding into **Warm history**: *"Worked by {analyst} for {client} — {sentiment}, {date}."*
*Notable:* the *existence* of prior work is firm-wide; per-touch *detail* shows only for engagements the viewer is assigned to — otherwise a muted "worked by another team". Memory crosses team boundaries; confidentiality does not. **The single best thing to demonstrate.**

**3. Cross-deal duplicate warning** — while adding a company
Fuzzy name plus registrable-domain matching across deals, surfacing the other deal, its status and its first-contact date. **Advisory, never blocking** — an explicit product opinion, and the differentiator the reference page names first.

**4. Contacts — the firm rolodex** — `/contacts`
A split view: A–Z letter rail, person list, and a person card built around a block headed **"Relationship facts"** — *Known via* (which colleague), *Connected* (when it began), *Last touch* (with *"— gone quiet"* past a threshold), *Latest read* (sentiment) — plus notes and Reply / Call / Meeting. Framing: *"The firm knows 256 people at 136 companies."* Empty state: *"Every analyst's contacts land here — one shared book of who the firm knows."*
*Qualification (FACT):* a firm-wide *list*, not a person-level *entity*. Contacts attach to per-deal company rows; there is no identity for a person across deals, and no "everyone we know at this company" view. The "136 companies" in that headline counts placements — the demo book holds 118 distinct companies.

**5. Append-only outreach log + company record** — `/companies/[id]`
Tabs: Overview / Cadence / Contacts / Timeline. The timeline is the institutional memory, with cycle bands where a company was re-approached. Empty state: *"Nothing logged yet — every email, call and reply lands here, appended, never overwritten."*

**6. Workbook import** — `/import`

- **Multi-file in one run.** Every workbook dropped lands under one project; files queue; the contact list is deliberately sorted last (its "Reason" column maps onto engagements the other files create); the project is decided once and locked.
- **It does not assume tidy tables.** Real workbooks carry a header *block* above the real column row (a client label, an "Exchange rate as on date = …", a running count). The parser hunts up to 20 rows for the true header row, requiring ≥3 known column aliases.
- **It classifies each tab:** `MASTER` / `SCHEDULE` / `CONTACTS` / `LONGLIST` / `IGNORE`.
- **It maps columns by dictionary, then fuzzily.** ~26 master fields with alias lists (`"Rev (INR Cr)"`, `"Website Link"`, `"Email Id 1"`, `"Bucket"`, `"Regarding"`), plus a dedicated alias table for category tokens (`PE`, `VC`, `FO`, `PMS`, `strategic`, `PE/PC`).
- **It reconstructs history.** The emailing-schedule tab is matched to its master sheet, and each company's initial email plus bi-weekly follow-ups become a **backdated chain of real outreach events**, with the cadence resolved to its correct live state.
- **It refuses to fake precision, out loud.** Fourteen named flags in plain English — *"No initial email date — schedule stays Awaiting initial, no events"*; *"Excel had no date for this event — dated to the last known touch"*; *"Type not in the firm's category vocabulary — imported as Other"*; *"POC did not match a user in this firm — owned by the importer"*.
- **Nothing is written until you apply.** Inspect stages the rows; preview is a true dry run that rolls back; apply is idempotent.

*It is the entire onboarding and the switching-cost answer, and deserves far more prominence than its current position as FAQ answer 3.*
*Nuance no claim should overstate:* auto-*parsed*, not auto-*mapped*. Three decisions are deliberately left to the human — *"Sheet names don't say which deal they belong to, so this is your call — not a guess."* The accurate claim is **"you never retype a row,"** not "it does it all for you."

**7. Discover — search the Upstream database, and your own book, against a live deal** — `/sourcing`

*The pain point it solves (INTENT, corroborated by what the build optimises for).* A client's list eventually runs out. When an analyst needs companies it never contained — more buyers for a sell-side, more targets for a buy-side, more investors for a raise — the product ends and the browser begins: web searches, directories, fund and portfolio pages, an LLM, reassembled by hand. That work is slow, unrepeatable, unattributable and impossible to check; two analysts researching the same sector produce two different lists; and none of it is connected to what the firm has already done. **This is a distinct pain point from the spreadsheet problem, and the product solves it separately.**

*The intended model — two databases, one search (INTENT).*

| | **The firm's own book** | **The Upstream database** |
|---|---|---|
| Whose it is | The client firm's | The platform's — a first-party asset |
| Comes from | The workbooks and CSVs they upload | Curated and continuously grown by the platform |
| Holds | Companies they already work, with history | New, current, researched companies they do not have |
| For | Knowing what you have already done | Finding what you do not yet have |

One search across both: the analyst filters, sees which results are already theirs and which are new, and pushes what they want onto the deal. **The owner describes this database as the core of the product** — the reason a firm keeps the tool between mandates, and the thing that grows in value while they use it.

*What is built today (FACT).* Engagement-scoped search over `company_profiles`, a **single firm-scoped table**, planted at signup with **164 verified real organisations** — name, HQ and domain from cited public sources, revenue and headcount deliberately blank rather than invented. Constraints: free text (name / city / domain), sector, category, side-of-market segment, revenue band, HQ city, minimum staff, **Worked before**, **Scored**, sort. A left **database lens** rail reads the database back to the analyst — its size, side-of-market mix, sector and city composition, and *how much is actually filled in* (Domain 100% · Revenue 98% · Staff 98%) — each row also being the filter it describes. **Push** places a profile onto an engagement (offering to create one if none exists), reports the warm history it just inherited, and asks *"Pushed. Log the initial email to start the cadence clock?"* Results export; searches save, privately or firm-wide.

**Three verified gaps between the model and the build:**

1. **No shared tier.** The dataset is *copied into each firm* at signup, and the source defends the choice: *"Per-firm rather than shared, deliberately… One shared global table would make one firm's edits visible to another; a copy per firm keeps the tenant boundary intact and costs 164 rows."* What ships is a **starter set**, not a live connection to a platform database.
2. **No provenance on a company record.** `CompanyProfile` has no field recording where a row came from — platform dataset, the firm's CSV, a workbook, or a provider. Imports merge into the same table under one dedup rule. **After a firm imports its book, "ours" and "theirs" are indistinguishable.** There is no way to show *"new to you"*, filter to *"companies the platform added"*, or say *"400 added this month"*. Batch-level provenance exists for imports, but profiles carry no link back to a batch, and planted rows are written without one.
3. **Nothing updates an existing firm.** Seeding is idempotent and tops up, so shipping a larger dataset and re-planting is supported — but it runs only at signup and via the bootstrap script, and there are no scheduled jobs anywhere. A firm that joined last month will not see companies added this month.

*How the database can grow today (FACT — more is built than is visible).*
- **CSV ingest**, four steps — preview → validate (dry-run dedup) → apply — with delimiter and encoding auto-detection, fuzzy header mapping across seven profile fields, a downloadable template, and an **idempotent** upsert.
- **A partner-only bulk load** of a firm's proprietary export, entering at the research/long-list end.
- **One dedup and merge rule everywhere:** block on registrable domain, then normalised name; on a known company, *fill the gaps and never relabel what a source already asserted*. The hard part of growing a database is already solved.
- **An enrichment-provider interface** beside the ranking provider, with partner-managed enable/disable and an **Enrich** control on the lens. `ImportSource.PROVIDER` is defined and unused. **Only a ranking provider and a mock are implemented.**

**Design consequences (STRONG INFERENCE).**
- If this database is the core, **"new to you" is the most important state in the interface** — and it does not exist. The highest-value single addition to this screen.
- Positioned against web and LLM research, **trust beats volume.** Size is a claim the product cannot yet make; *checked, sourced, honest about its gaps* is one an LLM structurally cannot. The product already behaves this way but presents it as housekeeping. It is the argument.
- **Freshness becomes a first-class idea.** "New and current" is the owner's phrase; nothing in the interface expresses when a record was checked or added.

**8. Sourcing funnel** — `/sourcing`, Funnel tab
A kanban over a firm-managed stage vocabulary whose behaviour derives from a *kind* (`RESEARCH / SHORTLIST / ACTIVE / ENGAGED / PASSED / CUSTOM`), so a partner can rename or reorder without breaking transitions. Reaching ACTIVE is the push that starts a cadence.

**9. Projects (deal floor) and the deal room** — `/projects`, `/projects/[id]`
A project is a client; it holds engagements (sell-side / buy-side / capital raise). The list shows a **sides spectrum** — a load-proportional bar segmented by engagement type — plus late / intro-pending / replied counts, last activity, and an overlapping **team stack**. The deal room adds the **book rail** (one cell per engagement) and a working grid grouped **Band → Category**, with Manage team, Add engagement, Edit, Archive (with undo).

**10. Master List — My book and Pipeline board** — `/master`
*My book:* the analyst's companies **across every project**, grouped by project, attention-sorted (late → due soon → awaiting first touch → rest), with a per-project **coverage-cell** strip — one small square per company, coloured by state, each a link. *Pipeline board:* the same book as a kanban by outreach state, with the rule in a caption: *"Drag a card, or use its move menu — a column is never written directly."*
*Note:* the default lens is role-dependent — analysts open on *My book*, partners on *Firm database*. One line of code, and the clearest statement of the two jobs this product serves.

**11. Outreach desk** — `/schedule`
Today's work ordered by lateness: horizon strip, promoted NOW row, keyboard navigation, bulk select, Focus mode, per-row log and send, and the non-email outcomes. The largest single file in the product; every other surface links in with *"Work the queue →"*.

**12. Cadence engine** — server-side, surfaced everywhere
Fixed anchor at the first logged email; follow-ups at `anchor + n × interval`; states `AWAITING_INITIAL → ACTIVE → STOPPED`; a reply, bounce or decline stops the clock; exhausting the cap makes a company **cold**. Not a screen — a behaviour appearing as "84d", "next touch", "Intro pending", "Cadence stopped".

**13. Analytics** — `/analytics`
Opens on a **finding** written as a sentence (*"39 companies are overdue a follow-up. Work the queue →"*) with sub-findings, then four tiles (Emails sent, Reply rate, Interested, Bounce rate), an outreach funnel with the **BIGGEST DROP-OFF** named, a 12-week volume chart, a reply-timing histogram, a driver board by category, a source × quality matrix, and per-engagement and per-analyst leaderboards. Low-n data is quarantined as **"THIN DATA · N<5"**. Every figure drills through.

**14. Email from the analyst's own mailbox** — Settings + compose sheet
Gmail / Outlook OAuth, or a **Sandbox** provider that simulates sends. *"Emails send from your own mailbox through Google or Microsoft's official API — signed by your domain, saved to your Sent folder, replies land in your inbox. Recipients see a normal 1-to-1 email, never a relay or a bot."* One message at a time, on press. **Currently reads "Not configured on this install."**

### Supporting

- **Project health** (partner-only) — book composition per project (Replied / Contacted-no-reply / Never emailed), reply rates, overdue and needs-first-touch counts, analyst activity.
- **Team assignment** — per-engagement, and the visibility boundary of the whole app. Assignment works; creating the user to assign does not (§2).
- **Command palette (⌘K)** — search companies, contacts, projects; jump; quick actions.
- **Email templates** — firm-level, four kinds (Intro, Follow-up, Bump, Breakup), `{{company}}` variables, usage counts.
- **AI draft assist** — tone chips, optional steer, and an explicit hand-back to the user before sending.
- **AI fit scoring** — cached, with thumbs feedback as ground truth and a formal evaluation behind it. Only allow-listed, non-PII fields leave the firm, enforced by a single hard-failing guard.
- **Workspace reset** (partner-only, name-confirmed) — clears the imported book so workbooks can be re-imported clean; keeps the company database and configuration. The one deliberate exception to soft-delete-only.
- **Category and funnel-stage vocabulary management**, **saved searches**, **CSV export**, **column visibility**, **archive/restore with undo**, **light/dark toggle**.

### Minor

Sourcing analytics sub-page; bulk-actions bar; score feedback and evaluation tooling; a deprecated per-deal "sourcing layer" concept kept for back-compatibility.

*The **CSV / bulk pool ingest** and the **enrichment manager** are listed under Discover rather than here: they read as minor utilities but are the only machinery by which the company database grows, which makes them structural to §4.7.*

---

## 5. SCREENS / PAGES

### The product application — authenticated, dark by default

| Screen | Route | Purpose and what the user sees | Primary CTA |
|---|---|---|---|
| **Login** | `/login` | Dark dotted-grid ground, amber "U" mark, wordmark, tagline *"Deal intelligence, institutionalized."*, glass card: Sign in / *"Access your firm's deal book"* | **Sign in** |
| **Signup** | `/signup` | Same shell. Firm / Your name / Email / Password. Explains the empty-book model | **Create workspace** |
| **Dashboard** *(current front door)* | `/dashboard` | Date + firm eyebrow; the backlog number in large red serif; a semicircular pressure gauge; five-tile metric rail; **Today's focus** rows each with **Log**; sourcing funnel; volume and replies; response rate by category | **Work the queue →** |
| **Projects (deal floor)** | `/projects` | *"2 projects · 3 engagements · 75 companies · 39 late · 16 intro pending"*; one row per client with the sides-spectrum bar, health line, team stack | **New project** / **Import from Excel** |
| **Deal room** | `/projects/[id]` | Client eyebrow, project title, status line, team stack, **book rail** of engagements, working grid grouped Band → Category | **Add engagement / Add company** |
| **Import** | `/import` | Four-step stepper; dashed multi-file drop zone; per-tab mapping with detected kind and row counts; review with counters and flags; apply | **Apply import** |
| **Discover / Sourcing** | `/sourcing` | **Where an analyst finds companies the client's list never had — searching the Upstream database instead of the web.** Engagement context header, large search, six filters, save search, database-lens rail, candidate rows with prior-work chips; Funnel tab | **Push** / **Score matches** |
| **Pool ingest** | `/sourcing/import` | The CSV route by which the company database grows: preview → validate → apply | **Apply** |
| **Master List** | `/master` | Three-lens toggle (My book / Pipeline board / Firm database), count line, search, sort, Filters, Columns, dense register, coverage cells | **New company** |
| **Outreach desk** | `/schedule` | Progress line, week horizon strip, NOW row, OVERDUE list, per-row actions, Focus mode, keyboard help | **Log follow-up / Send follow-up** |
| **Contacts (rolodex)** | `/contacts` | Letter rail, person list, person card with Reply/Call/Meeting, **Relationship facts**, notes | **Add person** |
| **Company record** | `/companies/[id]` | Status chips, name, meta row, Touches and response-rate tiles, tabs Overview / Cadence / Contacts / **Timeline** | **Log outreach** |
| **Analytics** | `/analytics` | The finding, four tiles, funnel with drop-off named, charts, drivers, leaderboards | **Work the queue →** |
| **Project health** | `/analytics/projects` | Partner view: five tiles, book composition bars, per-project rows | **Book →** |
| **Settings** | `/settings` | Firm, Cadence, Workspace (counts + reset), Email & sending, Templates, Categories, Stages, Team *(read-only)* | **Reset workspace** |
| **Legacy companies list** | `/companies` | A complete older company list. **Not linked from anywhere** | — |
| **404 / error** | `/not-found`, `(app)/error` | *"That page doesn't exist or may have been archived."* / *"Something went wrong."* | Back to dashboard |

**Navigation as shipped.** Ungrouped: **Dashboard**. **Pipeline:** Projects · Import · Sourcing · Master List. **Outreach:** Schedule · Contacts. **Insights:** Analytics · Project health *(partner)*. **Admin:** Settings *(partner)*. Note **Import sits in Pipeline, not Admin**, with a written justification: onboarding is not a one-off, because a firm brings a workbook per client and the contact list arrives separately.

**States — written, not generic (FACT).** Table skeletons; a shared `EmptyState` (dashed border, tinted icon circle, title and sentence); per-panel error blocks with retry; *"Nothing overdue." / "Nothing due today." / "No companies waiting on a first email."*; *"Nothing logged yet"*; *"Nothing imported yet — this firm is a clean slate."*; *"The rolodex is empty — every analyst's contacts land here."*

### The reference landing page (`marketing/`)

Documented here as **prior art for the artifact being redesigned**, not as a production brand. Its structure is worth knowing because the argument is well built:

**Hero** (a long pinned scroll over aerial river imagery, resolving into an Outreach-desk queue panel marked **DEMO BOOK**) → **The cost** (the four losses) → **The turn** (one line: *"All four are the same failure. The work was done. It had nowhere to live."*) → **The mechanism** (*"You type one word. It is sent."* — a press-and-hold control that logs an email, after which four consequences derive themselves) → **The desk** (*"The whole tool is three screens."* — three real light-mode screenshots, three annotations each) → **The record** (one company, two mandates, side by side: *"Nobody typed the right-hand column."*) → **Depth** (security, five plain statements, and a redacted panel whose rows genuinely never load) → **Questions** (five FAQs) → **Closing** (*"Start with the mandate you are running now."*) → **`/coming-soon`**, where every CTA lands.

**Two structural lessons worth carrying forward:** the page teaches the mechanic by making the reader *perform* it, and it labels its demo data as demo. Both are unusual and both are right.

### Primary product experience

**Not a single screen. The analyst's working day, held in one place.** The product's real subject is the relationship between the software and the person using it: the analyst keeps working the way they already work, and the software keeps everything that used to be kept by hand. A design that treats this as a collection of screens rather than as a working day will lose what makes it coherent.

Within that day, three moments carry different weight:

- **The most *frequent* — the Outreach desk**, specifically clearing one row. The largest, most invested surface; every other screen funnels into it; the most demonstrable moment in the product.
- **The most *relieving* — the import.** A client's four spreadsheets become a live project with history intact. The moment the scattered way of working ends, and the strongest argument for switching.
- **The most *differentiated* — the record speaking back.** Warm history and the prior-work chip in Discover, placements and "Worked by" on the Master List: the software telling the analyst something they did not know and could not have looked up. Hardest to photograph, and the reason this is not a to-do list.

Naming only the first ends in a reminder tool. Naming only the third ends in a database. (STRONG INFERENCE.)

---
## 6. USER INPUTS

Exact current labels and placeholders. Not rewritten.

### Sign in — `/login`

| Field | Label | Placeholder | Validation |
|---|---|---|---|
| email | `EMAIL` (10px uppercase) | `you@firm.com` | valid email — *"Enter a valid email"* |
| password | `PASSWORD` | `••••••••` | non-empty — *"Password is required"* |

Submit **Sign in** → `Signing in…`. 401 → *"Invalid email or password."* Other → *"Something went wrong. Please try again."* Below: *"New firm? **Create a workspace**"*.

### Create your firm — `/signup`

Heading **Create your firm**; sub: *"A private workspace with the company database ready to search. Your deal book starts empty — import your spreadsheets and it fills."*

| Field | Label | Placeholder | Validation |
|---|---|---|---|
| firm_name | `FIRM` | `Northgate Partners` | min 2 — *"Firm name is required"* |
| full_name | `YOUR NAME` | — | min 2 — *"Your name is required"* |
| email | `EMAIL` | — | valid email |
| password | `PASSWORD` | — | min 8 — *"At least 8 characters"* |

409 → *"That email already has an account. Sign in instead."* **The only form in the product that creates a user account.**

### Log outreach — dialog

Title **Log outreach · {Company}**.

- **Type** — `Initial email`, `Follow-up`, `Response received`, `Bounce`, `Declined`, each with a live consequence line:
  - Initial email → *"Logs the first touch and starts the cadence clock."*
  - Follow-up → *"Advances the cadence to the next follow-up."*
  - Response received → *"Captures a reply — this stops the cadence."*
  - Bounce → *"Marks the address as bounced — this stops the cadence."*
  - Declined → *"Records a decline — this stops the cadence."*
- **Date** — native `<input type="date">`, defaults to today.
- **Contact** — `No specific contact` plus the company's people; new-contact path errors with *"Enter the contact's name"*.
- **Notes (optional)** — `Brief notes…`, or `Running log of the interaction…` when a person is attached.
- **Cancel** / **Save**. Toasts: *"Outreach logged"* / *"Response captured"* / *"Failed to log outreach"*.

### Compose email — right-hand sheet

Header **New email · Introduction** or **New email · Follow-up**. Context line: *"First outreach — clock starts on send."*

- **To** — contact select + `Another address…` + `name@company.com`
- **Subject** — live quality checks: *"Write a subject"*, *"All-caps subjects trip spam filters"*, *"Keep the subject under ~78 characters"*; when clean, *"Reads like a personal 1-to-1 email"*
- **Body** — `Introduce the opportunity — short, specific, one clear ask…` / `Move the conversation forward — one new angle, one clear ask…`
- **AI panel** — tone chips + `Optional steer — e.g. mention their Pune expansion`; caption *"Drafts from real deal context — cadence, touches, notes. You edit, you send."*; after drafting, *"AI draft — read it as the recipient before you send."*
- **Internal note** — `Visible to your team, never sent`
- Primary: **Send intro & start clock** / **Send & log follow-up**. Secondary: save as template (`e.g. Warm second follow-up`). Discard confirms *"Discard this draft?"*

### Import wizard — `/import`

The product's most consequential form.

**Header.** **"Import from Excel"** — *"Bring a client workbook in whole — master sheets, the email scheduler and the contact list — as one project with its outreach history intact."* Stepper: **Upload → Project & engagements → Review → Apply**.

**Step 1 — Upload.** Drop zone: *"Drop the client's .xlsx workbooks here, or click to browse"* (drag: *"Drop to upload"*; busy: *"Reading the workbook…"*). Sub-line: *"Take the whole book at once — every workbook you drop lands under one project, and you map each one in turn. Header blocks, the emailing schedule and empty spare tabs are all recognised. Nothing is written until you apply."* Non-`.xlsx` rejected with *"Those don't look like .xlsx workbooks."* Limit **25 MB** per file. Multi-file progress: *"Workbook 2 of 3 · {filename} · 1 applied · 1 still queued."*

**Step 2 — Project & engagements.**
- *"Which client is this workbook?"* — *"Everything you dropped lands under one client. Pick the project it belongs to, or name a new one."* On later files: *"Landing in {project} — chosen for the first workbook in this batch, so the rest of the book stays together."*
- *"Map each tab to an engagement"* — *"Sheet names don't say which deal they belong to, so this is your call — not a guess."* Per tab: sheet name, detected-kind badge (**Master sheet / Email scheduler / Contact list / Research long-list / Not imported**), row count, optional *"FX {rate}"*, optional *"{n} column(s) with no field in the model"*, and three controls — **Don't import / Import as master sheet / Import as contact list**; **Engagement** (existing or new, with a side); **Cadence from** (which scheduler tab, or *"— no scheduler —"*).
- *"Which client is each contact-list row about?"* — *"The contact list's **Reason** column is the client. Rows with no engagement mapped are skipped, never guessed at."*
- Gate: **Preview import**, disabled until complete — *"Name the project and give every imported sheet an engagement to continue."*

**Step 3 — Review.** *"Review before applying · {project}"*. Five counters: **Companies** (+n update) · **Contacts** (+n update) · **Outreach events** (n already logged) · **Sourcing layers** · **Errors** (rows skipped). A per-sheet table: Sheet / Engagement / Rows / **Cadence matched**. Then *"{n} rows need a second look"* with **Show / Hide**, flag counts in plain English, and a table: **Row · Company / person · What the importer decided**. **Back to mapping** / **Apply import** (or **"Apply and continue to the next workbook"**).

**Step 4 — Done.** *"{Project} is live"* with *"{n} companies · {n} contacts · {n} outreach events · {n} engagements"*. **Open {project}** · **Go to the outreach desk** · **Import more workbooks**.

### Push to a deal — dialog, `/sourcing`

**"Push {Company} to a deal"** — *"Pick a project and side — we'll create the placement and ready the cadence."* Fields: **Project**, **Side** (*"Sell-side (find buyers)"* / *"Buy-side (find targets)"* / *"Capital raise (find investors)"*). Branches: several engagements of that side → *"Several engagements of this side — pick one:"*; none but creatable → *"No sell side engagement yet. **Create it & push**"*; none and not creatable → *"No engagement of this side exists. Ask a partner to create one."* On success: inherited **warm history** (*"Worked by {poc} for {client} — {sentiment}, {date}"*, or *"No prior visible touches."*), then *"Pushed. Log the initial email to start the cadence clock?"* → **Done** / **Log initial email** → *"Initial email logged — cadence started"*.

### Add company — dialog

Name (autofocused; triggers the live duplicate check → *"Possibly already worked in another engagement:"* with company, mandate id, match type and first-contact date), Website `example.com`, HQ, Headcount, cadence interval, category, band.

### Discover filters — `/sourcing`

Search (`Search 118 companies — name, city, or domain…`), Any sector, All categories (Strategic / Private Equity / Venture Capital / Family Office / PMS / Private Credit / Investment Bank / Holding-Corporate / Other), Any size (four ₹Cr bands), `HQ city`, `Staff ≥`, toggles **Worked before** and **Scored**, **Save search**, sort.

### Workspace reset — Settings, partner-only, destructive

Requires typing the firm name. Caption: *"Clears the imported book so the workbooks can be re-imported clean."*

---

## 7. OUTPUTS / RESULTS

**Every output below is something the analyst would otherwise have produced by hand** — a sorted list, a date, a history, a candidate set, a Monday report. None is an action the software took on their behalf; all are things it worked out from what they did.

1. **The day's queue — the primary output.** An ordered list of companies to contact, each with computed lateness. Nobody sorts it; nobody maintains the number. *This is the product's actual deliverable, and it replaces reading down a spreadsheet column deciding who is overdue.*
2. **The next-due date and clock state.** Per company: `next_due_date`, `days_remaining`, `is_overdue`, and a state — *Awaiting first email* / *In cadence* / *Cold* / *Cadence stopped*.
3. **The company's outreach history.** An append-only timeline with touch and reply counts, cycle bands where a company was re-approached, per-event notes, each carrying its owner.
4. **The cross-deal record.** A company row carrying every deal it has sat on, which analyst worked it, how many deals it has appeared on — plus, in Discover, the warm-history summary *before* an approach. **The differentiated output.** *(Structural for companies; see §4.4 for the limit on people.)*
5. **The analytics finding.** A sentence, then the numbers: overdue count, never-emailed count, reply rate, interested count, bounce rate, the funnel with its worst step named, 12-week volume, reply-timing distribution, response rate by category with thin data quarantined, per-engagement and per-analyst tables. Every figure drills through.
6. **Duplicate advisories.** A soft warning before a company is added twice across deals.
7. **A sent email**, from the analyst's own mailbox, logged as an event in the same act.
8. **A candidate list for a deal.** A filtered, deduplicated, optionally fit-scored set matching a mandate's criteria, each annotated with whether the firm has approached it before — exportable, or pushed onto the engagement singly or in bulk. **The output that replaces a hand-assembled research list.**
9. **Exports.** CSV from Discover, the Master List and Contacts.

**What the product does NOT output (FACT, strategically important).** No notification, reminder email, digest, alert or scheduled job. Every output is pull, not push: the analyst must open the application to receive any of it.

**Primary vs secondary.** Outputs 1–4 are the product. Output 5 is the partner's product. Output 8 is the one intended to become primary (§4.7). The rest support them.

---

## 8. CURRENT COPY / LANGUAGE

Verbatim, deduplicated. **This is the existing language recorded — not a recommendation.** The landing copy comes from the reference page and is reusable raw material.

### Names and taglines

- Product name in use: **Upstream**
- App metadata: title `Upstream`, description `M&A deal-sourcing CRM`
- App login / signup tagline: **"Deal intelligence, institutionalized."**
- Landing `<title>`: **"Upstream · log the email, the rest is derived"**
- Landing meta: *"The origination and outreach system for boutique M&A desks. One book for the firm, follow-ups computed from a fixed anchor, and a log that is never overwritten. You type one word: sent."*
- Share card caption: **"Log the email. The rest is derived."** + *"Origination and outreach for boutique M&A desks"*
- Footer: *"Origination and outreach for boutique M&A desks. The master list, the follow-up clock and the contact record, joined."*
- Repository / internal: "Project Upstream"

### Landing headlines, in page order

- Eyebrow: **"Deal flow, kept"**
- **"Two analysts. One CFO. Same Tuesday."** / *"Nobody did anything wrong. The client still remembers it."*
- **"One sheet per mandate is one memory per mandate."** / *"The file cannot see the other file, so the desk finds out from the target."*
- **"Upstream keeps the whole current."** / *"One book for the firm. Every name arrives carrying what already happened to it."*
- **"Log the email. The rest is derived."** / *"The clock, the queue, the analytics and the next mandate's head start all come out of that one act."*
- **"Four ways a desk loses what it already earned."** (eyebrow `THE RECKONING`)
- *"All four are the same failure."* / *"The work was done. It had nowhere to live."*
- **"You type one word. It is sent."** / *"That is the whole input. Everything under it is computed on the server, so there is no second job called keeping the CRM up to date."*
- **"The whole tool is three screens."** / *"Screenshots of the running app against a demo book, not renderings."*
- **"May's target is June's buyer, and June opens already knowing."** / *"The firm is the unit, not the mandate."*
- **"A buyer list is the most confidential document a desk owns."** / *"So the answer to who can see what is enforced on the server, where a URL cannot argue with it."*
- FAQ heading: **"What is left."**
- **"Start with the mandate you are running now."** / *"Import the workbook you already keep. If the first week does not read like your own desk, you have lost a week and a spreadsheet."*
- Footer note: *"The book shown in the screenshots is seeded demo data. Upstream ships empty except for a database of real organisations someone checked by hand."*

### The four consequences

- **The clock** — *"Anchored to 12 March. Follow-ups fall on 26 March, 9 April, 23 April."* / *"The anchor never moves. A follow-up sent late does not buy the next one more time, which is the whole reason the date is trustworthy."*
- **The queue** — *"The row stops waiting for its first email and joins the day queue, sorted by how late it is."*
- **The report** — *"Volume and response rate move. Nobody compiles anything on Monday."*
- **The record** — *"A line is appended that the next mandate will read."*

### FAQ — the first is the real objection

1. *"Our last CRM died because nobody updated it. Why is this different?"* → *"Because updating it was a second job… Here the update is the send."*
2. *"Our desk has run on these spreadsheets for years. Why change?"* → *"…This is those exact sheets with the fragility removed."*
3. *"How long until we are actually running on it?"* → *"Days, not a quarter… You upload the workbooks you keep today."*
4. *"Will it send email on our behalf?"* → *"It sends from your mailbox, one message at a time, when you press send. No relay, no shared sending domain, no bulk send."*
5. *"What if we outgrow it?"* → *"Upstream covers origination and outreach deliberately and stops there… If you need those today, we are the wrong tool today."*

### CTA labels

**Landing:** "See it running" (primary, everywhere) · "How the clock works" · "Read the mechanics" · "Talk to us" · "Open the app".
**App:** Work the queue → · Log follow-up · Log outreach · Send intro & start clock · Send & log follow-up · Push · Score matches · New company · New project · Add engagement · Add person · Import from Excel · Reset workspace · Save search · Follow-up · Skip.

### Navigation labels

**Landing:** The cost · The mechanism · The desk · The record · Questions.
**App:** Dashboard | **PIPELINE:** Projects, Import, Sourcing, Master List | **OUTREACH:** Schedule, Contacts | **INSIGHTS:** Analytics, Project health | **ADMIN:** Settings.

### Recurring in-app phrases

*"one row per company, enriched by every analyst"* · *"The firm knows 256 people at 136 companies."* · *"Today's outreach — 0 / 55 done · ~28 min left"* · *"NOW · your highest priority"* · *"OVERDUE · oldest 68d · avg 29d"* · *"Is outreach working — replies, where they leak, and what's driving them."* · *"BIGGEST DROP-OFF"* · *"THIN DATA · N<5"* · *"HEAVY / PRESSURE"* · *"awaiting a first email"* · *"intro pending"* · *"gone quiet"* · *"Worked before in 2 engagements"* · *"Standing research, searchable in Discover. A reset keeps every row."* · *"Everything below {Firm} is private to this firm."* · *"Nothing is written until you apply."* · *"Every email, call and reply lands here — appended, never overwritten."* · *"Drag a card, or use its move menu — a column is never written directly."*

### A documented house style exists — FACT, and valuable

The landing content file encodes rules the copy is held to: **no em dashes in rendered copy; say the concrete thing; no AI vocabulary (a named ban list: seamless, leverage, robust, empower, streamline, elevate, unlock, actionable, solutions); no outcome numbers, because there are no customers yet; write like someone who has sat on the desk.** It also enforces a **claim ledger** — each claim gets exactly one home on the page — written after an audit found one claim stated five times across twelve sections. **A future writer inherits a real, specified voice. This is the most reusable single artifact in the reference page.**

---

## 9. PRODUCT TERMINOLOGY

### User-facing and load-bearing

| Term | Meaning in the product |
|---|---|
| **Firm** | The tenant and the workspace. *"Everything below {Firm} is private to this firm."* |
| **Project** | A client. Contains one or more engagements. The list is the "deal floor" |
| **Engagement** | One deal for that client, with a side: **Sell-side / Buy-side / Capital raise** (chips: Sell / Buy / Raise), hinted as *finding buyers / finding targets / finding investors* |
| **Company** | A row on a master list; also a **Target / Buyer / Investor** depending on the side |
| **Contact** | A person at a company |
| **Placement** | One appearance of a company on one engagement — the join between the firm's record and a deal |
| **The Upstream database** | The platform's own, first-party, continuously grown set of researched companies — the source of names a firm does not yet have, and described by the owner as the core of the product. **Intended concept; §4.7 has how far the build implements it** |
| **The firm's own book** | What the customer uploads — companies they already work, with their history. Private to them |
| **Profile / the company database / the pool** | The deduplicated company record placements hang off, and the single firm-scoped table both tiers currently land in. The interface says **"Company database"**; the code says **pool**; the copy says *"standing research"* — three names, one object, and **no field distinguishing which tier a row came from** |
| **Coverage** | How much of the database is actually filled in (*Domain 100% · Revenue 98% · Staff 98%*). A trust signal, not a statistic |
| **Worked by** | Which analysts have touched this company, ever |
| **Deals** | How many engagements a company has appeared on. Also the *"Most worked"* sort and *"Worked in ≥N engagements"* filter |
| **Prior / worked before** | The existence of earlier work, shown before you act (*"2 prior"*) |
| **Warm history** | Who worked them, for which client, with what sentiment, when |
| **Known via / Connected / Last touch / Latest read** | The four "Relationship facts" on a person: which colleague introduced them, when the relationship began, when it last moved, how it reads |
| **POC** | The analyst who owns a person relationship |
| **Outreach / touch** | One recorded interaction: initial email, follow-up, response, bounce, call, LinkedIn, meeting, note |
| **Cadence** | The follow-up schedule. **Anchor** = the immutable initial-email date. **Interval** = days between follow-ups (default 14) |
| **The queue** | Today's ordered work. **Late / overdue**, **due today**, **upcoming**, **new** |
| **Book** | The firm's live working set — "My book", "your book", "the imported book" |
| **Push** | Moving a database company onto a deal — the act that can start a cadence |
| **Funnel / stage** | Research → Shortlist → Active → Engaged → Passed |
| **Cold** | A company whose follow-up cap was exhausted |
| **Awaiting first email / intro pending** | A schedule whose clock has not started |
| **Coverage cells** | One small square per company on a project's row, coloured by relationship state |

### Metaphors currently in play

1. **The desk** — *"Outreach desk"*, *"boutique M&A desks"*, *"someone who has sat on the desk"*. The most consistently used human metaphor, and the one native to the copy.
2. **The record / register / ledger** — *"appended, never overwritten"*, *"the register the desk already keeps"*.
3. **River / current** — the reference landing page's organising metaphor, built to justify the name. Its own CSS states the premise: the industry "speaks nothing but river words and stopped hearing them: deal flow, the pipeline, the source, downstream."

### Internal / developer-facing — do NOT treat as brand vocabulary

- **Mandate** — the database name for what the interface calls an **engagement**. A deliberate rename exists in the frontend's label module, applied incompletely: "mandate" still leaks into the landing copy, the duplicate warning ("mandate 12") and the company record ("Mandate response rate").
- **Sourcing layer**, **candidate**, **pool**, **profile**, **band**, **schedule cycle**, `AWAITING_INITIAL`, `STOPPED`, `EXHAUSTED`, `TARGET`, `REFERRAL`, `MEDIUM` — system vocabulary, some of it currently rendered raw on screen.
- **Project Upstream** — the repository name.

### Collisions worth a designer's attention

- **Schedule vs Outreach desk** — same screen, two names.
- **Sourcing vs Discover** — same screen, two names.
- **Mandate vs Engagement** — mid-rename.
- **Companies vs Master List** — two routes, one concept; `/companies` is orphaned.
- **"Engagement" means two things in the data model.** Besides the renamed `Mandate`, a separate contact-level `Engagement` field carries `BUY_SIDE / SELL_SIDE / INVESTOR / ADVISOR / OTHER` — inherited from an "Engagement" column in the source spreadsheets. Values overlap but do not match the deal sides (`INVESTOR` vs `CAPITAL_RAISE`).
- **"Warm" and "cold" are not opposites.** *Warm* = a prior relationship exists; *cold* = the cadence exhausted itself. A company can be both.

---

## 10. CURRENT VISUAL DESIGN SYSTEM

**The product app is the design system that matters.** The reference landing page has a separate visual language, summarised at the end of this section as prior art.

### Colour — dark (the default; a visitor with no stored preference gets this)

Internally named **"Obsidian Amber"**, defined in `frontend/app/globals.css` as OKLCH custom properties.

| Token | Value | Role |
|---|---|---|
| `--background` | `oklch(0.09 0.006 265)` | near-black, faintly blue |
| `--card` | `oklch(0.12 0.007 265)` | panel |
| `--popover` | `oklch(0.15 0.007 265)` | overlay |
| `--border` | `oklch(1 0 0 / 0.09)` | one hairline weight for the whole product |
| `--primary` | `oklch(0.72 0.16 58)` | **amber — the only warm colour** |
| `--primary-foreground` | `oklch(0.22 0.03 60)` | dark ink *on* amber (white on amber failed contrast) |
| `--primary-ink` | `= --primary` | amber as small text |
| `--foreground` | `oklch(0.95 0.006 80)` | body ink |
| `--muted-foreground` | `oklch(0.61 0.012 265)` | secondary ink (raised from 0.52 to pass 4.5:1) |
| `--destructive` | `oklch(0.62 0.22 25)` | red |
| `--destructive-ink` | `oklch(0.72 0.19 25)` | red as text |
| charts 1–5 | `0.72 0.16 58` · `0.65 0.18 152` · `0.65 0.18 270` · `0.65 0.15 310` · `0.62 0.22 25` | amber, green, blue, violet, red |

### Colour — light ("Daylight", warm paper)

`--background oklch(0.975 0.004 85)` — a warm off-white, described in source as explicitly "not a white room"; `--card 0.995`; `--border oklch(0 0 0 / 0.10)`; `--primary oklch(0.66 0.15 56)`; `--primary-ink oklch(0.53 0.15 56)`; `--foreground oklch(0.24 0.012 265)`.

### The sanctioned categorical palette

The only non-token hues allowed, defined once in `frontend/lib/design.ts`:

- **Sell-side / Target = emerald · Buy-side / Buyer = sky · Capital raise / Investor = violet.** The same hue means "this side of the market" on every screen.
- Status dots: Not contacted = muted · Contacted = sky · Responded = emerald · Interested = violet · Declined = amber · Bounced = destructive.
- "Awaiting initial" = indigo, documented as the sixth semantic colour.
- Fit-score ramp: emerald → amber → destructive.

### Typography

| Face | Role |
|---|---|
| **Cormorant** (400–700), `--font-display` | Page titles, record titles, large figures. A high-contrast display **serif** — the app's signature |
| **Outfit** (300–700), `--font-sans` | All body text, labels, controls |
| **JetBrains Mono** (400–600), `--font-mono` | Every number the server computed: days late, dates, counts, currency |

All three from Google Fonts. Scale, one definition per role: page title `text-xl` semibold, tracking `-0.02em`, in Cormorant; record title `text-2xl → 3xl`; page subtitle `text-sm` muted; **micro-label 10px / 600 / uppercase / `0.12em` tracking / muted** — described in source as *"genuinely small and genuinely quiet — it exists to be skipped over once the analyst knows the layout"*; panel title `text-sm` semibold.

### Components

shadcn/ui on **base-ui** primitives with Tailwind v4: Button (default / outline / ghost / destructive), Card, Input, Label, Select (plus a native `<select>` styled to `h-8`), Table, Tabs, Dialog, DropdownMenu, Badge, Separator, Skeleton, Sonner toasts.

Product-specific recurring components: StatCard, StatusBadge, DataTable, TableSkeleton, EmptyState, ColumnToggle, BulkBar, ConfirmDialog, CommandPalette, OutreachTimeline, PipelineBoard, SourcingKanban, CandidateCard, ComposeEmailSheet, LogOutreachDialog, PushToDialog, DatabaseLens, MetricRail, GaugeArc, Reveal.

### Visual treatment

- **Panels:** `rounded-xl` + `ring-1 ring-border` — a ring rather than a border, so a panel never adds a pixel to its box — over `bg-card`. One radius, one edge, one surface, defined centrally.
- **Radius:** `--radius: 0.5rem`, with sm/md/lg/xl/2xl derived as multiples.
- **Shadows:** almost none at rest; used for hover lift, the login card and dialogs.
- **Gradients:** a faint amber radial wash at the top of `body`; the amber button hover shimmer; the login page's dotted grid and amber pool; the project hero's corner glow.
- **Icons:** lucide-react throughout.
- **No illustrations, no photography, no stock imagery anywhere in the product.**

### Layout and responsive

A fixed shell: **240px sidebar** + **56px top bar** + scrolling main. Toolbar control height standardised at **32px (`h-8`)**; standard block gap `gap-4`. Tables are full-bleed dense registers with sticky headers.

Responsive is real, verified at 390×844:
- Below `md`, the sidebar collapses into a **256px hamburger drawer** with a scrim, closing on navigation.
- The Master List **drops columns progressively** — four at `sm`, two more at `md`, one at `xl` — so a phone shows company, status and next touch only.
- The Outreach desk has no column-dropping; it is a wrapping flex row, so each queue row reflows rather than truncating.
- The command-palette trigger keeps its icon and drops its label and `⌘K` hint below `sm`.

### Motion

**18 named keyframe animations:** `amber-pulse`, `bar-rise`, `btn-shimmer`, `card-enter`, `col-flash`, `count-pop`, `focus-advance`, `focus-card-in`, `focus-scrim-in`, `horizon-grow`, `meter-grow`, `page-enter`, `rail-grow`, **`row-clear`**, `row-enter`, `sheet-in`, `sheet-out`, `stat-enter`. Plus non-keyframe transitions: `reveal` (blur and rise on scroll) and `hover-lift` (a 3px lift with an amber edge glow).

**Easing is near-uniform:** 20 cubic-bezier declarations, of which **18 are the same curve — `cubic-bezier(0.16, 1, 0.3, 1)`**. Row entrances stagger at 25ms. A full `prefers-reduced-motion` block disables all of it and un-hides scroll-revealed content.

The one that matters most for demonstration: **`row-clear`** — a green flash then a collapse, when a touch is logged.

### Themes

Class-based (`.dark` on `<html>`), stored in `localStorage`, applied by an inline script before first paint. **Dark is the default when nothing is stored.** A toggle sits in the top bar. Both themes are complete and consistent.

### Accessibility

Recorded in-repo: contrast ratios sit in comments beside the tokens that forced their values (`--primary-foreground`, `--primary-ink`, `--destructive-ink`, `--muted-foreground`), a reduced-motion path exists, and the reference page records an axe-core pass at 1440 and 375/390 with a skip link and 44px coarse-pointer targets. *(Project-recorded results, not tests re-run for this document.)*

### The reference landing page's visual language — prior art, summarised

Light-only, no theme toggle. A cool grey-green canvas (`#EDF2F0`), deep teal accent (`#0E6E6B`), and **exactly one warm colour (`#C2410C`) that only ever means "overdue."** Three faces: **Bricolage Grotesque** (variable, with a width axis that narrows as the page descends into its dark act and opens back out), **Onest** for reading, **Spline Sans Mono** for every computed number. A fixed 3% noise grain; a drawn hairline "channel" running down every fold, self-drawing on scroll and stamped with dates that agree with each other; panels that deliberately do **not** lift on hover (*"a grid of cards that all lift on hover is the tell"*) but light along one edge at the pointer; exactly one pulsing element on the whole page, the single overdue row.

**Worth carrying forward regardless of direction:** the one-warm-colour-means-one-thing discipline, the refusal of default hover conventions, the type doing narrative work, and the restraint of a single animated element.

---

## 11. CURRENT LOGO / BRANDING

### **NO FINAL LOGO FOUND**

Two marks exist. Neither is presented anywhere as a locked identity: no logo file set, no wordmark asset, no clear-space or minimum-size guidance, no brand-guideline document. Both are inline SVG hand-written inside component code.

**The product mark — the one in production.** `frontend/components/brand/logo.tsx`. A "channel U" whose right arm rises past the bowl into a solid triangular arrowhead. The U inherits `currentColor`; the rising arm and arrowhead are amber. Three lockups:
- `UpstreamMark` — the glyph alone (52px on login, 24px in the sidebar).
- `UpstreamTile` — the glyph in dark ink (`#1a1206`) inside a rounded amber gradient tile (`#f4b563 → #d97e26`). The app-icon lockup, duplicated as `frontend/app/icon.svg`, the favicon.
- `UpstreamLogo` — mark plus the wordmark **"Upstream"** in **Cormorant**, 20px, `-0.3px` tracking.

**The reference page's mark.** A teal "Y" confluence — two thin strokes descending and joining into one that continues down — with the wordmark in Bricolage Grotesque. Its source describes it as "two streams joining into one and running down… the same shape the channel in the margin makes when it forks at the record fold, read the other way up." **Treat as prior art belonging to the reference landing page**, not as a competing production identity.

### Favicons

- Product app: `app/icon.svg` — the amber tile. Present and considered.
- Reference landing page: **none.** No icon, no favicon, no apple-touch icon.

### Brand imagery

- Product app: **none.** No photography, no illustration.
- Reference page: AI-generated aerial river photography (§16).

### Social preview

`marketing/public/og.jpg`, 1200×630. A pale braided-river surface, the teal mark and "Upstream" top-left, **"Log the email. The rest is derived."** in Bricolage, and in mono below *"Origination and outreach for boutique M&A desks."* A good card, and the strongest single brand artefact that currently exists.

### Is "Upstream" the brand?

**It is currently user-facing (FACT):** the wordmark appears in the sidebar, on login, in `<title>`, in `applicationName`, in the footer, on the og card, and in landing body copy.

**Treat it as unconfirmed, for four documented reasons:**

1. **The repository calls it a project, not a product:** "Project Upstream" in `README.md`, `CLAUDE.md`, `PROGRESS.md`, and the API title.
2. **It collides with its own demo tenant.** The seeded firm is **"Upstream Capital Advisors"**, so every screenshot on the reference page shows "Upstream" in the sidebar *and* "Upstream Capital Advisors" in the top bar — the product name and a customer's name side by side.
3. **The landing page was rebuilt three times in six weeks**, each with a different premise, palette, type system and mark. The name survived; nothing else did.
4. **The name is being argued for, not assumed.** The landing design note: *"The old page ignored the name and argued that the product is a ledger. This one takes the name literally, because the name is the argument."* A name that needs a page built to justify it is a name under test.

**Conceptual fit (STRONG INFERENCE).** "Upstream" is apt for the *sourcing* half — going upstream of the deal, to origination — and for a river metaphor the industry already speaks. It is weaker for the record-and-cadence half, where the product is most differentiated; and "upstream" carries an unrelated meaning in software that a technical or investor audience reads first. See §23.

---

## 12. LANDING-PAGE-RELEVANT INFORMATION

### The claim the page should rest on

**Your work stops being scattered.** Everything an analyst currently does across three spreadsheets and a browser full of tabs happens in one place — and the software does it *with* them, not for them. This is the version an analyst recognises as their own working day rather than as a partner's anxiety.

Three claims sit under it, in this order:

1. **One place, end to end across origination and outreach.** The firm's own workbooks come in whole; finding new companies happens here instead of in a browser; the outreach is logged where it happens; the follow-up schedule, the record and the reporting all come out of the same material.
2. **It works alongside you, and never acts for you.** It parses your spreadsheet and then asks which deal each tab belongs to. It warns about a duplicate and lets you proceed. It drafts an email and makes you send it. It will not set a status because you dragged a card. Unusually consistent in the build (§1B), and the honest answer to *"is this going to do something on my behalf?"* — a question this audience asks early.
3. **And the firm's memory accrues while you work.** Because everything happens in one place, a record builds itself: every company held once, every prior approach visible before the next one, nothing overwritten. **Nobody maintains it — it is a by-product of working here.**

**Flagged as this document's principal judgement (STRONG INFERENCE).** Claim 3 is the most *defensible* — a competitor cannot add it as a feature — but claim 1 is the most *recognisable*, and claim 2 makes both credible. Leading with the mechanism alone risks a reminder-tool reading; leading with the record alone risks a database reading.

**A hard constraint on claim 3 (FACT):** the firm-scale version depends on multiple users, and a firm cannot add a second user (§2). Until that changes, "your whole team shares one record" describes an architecture, not an experience. The single-analyst version — *your own past work comes back to you* — is fully true today and is the safe form.

### The strongest user benefit

**You stop keeping the system, and the system starts keeping you** — the follow-ups, the contact history, the candidate list and the reporting all maintain themselves out of work you were doing anyway. Underneath: the next deal starts ahead of the last, because nothing had to be carried across by hand.

### The problem to communicate

Not "you have no CRM," and not primarily "you are losing things." **The problem is that the work is scattered** — four files, a browser, and a person holding it together by memory and diligence. That is what an analyst recognises immediately, it is what every surface actually addresses, and it makes the switch feel like consolidation rather than adoption.

The four losses are the *consequences* of that scattering and remain the sharpest writing in the project — keep them as the second beat rather than the first. Loss 03 (*"A buyer you have known for years opens as a stranger"*) maps most directly to the differentiator and is currently the least emphasised.

### Where the primary CTA should lead — currently broken

Every CTA lands on `/coming-soon`, which offers **nothing to do**: no form, no email capture, no calendar, no waitlist. Its own source comment explains why — the site is a static export with no server, and a form that silently discarded input would be worse. The consequence is real: **a prospect without an account has nowhere to go and nothing to leave behind.** This is the first decision to make.

### What deserves emphasis, ranked by evidence of centrality

1. **The scattered day becoming one place** — the frame everything else hangs on.
2. **The workbook import** — "bring the book you already keep, with its history." The switching-cost answer, unusually deep for an MVP, currently buried as FAQ answer 3. It deserves its own fold: drop the file → the project exists → the clock is already running on the right dates.
3. **The queue that maintains itself** — the daily job and the deepest build. Already the hero's payoff panel; keep it.
4. **The Upstream database — stop leaving the tool to find new companies.** When a client's list runs out the analyst currently opens a browser; here they search a database the platform researches and keeps, see instantly which names the firm has already approached, and push what they want onto the deal. The competitor for this half is not another CRM — it is a browser tab, a directory and an LLM prompt. A sharper enemy than "your spreadsheet", and the current page does not mention it at all.
   **Three cautions:** what ships today is a 164-company starter set copied into each firm, not a live shared database; there is no way yet to show which results are new to a firm (§4.7); and the honest claim is *"researched, sourced, and deduplicated against your own history"* rather than *"everything"*. **Size is the claim this product cannot yet make; trustworthiness is the claim an LLM cannot make.**
5. **Sending from your own mailbox** — a genuine objection-killer: no relay, no bulk send, deliverability stays yours.
6. **Confidentiality enforced server-side** — a buyer list is the most sensitive document a desk owns, and the security claims are unusually specific and true to the code.

### Proof and demonstration material that exists

- Three real light-mode screenshots against a demo book — already shipped, already annotated.
- A verified cross-deal example: **Tata Power Company** sits on two engagements in the demo book (confirmed by query, not only by copy); **Cipla Ltd** on three. The best asset for the memory claim.
- Real computed figures: 24% reply rate, 59 contacted, 39 overdue, median 75.5 days to reply, the biggest funnel drop-off named.
- **164 real, hand-checked organisations** with cited public sources and deliberately no invented revenue or headcount. "Someone checked these by hand" is a small, verifiable, unusual proof point.
- **Engineering credibility, currently unused:** 32 backend test files, ~20 frontend unit tests, 10 end-to-end specs; an egress allow-list with a hard-failing guard so no PII reaches a third-party model; an import preview that provably rolls back. For a firm handing over its buyer list, this answers "is this a weekend project?"
- The importer's flag vocabulary as proof of care: *"Excel had no date for this event — dated to the last known touch."* A product that shows what it could not know reads as trustworthy in a way feature copy never does.
- **No customer proof of any kind exists.** No logos, testimonials, case studies or traction metrics. The copy rules forbid inventing any. Respect that.

### Objections a visitor will have

**Answered on the reference page:** nobody updated the last CRM; we already use spreadsheets; how long to switch; will it send email for us; what if we outgrow it.

**Unanswered and likely:** What does it cost? Who else uses it? Who built it? Is my buyer list safe with a startup? Does it work outside India / in USD? Can I try it without talking to anyone? Does it integrate with anything I run? What happens to my data if I leave? Can my whole team use it?

### What should NOT be emphasised

- **AI.** Real but peripheral, off by default, and in tension with the product's own "no second job" argument. Leading with it puts the product in the wrong category against the wrong competitors.
- **Feature breadth.** It deliberately stops at origination and outreach, and says so.
- **Any number implying traction.**
- **The dashboard's red "HEAVY PRESSURE" gauge** as a hero visual — the most alarming frame in the product.
- **"Automatic import."** Claim "you never retype a row," not "it does it all for you" — the refusal to guess is a selling point.
- **"Nothing slips" as an active promise**, unless the wording makes clear the product surfaces lapses when you open it. There is no notification system.
- **Team and collaboration as a live capability**, until a firm can add a second user.
- **A database larger than the one that ships.**

### What differentiates it from a generic alternative

1. The record is firm-wide, deduplicated and append-only **by construction**, not by convention — and, as the copy correctly notes, that "is not a setting you can switch on later."
2. Prior work surfaces *before* the next approach, across team boundaries, without exposing another team's detail.
3. Onboarding is "upload the workbook you already keep," history included — not a configuration project.
4. The clock has a fixed anchor, so a late send does not quietly reschedule the future.
5. Email goes out one at a time from the analyst's own mailbox; there is deliberately no bulk send.
6. The software consistently declines to act for the user, which is the opposite of how this category sells itself.

---

## 13. PRODUCT POSITIONING

**Category (FACT, self-declared).** A vertical CRM for M&A / investment-banking **deal origination and outreach**. Landing meta: *"the origination and outreach system for boutique M&A desks."* FAQ 5 draws the boundary: *"…covers origination and outreach deliberately and stops there."*

**More precisely (STRONG INFERENCE).** A **working environment for a deal analyst** — one place for the whole origination-and-outreach day — that happens to leave behind a firm-wide relationship record. Origination and outreach are the *activities*; the record is the *asset*; the working relationship is the *character*.

**What users would compare it to (FACT, from the repository).** DealCloud, Affinity, a Salesforce instance, and — most importantly — **their own spreadsheets**, which the copy treats as the real incumbent.

**And a second comparison set (INTENT, structurally corroborated).** For finding companies the client's list never had, the thing displaced is the analyst's own research method — web search, directories, an LLM — not a rival CRM. This gives **two distinct competitive frames** needing different arguments: against a CRM, *nobody has to maintain this*; against ad-hoc research, *this was researched and checked, and it already knows who you have approached.* The current positioning addresses only the first.

It also implies **two things being sold**: software, and a data asset the platform owns and grows. The second compounds independently of any one customer, and nothing in the current brand or interface treats it as an asset in its own right.

**Apparent positioning (STRONG INFERENCE).** The honest, narrow, low-friction alternative to a heavyweight deal CRM, for a firm too small to absorb a Salesforce or DealCloud rollout. Positioned against *adoption failure* rather than feature gaps.

**Strongest differentiator (FACT-backed).** That the analyst's whole origination-and-outreach day happens in one place, on terms the analyst sets — **and that a firm-level record accrues out of it without anyone maintaining one.** Four load-bearing parts:

1. **The way in costs nothing** — existing workbooks arrive whole, with history.
2. **The research step comes inside** — candidates found in a held, checked database rather than a browser.
3. **The maintenance is a by-product** — one logged act derives the clock, the queue, the record and the report.
4. **The software never acts for the analyst** — it asks, advises, drafts and warns, but every consequential action stays with the person.

A competitor can copy any single feature. What is hard to copy is that the record is a **consequence of the work** rather than an additional task — precisely the failure mode this category is known for.

**Weakest and least-developed areas (FACT).**
- **Acquisition:** no pricing, no capture, no proof, no story about who made it.
- **Brand identity:** the product app has a coherent one; there is no guideline, no logo file set, and the name is unresolved.
- **The collaborative layer is unreachable.** A firm cannot add a second user.
- **No notifications.** The product cannot tell anyone anything unless they arrive.
- **People are not deduplicated across deals**, so half the "shared record" story is a view rather than an entity.
- **The Upstream database is a starter set, not yet a platform asset** — no shared tier, no provenance, no refresh.
- **The deal does not carry its own criteria.** The thesis sent to the scorer is side-only; sourcing constraints live in a filter bar. Under §4.7 this matters more, because a mandate's brief *is* the search.
- **Email sending is inert** on this install.
- **Onboarding inside the app:** a new firm lands on an empty backlog with no guided first step and no pointer to Import.
- Some surfaces still show system values (`TARGET`, `REFERRAL`, `mandate 12`).

**What the brand should communicate rationally:** consolidation — one place for work spread across four files and a browser; precision and permanence of record; confidentiality; a narrow scope honestly held; speed to first value; and control staying with the user.

**What it should communicate emotionally (STRONG INFERENCE).** The relief of not holding it all together yourself, and the respect of a tool that assumes you know your job. A **working-alongside** feeling rather than a rescued-from-disaster one: not *"we caught what you missed"* but *"you keep working; this keeps up."* The existing copy is dry, concrete, slightly rueful, and unusually good — and note that even at its most cautionary it declines to blame the analyst, the same instinct the software shows when it advises instead of blocking.

**UNKNOWN:** whether the intended positioning is boutique-M&A-only or whether M&A is a beachhead. The copy is emphatically M&A-specific; the data model would serve any relationship-led business-development desk, and the shipped database is IT-services and PE/VC weighted.

---

## 14. COMPETITIVE / CATEGORY SIGNALS

### Named in the repository (FACT — the only ones)

From the landing design package, recorded as buyer research:
- **DealCloud** — *"the standard,"* and also *"expensive and clunky."*
- **Affinity** — *"clean,"* and *"limited workflow."*
- **Salesforce** — *"a Salesforce instance nobody updates, or analyst-maintained Excel trackers."*
- Sources cited: **Amafi, Meridian, 4Degrees, Dialllog, InsightsCRM**.
- Buyer quotes captured: *"Manual data entry is the single biggest reason IB CRM deployments fail."* · *"reporting that leadership can run without analyst rework"* · *"relationship intelligence across the platform."*

**The de facto incumbent named throughout the product is Excel.** The nav says "Import from Excel"; the FAQ frames the product as "those exact sheets with the fragility removed."

### A second incumbent, unnamed but structurally present

For the sourcing half, the thing being replaced is the analyst's research method — web search, directories, portfolio pages, an LLM. The evidence is indirect but consistent: a shipped database of hand-verified organisations *with cited sources*; a documented refusal to invent revenue or headcount; a coverage rail reporting what is missing; a dedup rule that fills gaps but never relabels an asserted fact. Every one of those is a defence against research assembled ad hoc — stale, unattributed, or confidently wrong.

**No competitor of this kind is named anywhere**, and none should be inferred beyond the five above.

### Integrations and external services actually used (FACT)

- **Google Gmail API** and **Microsoft Graph** via OAuth, for sending from the user's own mailbox, plus a Sandbox simulator.
- **Groq** for LLM inference (drafting, fit scoring), with a provider registry and a mock.
- **Google Fonts.**
- Hosting: **Vercel** (product app), **Railway** (API), **GitHub Pages** (reference landing page, static export).

### Signals of an intended data-ingestion path

`ImportSource` already carries a **`PROVIDER`** value alongside CSV, bulk export and workbook. An **enrichment-provider interface** exists in parallel with the ranking provider, with partner-managed enable/disable and an **Enrich** control on the Discover lens. **Only a ranking provider and a mock are implemented.** The seams for a data vendor were built and left open.

### Concepts borrowed from existing products (STRONG INFERENCE, from UI patterns)

A ⌘K command palette (Linear / Superhuman), a kanban board, a split-view rolodex, single-item triage "Focus mode", an inbox-zero progress bar with a time estimate, and pastel tag chips described in source as "quiet Linear-style".

---

## 15. TECHNICAL CONSTRAINTS THAT AFFECT DESIGN

| Constraint | Design implication |
|---|---|
| **Two separate Next.js 16 apps** (product, reference landing page), different dependencies and CSS | A brand system must be authored twice, or extracted into something shared |
| **The landing page is a static export to GitHub Pages under a base path** | No server, no API, no form handling. Any email capture, waitlist or demo booking needs a third-party endpoint or a new host. The direct cause of the dead-end CTA |
| **No user-creation endpoint outside signup** | A landing page cannot honestly sell team collaboration as a live capability, and onboarding cannot include "invite your colleagues" until this exists |
| **No scheduler, cron, worker or notification path** | Any promise of proactive alerting is a product change, not a copy change. All value delivery is pull-based |
| **Contacts attach to per-deal company rows** | A person-level relationship view (everyone we know at this company, across deals) cannot be designed against the current schema without a migration |
| **A company record has no provenance field** | `CompanyProfile` records nothing about where a row came from, and imports merge into one table under one dedup rule. **The "ours vs yours" distinction cannot be rendered, filtered or counted.** Any design showing "new to you" or a separate platform tier needs a schema change first — the largest build gap behind the intended sourcing model |
| **The company database is copied per firm, by explicit decision** | A shared, continuously grown database is an architectural change, not a content exercise. Growing the shipped dataset and re-planting is supported; nothing updates existing firms. Design the surface to read well at 164 rows *and* at 164,000 |
| **Enrichment has an interface but no implementation** | "Where does the data come from, and how fresh is it?" is answerable architecturally and not yet in practice. Any UI implying live enrichment would be ahead of the build |
| **Tailwind v4 + CSS custom properties** | Recolouring is genuinely cheap — the app's palette is ~60 lines and every component resolves through it. A full repaint is a small, safe change |
| **shadcn/ui on base-ui primitives** | Component *behaviour* (dialogs, menus, selects, focus management) is inherited and solid; restyling is free, replacing the library is not |
| **Split-origin auth on httpOnly cross-site cookies** | Login must stay on the product's own origin; the landing page cannot host a working sign-in form |
| **`next/image` with `unoptimized: true`** on the landing app | Screenshots and photography must be pre-sized and hand-optimised (they currently are — WebP) |
| **Dark is the app's default; the reference page is light-only** | A visitor sees light screenshots and lands in a dark app. Either the default or the screenshots should change |
| **Charts are recharts** | Standard primitives; the product already hand-builds several custom SVG pieces, so bespoke chart art is precedented but manual |
| **Motion:** framer-motion in the app, `motion` on the landing page; full reduced-motion paths in both | Ambitious motion is feasible and precedented; the reduced-motion contract must be preserved |
| **Density is a requirement, not a style** | Real books run to hundreds of rows with 8–12 columns. Any redesign that materially increases row height or whitespace makes the primary screen worse |
| **Hard caps that shape dense screens** | Duplicate detection scans at most **500** companies; scoring runs at most **200** candidates; the coverage-cell strip caps at **40** squares per project; Discover pages at 25, the Master List at 50; upload capped at **25 MB**. Two affect claims, not just performance: the duplicate warning degrades on a large book, and the "countable project" signature silently truncates above 40 companies |
| **Currency (₹ Cr) and timezone (IST) are hard-coded** | Any positioning implying global or multi-currency use runs ahead of the build |
| **Sidebar 240px / topbar 56px / control height 32px are established** | Changing the shell is safe but touches every screen |
| **Per-screen CSV export exists; no account-level export; deletion is soft-only** | "What happens to my data if I leave?" cannot currently be answered with a feature |
| **Test and safety infrastructure exists** — 32 backend test files, ~20 frontend tests, 10 e2e specs, an egress allow-list guard, a rollback-verified import preview | Usable as credibility material; also means behavioural changes have a safety net |

---

## 16. EXISTING ASSETS

| Path | Type | What it is | Final? | Reusable? |
|---|---|---|---|---|
| `marketing/public/product/master.webp` | Screenshot 1800×1125 | Master List, **light theme**, real demo book | Intentional, recent | **Yes — best product asset in the repo** |
| `marketing/public/product/schedule.webp` | Screenshot | Outreach desk, light theme | Intentional | **Yes** |
| `marketing/public/product/analytics.webp` | Screenshot | Analytics, light theme | Intentional | **Yes** |
| `marketing/public/og.jpg` | 2400×1260 share card | Mark, wordmark, headline over river | Intentional | **Yes — strongest brand artefact that exists** |
| `marketing/public/hero/1–4.webp` | Four AI-generated stills (~570KB) | Braided glacial delta: confluence → divided channels → bars drowning → one current with a rust strand | Intentional | Yes, if the river metaphor survives |
| `marketing/public/scene/*.jpg` | Five AI-generated plates | Fold backdrops, masked and washed | Intentional | Yes, same caveat |
| `marketing/public/current-loop.webm` + poster | Video loop | Closing fold, recorded off the page's own canvas | Intentional | Conditional on the metaphor |
| `backend/app/data/company_pool.py` | Data | **164 verified real organisations** with cited public sources, deliberately no invented revenue or headcount | Intentional and unusual | **Yes — as a proof point** |
| `frontend/app/icon.svg` | SVG favicon | Amber tile with the channel-U | Intentional | Yes, if the product mark survives |
| `frontend/components/brand/logo.tsx` | Three inline SVG lockups | The product mark in three forms | Intentional | Yes, same condition |
| `marketing/components/site/nav.tsx` → `Mark` | Inline SVG | The teal confluence mark | Reference page | Prior art |
| `frontend/public/*.svg` (5 files) | SVGs | **Next.js starter defaults, never referenced** | Scaffolding | No — delete |
| `frontend/screenshots/*.png` (~30) | Screenshots | Dev captures, mostly **stale** — they predate several redesigns | Working files | No |
| `phase_2/*.xlsx` (3 files) | Client workbooks | The real source spreadsheets the product was built from | Real, sensitive | **Do not publish** |
| `sq/`, `sq.zip` (864 MB), `theme fixer/` | Unrelated directories | Not part of the product | Junk | No |

**Fonts in use** (all Google Fonts, all free): Cormorant, Outfit, JetBrains Mono (product app); Bricolage Grotesque, Onest, Spline Sans Mono (reference page).

**No logo file set, no brand-guideline document, no illustration library, no icon set beyond lucide-react.**

---

## 17. THINGS THAT ARE CLEARLY NOT FINAL

Each item separates what was observed from why it reads as unsettled.

**1. The brand is unresolved, and the name is under test.**
*Evidence:* two hand-drawn inline-SVG marks, no logo files, no guidelines; the name appearing as "Project Upstream" in every internal document; the demo tenant sharing the product's name inside the screenshots used to sell it; three complete landing rebuilds in six weeks, each with a different premise, palette, type system and mark.
*Interpretation:* the product app has a coherent and considered visual system; what it does not have is a brand — a name, a mark and a set of rules anyone has committed to.

**2. A firm cannot add a second user.**
*Evidence:* `GET /users` is the only route in the users router; the only user-creating endpoint anywhere is `POST /auth/signup`, which creates a new firm; Settings → Team is read-only; the demo's users came from a seeding script.
*Interpretation:* either an unbuilt invite flow or a deliberate closed-beta posture. **Unresolved (§19).** Either way, every collaborative capability is unreachable for a self-serve firm.

**3. No notification, reminder or scheduled job exists.**
*Evidence:* no cron, scheduler, worker or digest anywhere; email sending is request-scoped only.
*Interpretation:* either deliberate scope discipline or the most obvious missing feature. Nothing indicates which.

**4. People are not deduplicated across deals.**
*Evidence:* a contact row is bound to a per-deal company row; the demo book's Cipla Ltd holds three placements carrying six unrelated contact rows; the rolodex's "136 companies" counts placements rather than the 118 distinct companies.
*Interpretation:* `CLAUDE.md` describes contacts as "reusable across mandates **later**" — deferred rather than rejected.

**5. The Upstream database exists as a concept and a starter dataset, not yet as a platform asset.**
*Evidence:* 164 organisations copied into each firm rather than served from a shared tier; no provenance field, so platform rows and a firm's imported rows are indistinguishable once merged; ingest, dedup, merge and enrichment *interfaces* all built; only a ranking provider implemented; `ImportSource.PROVIDER` defined and unused; no refresh for existing firms.
*Interpretation:* a seeded starting point with most of the growth machinery fitted, and the two pieces that make it a *platform* asset — a shared tier and provenance — not built. **Treat the size, the isolation model and the absence of provenance as unsettled.**

**6. The application's front door does not match its own navigation.**
*Evidence:* `/`, login and signup all redirect to `/dashboard`; the nav then presents a project-first sequence.
*Interpretation:* **genuinely ambiguous** — equally consistent with build order and with a deliberate "attention first" opinion. Recorded as unsettled, and carried into §18-D.

**7. The login tagline: "Deal intelligence, institutionalized."**
*Evidence:* it appears on login and signup and nowhere else, in exactly the register the house-style rules ban.
*Interpretation:* a leftover from an earlier positioning pass, contradicted by the newer, sharper voice.

**8. The CTA funnel dead-ends.** All CTAs → `/coming-soon`, which has no form and no next step — acknowledged as provisional in that page's own source comment.

**9. No pricing anywhere.** The progress log marks the landing track complete "(pricing deferred)".

**10. Raw system values in the UI.** The company record renders `TARGET`, `REFERRAL`, `MEDIUM`; the duplicate warning prints "mandate 12"; the nav says "Schedule" while the page says "Outreach desk". A label module exists precisely to fix this class of problem and has been applied only partly.

**11. "Engagement" names two different things** — the renamed `Mandate`, and a contact-level field with overlapping but non-matching values. Inherited from the source spreadsheets and never reconciled.

**12. A visual defect in Discover.** At 1440px the word `UNSCORED` on each candidate row is clipped by the panel's left edge, in both themes. A layout bug, not a style.

**13. An orphaned route.** `/companies` renders a complete older company list; nothing links to it.

**14. Demo data is visibly fake in places.** Faker lorem-ipsum in company and contact notes sitting beside real Indian company names. It will appear in any screenshot of a record's notes.

**15. Two seeders produce two different database sizes — not a discrepancy.** The shipped pool holds **164** verified organisations, planted at signup; the Faker demo book generates its own **118**. Two initialisation paths, both correct. Recorded because comparing "164" in copy against "118" on screen otherwise reads as an error.

**16. Next.js starter assets still in `frontend/public`.** Five unreferenced SVGs.

**17. Dev-tool chrome in local captures.** The Next.js dev badge and TanStack Query devtools launcher appear in the corners of every local screen; not present in a production build.

**18. The reference landing page has no favicon.**

**19. Email sending is built but inert.** Settings shows *"Not configured on this install"* for both providers; a Sandbox provider simulates sends. The sending claims are currently unexercised.

**Not flagged as unfinished, because the evidence says they are deliberate:** the dense tables, the small quiet labels, the display serif, the amber-on-dark restraint, the fixed anchor rule, the append-only log, the advisory-not-blocking duplicate check, and the absence of customer proof.

---

## 18. DESIGN FREEDOM

### A. Free to change completely

- **The product name and all wordmarks.** Nothing functional depends on the string "Upstream" — no domain-bound logic, and the only seeded content referencing it is the demo firm name, one string.
- **Both marks.** Each is hand-written inline SVG in a single component.
- **The entire colour system.** ~60 lines of tokens, and every component resolves through them. A total repaint is small and safe.
- **All six typefaces.** Loaded through `next/font/google` and referenced only through `--font-*` variables.
- **The landing page in full** — structure, copy, imagery, motion, metaphor. A standalone app with a single content file.
- **All marketing copy**, and most in-app microcopy.
- **Decorative treatment** — glows, shimmer, hover behaviours, the login glassmorphism.
- **The icon set** (lucide is swappable).
- **Page titles and nav labels** — and "Schedule" vs "Outreach desk" should in fact be reconciled.

### B. Should probably remain — they are the product

- **The single-input mechanic.** Log the send; everything derives. Any redesign that adds required fields to that act destroys the central claim.
- **The refusal to act on the analyst's behalf** — consistent across the importer, the duplicate check, the board, the compose sheet and the scorer. A stance, not a set of behaviours.
- **The fixed anchor and computed cadence**, and the vocabulary that makes it legible.
- **The append-only, never-overwritten log**, and archive instead of delete.
- **The deduplicated firm-wide company record with its placements** — the differentiator's physical form.
- **Warm history's scoping rule:** existence firm-wide, detail visibility-scoped.
- **Firm-as-workspace scoping** and the two-role split.
- **The three lenses on the Master List** — one concept, three views, no page change.
- **The queue-first daily surface** and its density.
- **Workbook import as the onboarding.**
- **Monospaced figures.** Every server-computed number is mono and tabular; it is why a column of days-late reads as an instrument.
- **The categorical colour law.** Hues may change; one-hue-one-meaning should not.
- **The copy house style.** The best-defined part of the brand that exists.

### C. Technically constrained

- **Login cannot move to the landing origin** (cross-site cookie auth).
- **The landing page cannot accept form submissions** as currently deployed.
- **Screenshots must be regenerated whenever the app's theme changes** — they are baked WebP.
- **₹ Cr and IST are in the code**, so global or multi-currency promises run ahead of the build.
- **Dense tables set a floor** on row height and type size.
- **The reduced-motion contract** must be preserved.
- **A person-level relationship view** cannot be designed against the current contact schema without a migration.
- **Proactive alerting** cannot be designed without new backend infrastructure.
- **"New to you" in Discover** cannot be shown without adding provenance to a company record.

### D. Requires a product decision before design can resolve it

1. **Is the firm-scale promise the position?** If yes, the missing invite flow and the missing notifications are prerequisites, not details. If no, the honest near-term position is the single-desk one the software delivers today, with firm-scale held as a second act. **This governs almost everything downstream.**
2. **Where should a user land** — the project (which the navigation implies) or the backlog (which the code does)? This determines whether the story is "the deal you are running" or "the day you are having."
3. **Does a project carry its own criteria?** If yes, an engagement needs a stored thesis that feeds the scorer, seeds the Discover filters and becomes shareable team context. If no, saved searches are the answer and belong in the deal room. Today it is neither — and under decision 4 this becomes more pressing, because a mandate's brief *is* the search.
4. **Is the Upstream database a platform asset, or a starter set?**
   - **Platform asset** — partly a data business. Needs a shared tier, a provenance field so "ours" and "yours" stay separable, a curation and refresh operation, a freshness story, and an answer to "who can see my edits". The brand can then claim reach, and the database becomes a reason to renew.
   - **Starter set** — purely a tool. Grows by shipping bigger datasets and by what each firm imports; its claim is fit and quality rather than reach.
   The likeliest resolution is a hybrid — a shared read-mostly tier plus a private per-firm overlay — and **the minimum first step either way is provenance on a company record**, because without it the two tiers cannot be told apart in any interface.
5. **Where does the data come from, and how fresh is it?** An enrichment interface exists with no provider behind it. Positioned against LLM research, this is the first question a serious buyer asks.
6. **How loud should the memory be?** Warm history could remain a chip, become a row-level banner, or interrupt before a first email is sent.
7. **Is import an onboarding step or a standing surface?** The code argues standing; the absence of any dashboard pointer argues onboarding.
8. **Who is this for, precisely?** Boutique M&A only, or relationship-led origination desks generally? The copy says the former; the data model supports the latter.
9. **Pricing and business model.** A landing page cannot be finished without this.
10. **Access model** — closed beta with a waitlist, self-serve signup (which already works), or sales-led.
11. **Geography and currency.**
12. **Light or dark as the product's default**, and whether the landing page follows.
13. **Whether "Upstream" survives** (§23) — and, separately, **what the database is called** if it does not.
14. **Whether AI is part of the story** or stays an invisible convenience.
15. **What replaces "no proof"** — the launch needs a credibility substitute. Candidates that exist: the hand-checked 164-company database, the test and security posture, the import's honesty, design pedigree, founder story.

---

## 19. IMPORTANT UNKNOWNS

The codebase genuinely cannot answer these.

1. **Pricing.** No plan, tier, seat, quota, metering or billing code exists anywhere — verified by sweep. *The absence is itself evidence: the product has not been built toward any commercial shape.*
2. **Business model** — per-seat, per-firm, per-deal?
3. **How the Upstream database reaches scale.** Curated in-house, licensed, contributed by customers, crawled, or some combination — the ingestion seams exist for all and none is chosen. Since the owner calls this database the core of the product, **this is the largest unanswered question in the document**, and it is a business question before a design one.
4. **How the two tiers stay separable** if the database is shared and a firm's book private. The schema has no provenance today.
5. **Whether the Upstream database is a commercial unit** — bundled, tiered by coverage, or priced separately.
6. **Data provenance and licensing.** The shipped 164 rows cite public sources; nothing states what may lawfully be ingested at scale.
7. **Whether single-user-per-firm is intentional** — closed-beta posture, or an unbuilt invite flow?
8. **Whether person-level identity across deals is planned.**
9. **Whether the absence of notifications is scope discipline or a gap.**
10. **Launch status.** The app is deployed and credentialled; the landing says "not open yet, opening to a small number of desks first."
11. **Whether there are any users or customers.** The copy states there are none; current status unknown.
12. **Target geography.** India is in the build; the marketing never mentions it.
13. **Who built it** — no team page, no about, no founder story, no company entity anywhere.
14. **Legal entity, company name, jurisdiction.** The footer says only "© 2026 Upstream."
15. **The intended sales motion** — self-serve, founder-led, or through introductions.
16. **Roadmap.** FAQ 5 says execution and diligence are "the next stage," with no timeline.
17. **Whether the demo firm name is placeholder or intentional.**
18. **Whether the product intends to serve other relationship-led industries.** The data model would allow it; nothing states an intent.
19. **Brand personality intent.** The copy has a strong voice; nothing states whether it was chosen or emerged.
20. **Competitive strategy.** Three competitors are quoted in a research note; no positioning statement exists.
21. **Domain and URL strategy.** No custom domain is configured anywhere.
22. **Whether "Upstream" is trademark-clear, or even preferred.**
23. **Security and compliance posture as a commitment** (SOC 2, DPA, data residency). The engineering is good; nothing states an obligation.
24. **Data portability on exit.**

---

## 20. EXECUTIVE SUMMARY

**PRODUCT**
One place for the whole of an analyst's origination and outreach work — the firm's own lists, the people, the follow-ups, and a platform-kept database of new companies to approach — built to work alongside the analyst rather than in place of them, with a firm-level record accruing as a by-product.

**TARGET USER**
Analysts and partners at boutique or mid-market M&A advisory desks — small, spreadsheet-fluent, firm-scoped teams. Built India-first, positioned nowhere in particular.

**PROBLEM**
The work is scattered, and it runs out. An analyst runs a client's outreach across three spreadsheets, re-typing the same company into each and holding it together by memory; and when the client's list is exhausted, finding more means leaving the tools entirely for web searches, directories and an LLM, producing a list nobody can check or repeat. The consequences arrive later as lapsed follow-ups, duplicate approaches, a long-known buyer opened as a stranger, and relationships that leave with the analyst.

**SOLUTION**
Consolidate the whole workflow into one place that works the analyst's way: existing workbooks import whole with their history; finding new companies happens against the Upstream database — the platform's own researched company data — instead of in a browser; outreach is logged where it happens; and the follow-up schedule, the firm-wide record and the reporting all derive themselves from that. The software asks, advises, drafts and warns — it never sends, decides or overwrites on the analyst's behalf.

**CORE ACTION**
Log that an email was sent — the one thing the analyst types, and something they were doing anyway.

**CORE VALUE**
The analyst stops keeping the system and the system starts keeping them: nothing is re-typed, nothing is chased by hand, and the firm's memory stays true — not because anyone maintains it, but because the work now happens somewhere that remembers.

**KEY FEATURES**
- The firm-wide deduplicated company record, with cross-deal placements, "Worked by" and a "Deals" count
- Warm history and a non-blocking cross-deal duplicate warning, shown *before* the next approach
- Whole-workbook Excel import that reconstructs backdated outreach history and names every judgement it had to make
- **The Upstream database** — the platform's own researched company data, searched against a live engagement so an analyst finds new companies here rather than in a browser, with a fit score, a coverage rail stating what the data does *not* know, and a one-click Push that readies the cadence. Described by the owner as the core of the product. Today: a 164-company verified starter set copied into each firm — the ingest, dedup and enrichment machinery is built; a shared tier and any record of provenance are not
- The Outreach desk — a self-maintaining daily queue ordered by lateness, with keyboard control and Focus mode
- The Master List in three lenses: My book · Pipeline board · Firm database
- The firm rolodex, built around "Relationship facts"
- Analytics that open on a finding, with thin data quarantined
- Sending from the analyst's own mailbox, one message at a time

**CURRENT BRAND**
"Upstream" is user-facing everywhere but is not settled: the repository calls it a project, the demo tenant shares the name inside the screenshots used to sell it, the landing page has been rebuilt three times in six weeks to justify it, and **two marks exist** — an amber "channel-U" arrow in the product and a teal "Y" confluence on the reference landing page. No logo file set, no guidelines. **NO FINAL LOGO FOUND.**

**CURRENT VISUAL STYLE**
The product app: dark-first OKLCH "Obsidian Amber" with one warm accent, a display serif (Cormorant) for titles and figures, Outfit for text, JetBrains Mono for every computed number, dense registers, a 240px sidebar, 18 named animations on one easing curve, and a complete light theme. Coherent and considered — it is the design system that exists. The reference landing page has its own separate language (mist and deep teal, a variable grotesk, scroll-scrubbed river photography) and should be read as prior art.

**LANDING PAGE SHOULD COMMUNICATE**
That the analyst's scattered day becomes one place — the three spreadsheets and the browser full of research tabs replaced by a single surface that works the way they already work. Then: that it works *alongside* them and never acts for them. Then: that the firm's existing workbooks come in whole, with their history, in days rather than a quarter. Then: that finding *new* companies stops being a browser exercise. And underneath: the firm's memory builds itself, so prior work surfaces before the next email without anyone maintaining a record. Show the scattered day becoming one place, show the import, show the "2 prior" chip, show the queue. Do not lead with AI, do not claim automation the product deliberately refuses to perform, do not imply a database larger than the one that ships, and do not promise proactive alerting or live team collaboration until both exist.

**BIGGEST BRAND/DESIGN OPPORTUNITY**
**To make the working relationship the brand.** Nearly every product in this category sells doing-it-for-you; this one is built, consistently and provably, on the opposite promise — it parses your spreadsheet and then asks, warns without blocking, drafts but makes you send, and refuses to set a status because you dragged something. That stance has no expression in the current identity at all. Alongside it: the product's most valuable behaviour is its quietest — warm history, "Worked by", the "Deals" count and the duplicate warning are the reason this is not a to-do list, and all four render as small grey elements. A brand that says *this works with you, and it remembers for you* — and a page that shows a scattered day becoming one place rather than listing features — would be arguing from the product's real strength for the first time.

**BIGGEST UNKNOWN**
How the Upstream database becomes real. It is described as the core of the product, and today it is a 164-company starter set copied into each firm with no shared tier, no provenance separating it from a firm's own data, and no refresh path — while how it reaches scale is unanswered and is a business question. Two further unknowns sit beside it: a firm cannot add a second user, and the product cannot notify anyone of anything, so the collaborative, nothing-slips story is an architecture rather than an experience.

---

## 21. CURRENT UX / DESIGN AUDIT

### What works well

- **The dashboard's opening line is the best UX decision in the product.** (FACT) One number, one sentence, one button. It answers "what should I do now" before any navigation.
- **Analytics opens on a finding, not a grid.** (FACT) Charts follow the sentence rather than replacing it. Rare, and right.
- **Low-n data is quarantined.** (FACT) *"THIN DATA · N<5"* — a product that knows when its own numbers are meaningless earns trust.
- **The Outreach desk's information design.** (FACT) Days-late as the leftmost figure, one promoted NOW row, a week horizon, a time estimate, keyboard control, Focus mode. It reads like an instrument.
- **Numbers are monospaced and tabular everywhere.** (FACT) The single detail that makes the app feel like financial software rather than a SaaS template.
- **The design-token discipline.** (FACT) `lib/design.ts` documents, with reasons, why one role had drifted into 26 spellings, and fixes each centrally. Contrast values carry their measured ratios in comments.
- **Empty states are written, not generic.** (FACT) They teach the model while the screen is empty.
- **The importer's review step.** (FACT) Counters, a per-sheet table, and *"{n} rows need a second look"* in plain English. The most trust-building screen in the product and the least visually invested.

### What feels confusing

- **Two names for the same screen** — Schedule / Outreach desk, Sourcing / Discover. (FACT)
- **Four overlapping words for the deal hierarchy** — project, engagement, mandate, deal — and "engagement" additionally names a contact-level field with different values. (FACT)
- **`/companies` vs `/master`.** Two company lists, one orphaned. (FACT)
- **"Warm" and "cold" are not opposites.** (FACT)
- **The landing CTA promises "See it running" and delivers "not open yet."** (FACT) The clearest expectation break in the experience.

### What feels generic

**Almost nothing in the app, which is notable.** The exceptions: the login card's glassmorphism over a dotted grid, the amber button hover shimmer, and the `hover-lift` card treatment — which the reference page's own CSS identifies as "the tell" and refuses to use. (STRONG INFERENCE: the app kept a pattern the newer thinking rejected.) The 404 and error pages are conventional — not wrong, just anonymous.

### What feels distinctive

- The **display serif for titles and figures inside a dense financial tool.** (FACT)
- The **coverage-cell strip** on My book — one small square per company, coloured by state, each a link. The most distinctive piece of visual design in the app. (FACT)
- The **sides-spectrum bar** on the projects list — a project's shape legible before a click. (FACT)
- The **pressure gauge**, **Focus mode**, and the **`row-clear` animation** — a green flash and collapse that makes the core act feel like progress. (FACT)

### Where visual hierarchy is weak

- **The dashboard's red gauge competes with the red headline number.** Two loud red elements meaning the same thing. (FACT)
- **The Master List toolbar is a row of same-weight controls** with little hierarchy between them. (FACT)
- **Discover's facet rail competes with its own results.** Eight stacked facet groups against a list where every row's primary action is identical. (FACT)
- **The relationship signals are the smallest elements on screen.** The prior-work chip is 10px grey; "Worked by" is initials with names in a tooltip. On the screens whose job is *who knows whom*, the "who" is the least legible thing. (FACT)

### Where UX has friction, and where users may hesitate

- **A brand-new firm has no first-run guidance.** The dashboard renders near-empty and the path to value is a nav item among nine. (FACT)
- **A firm cannot add a colleague.** A partner who wants their analyst in the product has no route through the interface. (FACT)
- **The log-outreach date field is a raw native date input**, OS-formatted, in a product where every other date is deliberately typeset. (FACT)
- **"Reset workspace" sits on the same page as ordinary settings.** (FACT — name-confirmation mitigates it.)
- **The duplicate warning names a deal by number.** A user cannot act on "mandate 12". (FACT)
- **Sending is the headline promise but reads "Not configured on this install."** (FACT)
- **The company record does not lead with cross-deal history**, on the screen where that fact matters most. (FACT)
- **Warm history cannot be searched or reported on.** Discover can filter by "Worked before", but there is no "everyone we know at this company", no "relationships that have gone quiet across the firm", and nothing relationship-shaped in Analytics. (FACT)

### Strongest and weakest screens

**Strongest:** Outreach desk (the most thought-through surface) · Analytics (finding-first) · Master List, Firm database lens (the differentiator as a table) · Dashboard (instant orientation).

**Weakest:** `/companies` (orphaned duplicate) · Company record (beautifully typeset panels beside shouting raw enums and lorem-ipsum notes, under-serving the cross-deal story) · Settings (a long single column with no sub-navigation, including a read-only Team panel that implies an ability the product lacks) · Import (correct and clear, but visually the plainest screen in the product, and the most important moment in it).

### Production-ready vs prototype

**Production-ready:** the token system, both themes, tables and dense registers, the queue, analytics, the command palette, the timeline, the board, empty/loading/error states, the mobile shell, the import pipeline's engineering.

**Prototype-level:** the company record's raw values, the native date input, the orphaned route, the duplicate warning's numeric ID, the Discover row clipping, the login tagline, the demo data's lorem-ipsum notes, the read-only Team panel, the coming-soon dead end.

### Patterns to retain

The refusal to act on the analyst's behalf — consistent across the importer, the duplicate check, the board, the compose sheet and the scorer; it is a stance, not a set of behaviours, and it should survive any redesign intact. Then: finding-first page openings; monospaced computed figures; the three-lens toggle; the append-only timeline with cycle bands; keyboard-first queue navigation; the closed categorical hue law; centrally defined roles in `lib/design.ts`; warm history's existence-vs-detail scoping; the importer's plain-English flags; the reference page's claim ledger and copy gate.

### Patterns to reconsider

The display serif *if* the new brand goes elsewhere (used consistently, so a real decision either way); dark-as-default against light screenshots; glassmorphism on login; hover-lift cards; the red pressure gauge as the first impression; nav labels that disagree with page titles; and the visual weight given to relationship signals versus everything around them.

---

## 22. CURRENT BRAND / EMOTIONAL CHARACTER

### How the product app currently feels

**Serious, nocturnal, instrument-like, slightly luxurious, and faintly alarming.** (STRONG INFERENCE, from the rendered UI.)

- The near-black ground with one warm amber accent reads as *after-hours professional* — a cockpit or a trading desk rather than an office tool.
- The display serif on titles and figures adds **editorial gravity**; the single thing that stops it reading as generic dark SaaS.
- Monospaced numerals make it feel **measured and machine-authored**: these figures were computed, not typed.
- The density signals **competence and expectation** — it assumes you know your job.
- But the first screen is a **red alarm**, so the dominant first emotion is *being behind*, not *being in control*.
- The login screen reads slightly more **startup-consumer** than the rest of the app.
- **It behaves like a colleague rather than an authority.** It advises without blocking, asks rather than assumes, drafts without sending, and says what it could not work out. Nothing in the visual identity carries this, but it is the strongest and most consistent thing about how the product *behaves*, and a user would feel it within a day.

### How the reference landing page feels

**Calm, cold, literary, patient, quietly confident.** Pale mist over cold water; a teal that never shouts; exactly one warm mark, always meaning "late." The writing is dry, concrete and a little rueful — *"Nobody did anything wrong. The client still remembers it."* It reads like someone who has done the job. It is unusually unhurried, and it refuses the standard moves: no logos, no testimonials, no metrics, no gradient blobs, no "trusted by." Net: **trustworthy, adult, editorial, slightly austere** — more a considered essay than a SaaS page.

**The gap worth noting:** the page says *calm, patient, in control*; the app says *dark, urgent, behind*. A visitor moves from cold daylight water into a black room with a red gauge. (FACT that they are visually opposite; STRONG INFERENCE that the discontinuity is unintended.)

### Which perceptions come directly from implementation

- Analytical, precise, instrumented → mono figures, computed fields, no manual entry.
- Trustworthy with secrets → the security claims are literally true of the code: httpOnly cookies, rotating revocable refresh tokens, query-level firm scoping, no hard deletes, hashes never returned, and a hard-failing allow-list on anything sent to a third-party model.
- Serious, not playful → no illustration, no mascot, no emoji, no exclamation marks anywhere.
- Honest → demo data labelled, the FAQ saying "we are the wrong tool today", the importer saying what it could not read.

### Uncertain, or probably artifacts

**Uncertain:** whether the premium note (serif + amber + glass) is chosen positioning or inherited aesthetic; whether dark-first was a stance or the default of its era; whether the river metaphor is a direction or a rationalisation of the name.

**Probably artifacts:** the red-alarm first impression; the login tagline's corporate register beside the landing's plain speech; the glassmorphism; the button shimmer.

---

## 23. NAMING / BRAND-NAME CLUES

**No names are proposed here.** This is the raw conceptual material.

### Directly supported concepts — present repeatedly, in user-visible form

| Concept | Where it lives |
|---|---|
| **Working alongside** | The importer that parses then asks; the duplicate check that warns and never blocks; the board that will not write a status from a gesture; *"You edit, you send"*; *"one message at a time, when you press send"* |
| **One place, gathered** | Four files and a browser becoming a single surface |
| **The firm as the unit of memory** | *"The firm is the unit, not the mandate."* One deduplicated record per company; contacts firm-scoped |
| **Knowing already / warmth** | *"June opens already knowing"*; the **"2 prior"** chip; **Warm history**; *"the relationship outlives the analyst"* |
| **Worked by / worked before** | The analyst-initials column; the *"Worked before"* filter; *"Most worked"* |
| **The record / the log** | Append-only, never overwritten; *"still says what actually happened three years later"* |
| **The relationship, named as such** | *"Relationship facts"*; *"one relationship, told properly"*; *"gone quiet"* |
| **The database / where you look first** | *"Company database"*, *"standing research"*, *"searchable before a deal exists"*; *"Discovery starts by seeing what the firm already owns, not by typing into a blank box"* |
| **Checked / verified / not invented** | Real organisations with cited sources; revenue and headcount left blank rather than guessed; a coverage rail reporting what is missing |
| **Derivation from one act** | *"Log the email. The rest is derived."* |
| **The clock / the anchor** | An immutable date everything is measured from; *"the anchor never moves"* |
| **The queue** | *"sorted by how late it is"* |
| **Lateness / going quiet** | The one warm colour on the landing page means only this |
| **The book** | *"my book"*, *"your book"*, *"the imported book"* — a working possession |
| **The desk** | *"Outreach desk"*, *"someone who has sat on the desk"* |
| **Push** | Promoting a researched company into a live deal |
| **Flow / current / upstream** | Deal flow, the pipeline, the source — the industry's own vocabulary |

### Strong conceptual associations

- **Working alongside, not instead of** — the most consistent behavioural signature in the build, entirely unexpressed in the current identity, and the least crowded ground the product owns.
- **One place, gathered** — consolidation rather than addition; the analyst puts things down rather than picking a new tool up.
- **Continuity across time and people** — the relationship outlives the deal, the analyst and the spreadsheet.
- **Memory that speaks before you act** — the product's rarest and most specific moment.
- **A record that cannot be tidied** — immutability as trustworthiness.
- **Time that does not slip** — the fixed anchor.
- **A source you can name** — the platform intends to own a company database analysts search instead of searching the web. "Where the names come from" becomes a brand idea, not a feature.
- **Vouched-for knowledge** — data with a source behind it, blanks left visible where there is none.
- **The instrument** — mono figures, computed fields, density, a queue that reads like a readout.

### Weak or uncertain associations

- **Water, current, upstream, confluence.** Richly executed on the reference page, but it postdates the name and exists partly to justify it — and it describes the sourcing half rather than the differentiated half.
- **Institutional / institutionalized** — one leftover tagline the product's own rules would reject.
- **Intelligence / insight** — that same tagline, plus peripheral AI features.
- **Speed.** The product is unhurried by design; nothing argues for velocity.

### The user's transformation

**Before:** a working day spread across three spreadsheets and a browser full of research tabs, held together by one person's memory and diligence.
**After:** the same day, in one place, where the only thing typed is the fact that an email was sent — and the schedule, the ordered queue, the firm's memory and the report all come out of that.
**The stance running through it:** the software works next to the analyst. It asks, warns, drafts and computes; it never sends, decides or overwrites for them.

### Words that appear repeatedly and carry weight

`worked` · `prior` · `warm` · `knows` · `already knowing` · `record` · `appended` · `book` · `desk` · `register` · `firm` · `relationship` · `derived` · `logged` · `anchor` · `cadence` · `overdue` · `late` · `gone quiet` · `queue` · `engagement` · `touch` · `push` · `outreach` · `origination`

### Words that should probably NOT be used

- **CRM** — the product's own copy uses it only to describe the thing that failed. The right *category* word for a buyer, the wrong *brand* word for this product.
- **Pipeline, flow, funnel, source** as a *name* — saturated, and the copy itself observes the industry "stopped hearing" these words.
- **Platform, suite, intelligence, insights, hub, ops, AI-anything** — the house style bans this register, and the one surviving example is the weakest line in the product.
- **Anything implying execution, diligence or bid management** — explicitly out of scope.
- **Automation, autopilot** — the product derives rather than automates, and deliberately refuses to guess.

### On "Upstream" specifically

**Supported:** user-facing everywhere; industry-native; the newest landing page makes it earn its place credibly — *"flow only moves one way, and a desk that does not channel it loses it."*

**Against:** (a) the repository treats it as a project name; (b) it collides with the demo tenant inside the very screenshots used to sell it; (c) "upstream" carries a strong unrelated meaning in software that a technical or investor audience reads first; (d) **it names the sourcing half, while the differentiated half is the working relationship and the record** — the name points at the part a competitor could most easily copy; (e) it required a full page rebuild to justify, and the page before it argued the opposite metaphor.

**Verdict:** a **working name with real equity in the current copy and none in the market.** Do not assume it is final. Do not assume it must go.

### A second naming requirement

The platform's database is currently called *the Upstream database* — it borrows the product's name. **If the product is renamed, this asset needs a name too**, because analysts will refer to it constantly and separately from the software (*"is it in the database?"*). Expect to name two things: the tool the analyst works in, and the body of company data they search. They can share a name, but that should be a decision rather than an inheritance.

---

## 24. LANDING PAGE EVIDENCE / DEMONSTRATION MATERIAL

### An asymmetry to design around, first

**The most demonstrable moment and the most differentiated moment are not the same.** Clearing a row from the queue films in one second — and it is the least differentiated thing the product does. The firm's memory speaking before an approach is the differentiator — and it needs two deals, two analysts and elapsed time to exist. The demo book has all three; a prospect's trial would not. Any landing narrative has to solve this; the reference page solves it only in one text fold.

### Best screens to showcase

1. **The Outreach desk.** It communicates the product faster than any other frame: a column of red day-counts, company names, contact names, one action per row. A viewer who has ever chased a follow-up understands it without a caption, and it is the only screen where the value — "this is maintained for me" — is visible in the picture itself.
2. **The Master List.** The differentiator, structurally: one row per company carrying multiple deal chips, a "Worked by" stack and a "Deals" count. Otherwise abstract; here it is a column.
3. **Analytics.** Best for the partner audience, and "the screen opens on what is wrong" is visually distinctive.

*These three are already the shipped choice, already captured in light mode against the demo book, already annotated. That decision is sound and the assets are reusable.*

### Best flows to demonstrate

1. **The derivation, in three frames.** `AWAITING FIRST EMAIL` → the log action → the same company carrying an anchor date, three future follow-up dates, a queue position and an appended timeline line. The product's whole argument in one sequence, and the one the reference page already simulates with its press-and-hold interaction.
2. **"The firm already knows them," in three frames.** Discover mid-search → a candidate row carrying **"2 prior"** → the expanded warm-history block. **The highest-value untold story in the product; it has never been shown as screens.**
3. **"Your book, already running," in three frames.** The import drop zone → the review screen with its counters and *"{n} rows need a second look"* → *"{Project} is live · 75 companies · 130 contacts · 402 outreach events."* It compresses the switching-cost objection into one strip, and the middle frame is what makes it believable, because it shows the product admitting what it could not read.
4. **Sourcing becomes outreach, in two frames.** Push → the dialog's warm history → *"Log the initial email to start the cadence clock?"*
5. **Queue → empty queue.** Before and after of a day cleared. The animation already exists.

### Most impressive output, and most understandable interaction

**Most impressive:** the Outreach desk queue with its day-horizon strip and promoted NOW row. Runners-up: the **Pipeline board**, whose column subtitles state the rule ("Cadence stopped — they answered"), and the **coverage-cell strip**, where a project's entire book is one countable row of coloured squares.

**Most understandable:** logging a follow-up and watching the row clear. One click, a visible consequence, under a second.

### Screens that should NOT be showcased

The company record (raw enums, lorem-ipsum notes) · the empty new-firm dashboard · Settings (including a Team panel implying an ability the product lacks) · the login screen · `/companies` · any dark-theme capture, unless the whole brand moves dark.

### Animation opportunities — all already implemented, so all capturable

`row-clear` · Focus mode dimming the interface to one card · the horizon strip recounting as rows clear · funnel meters growing · the counter's `count-pop` · coverage cells and sides-spectrum bars drawing in on load.

### Above the fold

A live or near-live **queue panel** — what the current hero already resolves into — because it shows an ordered list of real-looking work with computed lateness and needs no explanation. Keep the **DEMO BOOK** label; it is the honest move and costs nothing. **The strongest variant would be that same panel with one row carrying a "2 prior" chip**, so the differentiator is present in the first frame rather than four folds later.

---

## 25. DESIGN DECISION SIGNALS

### Strong signals — clearly demonstrated; let them shape the design

1. **The software works alongside the analyst and never acts for them.** Six independent surfaces, one stance (§1B). **The first thing a design should express, and nothing in the current identity expresses it.**
2. **The product replaces a scattered way of working with one place.** The navigation is effectively a list of the things the analyst no longer leaves the tool to do.
3. **The firm's record accrues as a by-product, and is the unit of memory.** Enforced in the schema, the services, the UI, and in rules the project refuses to break. Nobody maintains it; working here produces it.
4. **The mechanism is derivation from a single act.** The answer to "who maintains this?"
5. **The project is the context container.** Client → engagement → companies → people → touches.
6. **Two front doors, one funnel: import and source.** They converge on the same object. An IA treating import as a setup wizard rather than a standing surface contradicts the code, which says so in a comment.
7. **The product intends to own a company database, and that database is a second thing being sold.** It compounds independently of any one customer. The sourcing surface is aimed at *research*, not at a rival CRM, and the competitor is a browser tab.
8. **Trust, not volume, is what that database wins on.** Verified organisations with cited sources, blanks left visible, a coverage rail reporting gaps, a dedup rule that never relabels. **Make "this was checked" the loudest thing about it.**
9. **"New to you" is the missing state.** If the platform database and the firm's own book are to feel like two things, the interface must say which is which — and the schema cannot yet tell them apart (§4.7).
10. **Computed numbers are the product's substance.** Numerals deserve first-class treatment in any new identity.
11. **Density is a requirement.** Whitespace-forward design would degrade the primary screens.
12. **Colour already carries meaning, consistently.** Preserve the *law* even if the hues change.
13. **The writing voice is the strongest brand asset that exists** — plain, concrete, dry, with a documented style guide and an enforced anti-cliché list. Do not replace it; extend it.
14. **Honesty is already a design principle**, and an unusual one: demo data labelled, thin data quarantined, an FAQ that tells the wrong customer to leave, a duplicate check that advises, an importer that names every judgement.
15. **The three-screens framing is true.** The product genuinely is small, and its smallness is a selling point.
16. **Accessibility work has been done and recorded.** Losing it would be a regression.
17. **The mechanism can be shown, not claimed.** The press-and-hold interaction already proves the concept teaches better than it explains. The same is true of warm history.

### Potential signals — validate before building on them

- **The display serif in a financial tool.** Distinctive and consistently applied; whether it is *right* is a fresh decision.
- **The river / current metaphor.** Well-executed and industry-native, but built to justify a name that may not survive, and it describes sourcing rather than memory.
- **Dark-first.** Defensible for after-hours desk work; contradicted by the light screenshots the product sells itself with.
- **"The desk" as the central noun.** Runs through the copy naturally; warmer and more specific than "platform".
- **The dashboard as the front door.** Equally consistent with build order and with a deliberate "attention first" opinion. **Do not assume it is a mistake, and do not assume it is a decision.**
- **The role-dependent default lens** (analyst → My book, partner → Firm database). A quiet statement of the two jobs the product serves; worth making explicit rather than accidental.
- **India as home market.** Deeply present in the build, absent from the positioning.
- **The AI capabilities.** Real, cached and evaluated, but peripheral and in tension with the "no second job" argument.
- **The coverage-cell strip and the sides-spectrum bar.** Distinctive devices, both capped or scaled, so their expressiveness is bounded.

### False signals / likely MVP artifacts — should NOT shape the brand

- **The amber-on-obsidian palette** — an aesthetic from the app's first phase, never revisited.
- **Both current marks** — hand-drawn inline SVG, neither documented, neither final.
- **"Deal intelligence, institutionalized."** — a leftover that violates the product's own copy rules.
- **"Upstream Capital Advisors"** — a seed value, currently visible in the screenshots used to sell the product.
- **The red "HEAVY PRESSURE" gauge as the product's face** — a state, not an identity.
- **"Project Upstream"** — a repository name.
- **The `/coming-soon` dead end** — an infrastructure limitation of a static export, not a go-to-market decision.
- **The read-only Team panel** — it implies a capability the product does not have.
- **The ~30 stale screenshots in `frontend/screenshots/`** — they predate several redesigns.
- **`sq/`, `sq.zip`, `theme fixer/`, the Next.js starter SVGs** — not part of the product.

---

## 26. EVIDENCE MAP

**The product works alongside the analyst and never acts on their behalf.**
Six independent surfaces: `frontend/app/(app)/import/page.tsx` — *"this is your call — not a guess."* · `backend/app/services/cross_mandate.py` — *"Advisory only — never blocks company creation"*, on screen as *"these matches may or may not be the same entity."* · `frontend/components/features/pipeline-board.tsx` — *"a column is never written directly."* · `frontend/components/features/compose-email-sheet.tsx` — *"You edit, you send"* and *"read it as the recipient before you send."* · `marketing/content/site.ts` — *"one message at a time, when you press send. No relay… no bulk send."* · the analytics thin-data quarantine and the importer's fourteen named flags, both surfacing uncertainty rather than resolving it silently.

**It replaces a workflow spread across several spreadsheets and a browser.**
`README.md` / `CLAUDE.md` / `plan.md` name the three source spreadsheets, and the real workbooks are in `phase_2/*.xlsx` · the information architecture is those three surfaces plus sourcing and analytics · `backend/app/services/workbook_import.py` exists to take those workbooks whole, with history · `backend/app/services/pool.py` — *"searching before a deal exists is the whole point of the screen"* — is the in-product answer to research done in a browser · `frontend/components/layout/nav.ts` groups the result as Pipeline → Outreach → Insights.

**The core interaction is logging one outreach event, from which everything else is computed.**
`backend/app/services/cadence.py` computes `next_due_date = initial_date + (followups_done+1) × interval` and refuses to tick before the first event · `CLAUDE.md` rules 1–4 name this non-negotiable · the log dialog states each type's consequence inline · the desk's "84d" is never entered by anyone · the declared critical-path e2e test is `create → needs-initial → log initial → due → respond → stopped`.

**The differentiator is a firm-wide, cross-deal record — structurally real for companies.**
`company_profiles` is a firm-level entity separate from per-deal `companies` · `backend/app/api/company_profiles.py` describes itself as *"the shared, deduped company record enriched by every analyst"* and supports `min_engagements`, `sort=engagements`, `group_by=analyst` · `backend/app/services/sourcing.py` → `build_warm_history` scopes existence firm-wide and detail to visible deals · `backend/app/services/cross_mandate.py` → *"Advisory only — never blocks"* · **verified by query: 136 placements resolve to 118 profiles; Tata Power Company sits on 2 deals, Cipla Ltd on 3.**

**People are NOT deduplicated across deals.**
`backend/app/models/contact.py` — `company_id` is a non-nullable FK to `companies`, which is per-deal · `backend/app/api/contacts.py` returns a flat firm-scoped list with no person-level grouping · **verified by query: Cipla Ltd's three placements carry six unrelated contact rows; the rolodex's "136 companies" counts placements, not the 118 distinct companies.**

**A firm cannot add a second user.**
`backend/app/api/users.py` contains only `GET ""` · a full enumeration of every `@router.post` shows the only user-creating route is `POST /auth/signup`, which creates a new firm · Settings renders Team as a read-only roster · assignment exists but only over users that already exist · the demo's users came from `backend/app/seed/`.

**There is no proactive delivery of any kind.**
No cron, scheduler, worker, digest or notification module anywhere in `backend/app/` (verified by sweep) · `email_sender.py` sends only on request.

**The sourcing surface replaces research done outside the product, and most of the machinery to grow a database is built while the database is not.**
`backend/app/services/pool.py` — *"a company database with nothing in it cannot be searched"* · `backend/app/data/company_pool.py` — 164 real organisations, cited public sources, revenue and headcount deliberately absent · `backend/app/services/imports.py` — CSV parse → fuzzy header map → dry-run dedup → idempotent upsert · `backend/app/api/imports.py` — a partner-only bulk load "entering at the pool" · `backend/app/services/profiles.py` → `upsert_profile` blocks on domain then name and *"enriches the gaps, never relabels what a source already asserted"* · `backend/app/services/providers/base.py` — an `EnrichmentProvider` protocol with only a ranking provider and a mock implemented · `ImportSource.PROVIDER` defined and unused.

**The two-tier model — the platform's database alongside the firm's own book — is not representable in the schema.**
`backend/app/models/company_profile.py` carries `firm_id`, the company's facts, research classification and dedup keys, and **no provenance field**; there is no link from a profile to an `ImportBatch`, and `seed_firm_pool` writes planted rows directly without one · `upsert_profile` merges any source into the same row under one dedup rule · consequence: after a firm imports, platform-supplied companies and the firm's own are indistinguishable, so "new to you" cannot be rendered, filtered or counted.

**The database is scoped per firm by explicit decision.**
`backend/app/services/pool.py` — *"Per-firm rather than shared, deliberately… One shared global table would make one firm's edits visible to another; a copy per firm keeps the tenant boundary intact and costs 164 rows."* Seeding is idempotent and tops up, so re-planting a larger dataset is supported; it runs only at signup and via bootstrap, and **nothing updates an existing firm.**

**Sourcing constraints are not stored on the deal.**
`backend/app/services/scoring.py` → `build_thesis()` returns `sector=None, geography=None, size_band=None`, sending only the deal's side.

**The deployment ships empty except a curated company dataset.**
`backend/app/data/company_pool.py` — 164 verified rows, each with a cited public source · `README.md` "The deployment starts empty on purpose" · Settings separates "Company database (a reset keeps every row)" from "Imported book (a reset removes all of them)" · the 118 in the demo comes from the separate Faker seeder.

**"Upstream" is user-facing but not a settled brand.**
The wordmark in the sidebar, login, `<title>`, `applicationName`, the footer, the og card and landing body copy — *versus* "Project Upstream" in README/CLAUDE/PROGRESS and the API title · two incompatible marks · the demo firm named "Upstream Capital Advisors" · three complete landing rebuilds in `PROGRESS.md` · the landing design note: *"the name is the argument."*

**The acquisition funnel is unfinished.**
`CTA_HREF = "/coming-soon"` · that page has no form and says so in its own source comment · `PROGRESS.md` "(pricing deferred)" · no email capture, analytics or CRM integration anywhere in the landing app · **no billing, subscription, plan, seat or metering code exists anywhere in the repository** (verified by sweep).

**The product is built for an Indian market as it stands.**
`backend/app/core/time.py` `today_ist()` and Settings' fixed "Asia/Kolkata (IST)" · the "REV ₹CR" column and four ₹Cr size bands · India-weighted shipped and demo data · `plan.md` "Seed realistic India-market data."

**The copy voice is deliberate and documented.**
The house-style header in `marketing/content/site.ts` — no em dashes, a named AI-vocabulary ban list, no outcome numbers because there are no customers, "write like someone who has sat on the desk" — plus a claim ledger assigning each claim one home, written after an audit found one claim stated five times across twelve sections.

**Several surfaces are unfinished in ways a designer will see immediately.**
Observed running: `TARGET / REFERRAL / MEDIUM` rendered raw on the company record · "mandate 12" in the duplicate warning · a native OS date input in the log dialog · `UNSCORED` clipped at the row edge in Discover at 1440px · Faker lorem-ipsum in notes · `/companies` reachable but unlinked · a read-only Team panel · no favicon on the reference landing page · Next.js starter SVGs still in `frontend/public`.

---

*End of document.*
