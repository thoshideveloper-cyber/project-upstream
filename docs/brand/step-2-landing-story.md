# STEP 2 — LANDING PAGE STORY, CONTENT & INFORMATION ARCHITECTURE

**Product code-named "Upstream" · the content blueprint handed to the visual design stage**

Sources, in order of authority: `DESIGN_CONTEXT.md` (product reality, reconstructed from the running build) → `step-1-strategy.md` (Stage 1 strategic hypothesis) → this document. Where the two sources conflict, the conflict is named rather than smoothed.

Evidence labels used throughout: **FACT** · **RESEARCHED FACT** · **STRONG INFERENCE** · **WEAK INFERENCE** · **STRATEGIC RECOMMENDATION**.

---

## 0. FOUR DECISIONS TAKEN BEFORE WRITING

Stage 1 closed as READY WITH CAVEATS and listed five business decisions that had to be settled before a page could honestly be written. Four were put to the owner and answered. They are recorded here because every section below depends on them.

| # | Decision | Answer given | Consequence for this page |
|---|---|---|---|
| 1 | Access model and CTA destination | **Request access (waitlist capture)** | The page ends in a form, not a signup. Commitment level is low, which matches a chronic rather than acute problem. Requires a form endpoint; the current static export cannot accept one (§10.4). |
| 2 | Can the page promise a firm-wide record? | **Yes. Firms are provisioned by hand (closed beta)** | The firm-scale claim becomes honest, because the vendor creates the users. This unblocks the single most differentiated claim in the product and resolves Stage 1's "largest single fork" in the direction that makes the strongest page. |
| 3 | Pricing | **No price yet, omit entirely** | No pricing section. "What does it cost" is handled as an objection inside the limits fold. |
| 4 | Credibility substitute for absent customer proof | **The product admitting what it does not know** | This becomes the page's spine, not a housekeeping detail. See §6 for how it is read, and one narrowing note. |

**A note on decision 4.** Only one option was selected. Read strictly, that would remove the product screenshots as well, which would make the page unbuildable, since the mechanism has to be shown rather than asserted. The reading applied here: **honesty is the credibility *architecture*; the running product is the *demonstration vehicle* underneath it.** These are not in tension, because the screenshots are labelled DEMO BOOK, and that label is itself an instance of the chosen proof basis. The hand-checked database and the engineering posture are demoted to a single line each inside the limits fold rather than given folds of their own. Flagged rather than assumed.

**Decision 2 has a second-order effect worth stating.** Hand-provisioning makes "request access" the *only* coherent CTA, and it makes the closing copy honest in a way self-serve signup would not have been: the page can say we will set the workspace up with your people in it, which is true, and which quietly delivers the multi-user promise the product cannot deliver by itself.

---

# PART A — CRITICAL REASSESSMENT OF STAGE 1

Stage 1 is the current hypothesis. `DESIGN_CONTEXT.md` is the source of truth. Six findings.

## A1. What Stage 1 got exactly right

1. **The causal chain is the position.** *No second job → a complete record → a trustworthy record → knowledge that compounds.* **STRONG INFERENCE, and I agree without reservation.** It is the only formulation that explains the queue, the import, the analytics and the append-only log at once, and it is the only one a competitor cannot retrofit.
2. **The reader is post-solution and sceptical, not unaware.** **FACT-backed** by the product's own research note (*"we bought one and nobody updated it"*) and by the FAQ leading with that exact objection. This single insight dictates page order: the objection must be answered before the product is presented, not after.
3. **The problem is chronic, not acute; aim for recognition, not alarm.** **STRONG INFERENCE, and the most useful constraint in Stage 1.** Desks run on these spreadsheets successfully today, and the product's own FAQ concedes it. A page built on fear overclaims against a problem the reader has already normalised.
4. **Import removes the latency from the differentiator.** **The highest-leverage insight in Stage 1.** The record's value takes months to appear in a fresh account, but a firm's own workbooks arrive with history reconstructed, so the record starts full. This deserves a promoted fold and gets one.
5. **The outbound-sequencer misread is under-appreciated in the source.** **STRONG INFERENCE, and correct.** Cadences, intervals, templates, logged sends and a compose sheet are the exact vocabulary of bulk sales tooling. That read is fatal for a desk that points this at a CFO. It has to be closed early.
6. **Honesty is a differentiator, not housekeeping.** **FACT** across six surfaces. Now the page's credibility spine by decision.

## A2. Where Stage 1 over-interprets, and what changes

### Conflict 1 — the two source documents disagree about what the page should lead with, and neither names it

**This is the most important finding in Part A.**

- `DESIGN_CONTEXT.md` §12 states the claim the page should rest on is **"Your work stops being scattered"**, with the firm's memory placed third, and explicitly warns that *"leading with the record alone risks a database reading."*
- Stage 1 elevates **"making the record a consequence of the work"** to the central idea and recommends the page be built around the inversion.

Both are right about different things, and the disagreement is a sequencing problem masquerading as a positioning problem.

**Resolution adopted here. STRATEGIC RECOMMENDATION.** The scattered day is the **entry point** because it is what the analyst recognises. The record is the **destination** because it is what the firm buys. The page is the journey between them, and the mechanism is the bridge. Neither source states this synthesis; it is the spine of §B below.

Practical consequence: the hero does *not* open on the record, and the page does *not* end on the queue.

### Conflict 2 — the fixed anchor cannot carry a hero, and Stage 1 half-concedes this

Stage 1 names the fixed anchor as **the unique mechanism** (FACT, and it is), then in Part 13 concedes: *"the mechanism requires one sentence of setup before the payoff lands. 'The anchor never moves' is meaningless until the reader knows what an anchor is."*

**STRATEGIC RECOMMENDATION.** The anchor is a **proof, not a hook**. It belongs in the mechanism fold, where there is room for the setup sentence and where it does its real job: explaining *why the date can be trusted*. The hook is the asymmetry the anchor produces, which needs no setup: one act in, everything out.

### Conflict 3 — "it does everything except decide" is buried in Stage 1's brand section

Stage 1 calls this *"the biggest opportunity"* and *"open positioning ground, unoccupied by any named competitor"*, then leaves it inside Part 9 (brand opportunity) and never makes it a page beat.

**STRATEGIC RECOMMENDATION: promote it to its own fold.** It does three jobs simultaneously, which no other beat does:
- it is the **differentiation** against every competitor selling automation;
- it is the **objection handler** for "will this do something on my behalf";
- it is the **only** thing that kills the sequencer misread Stage 1 correctly flags as fatal.

**FACT** supports it across six independent surfaces (`DESIGN_CONTEXT` §26 evidence map). A claim with six citations in the build deserves better than a paragraph in a brand appendix.

### Conflict 4 — the sourcing half is written out of the page entirely, and should not be

Stage 1 recommends holding provenance and the database *"for a second act."* `DESIGN_CONTEXT` §12 ranks *"stop leaving the tool to find new companies"* fourth by centrality and notes the current page **does not mention it at all**.

**Assessment.** Stage 1 is right that the database cannot carry a *claim* today: 164 rows, no shared tier, no provenance, no refresh (**FACT**, §4.7). But omitting the moment entirely leaves the product looking like a follow-up tracker, and *"the client's list ran out"* is a real, recognisable moment in the analyst's week.

**STRATEGIC RECOMMENDATION: present the moment, not the asset.** One paragraph inside the recognition fold ("and when the list runs out, a browser"), and one honest line in the limits fold ("it ships as a starter set of organisations someone checked by hand; it is not a data provider"). No fold, no size claim, no reach claim. This is a narrower treatment than `DESIGN_CONTEXT` asks for and a wider one than Stage 1 allows.

### Conflict 5 — Stage 1 says "no urgency to exploit" but leaves the CTA unmotivated

Correct that there is no urgency (**STRONG INFERENCE**, and it is a real constraint). But a page with no reason to act now converts at zero.

**STRATEGIC RECOMMENDATION.** With decision 1 and 2 taken, the honest motivator is **scarcity of access, not scarcity of time**. *"Access is opening to a small number of desks"* is already true in the product's own copy, is not fear-based, and does not require inventing a deadline. That is the only pressure the page applies.

## A3. What both documents miss

**A page whose credibility spine is "we tell you what we do not know" cannot be anonymous.**

**FACT** (§19.13, §19.14): there is no team page, no about, no founder story, no company entity and no jurisdiction anywhere in the repository. The footer says only *"© 2026 Upstream."*

The reader is being asked to hand over their buyer list, which the product's own copy correctly calls *"the most confidential document a desk owns"* (**FACT**, verbatim). A page that makes candour its proof, from an entity that will not say who it is, contains a contradiction the reader will feel even if they do not articulate it.

**This is the single largest unresolved issue blocking the page**, and it is not a design decision. See §J.

## A4. Answers to the interrogation in the brief's §5

| Question | Answer |
|---|---|
| **Unquestionably true** | One input derives everything, server-side. The anchor is immutable. The log is append-only. Companies are deduplicated firm-wide with placements. Prior work surfaces before the next approach. Workbooks import whole with history reconstructed. The software refuses to act, across six surfaces. Scope stops at outreach. All value is pull; nothing notifies. |
| **Strategically inferred** | That the analyst is the adopter and the partner the buyer. That the problem is scattering rather than loss. That trust beats volume for the database. That the reader is post-solution. |
| **Still uncertain** | Whether anyone has ever used it. Geography as positioning. Whether M&A is the market or a beachhead. Whether dark-first is a decision. |
| **Most important capability to communicate** | The derivation from a single act, because it is the only thing that makes every other claim true. |
| **The realisation that makes it valuable** | That the record they never managed to keep is not a discipline problem. It was an architecture problem, and this architecture removes it. |
| **Biggest risk of misunderstanding** | Being read as an outbound sequencer. Second: being read as another CRM to maintain. |
| **What makes someone understand immediately** | The queue, with computed lateness, in the first frame. Anyone who has chased a follow-up reads it without a caption. |

---

# PART B — CONVERSION GOAL, STORY AND CENTRAL IDEA

## B1. Primary conversion goal

**Request access.** One action. No competing primary.

| | |
|---|---|
| **Visitor starting state** | An analyst or partner at a boutique or mid-market M&A desk, running two to four engagements across a master list, an email schedule, a contact list and a browser. The system works. They are not in crisis. They have either tried a CRM that died or watched one die, and they are primed to pattern-match anything new into that category and dismiss it in four seconds. |
| **Visitor ending state** | *"That thing keeps itself, and it starts from the sheets I already have. I want to see it against my own workbook."* They believe the mechanism because they performed it, not because it was claimed. They no longer suspect it will email anyone on their behalf. |
| **Conversion moment** | Not the mechanism fold. It is the **import fold**: the point at which the reader understands that finding out costs a workbook and a week rather than a quarter and a configuration project, and that their record arrives already full. Everything before it earns the right to be believed; everything after it removes reasons to hesitate. |
| **Commitment level** | Deliberately low, because the problem is chronic. A form with four fields and one human reply. |

## B2. The central idea

> **The visitor should leave thinking: "that one keeps itself."**

| | |
|---|---|
| **Core product insight** | Recording was designed as a separate act from doing, which is why every previous attempt decayed. Collapse the two and the record becomes complete by construction. |
| **Core user insight** | The analyst is not trying to maintain a record. They are trying to do the work. Every maintenance step a tool asks for is one they will skip, and they know it about themselves. |
| **Core transformation** | From being the integration layer between four artifacts, to working in one place where the consequences work themselves out. |
| **Core emotional shift** | From low-grade vigilance to composure. Not relief-from-rescue. The confidence of a number that was computed rather than remembered. |
| **Core reason to believe** | It is demonstrated rather than claimed, and it tells you what it could not work out. |

## B3. The narrative structure

Not problem → solution. Not old way → new way. The structure the product demands, given a reader who has already rejected the obvious answer:

> **Recognition → the fix you already tried, and why it died → the inversion, performed → what it refuses to do → what that leaves behind → the way in → the limits → the ask**

Three things make this structure unusual, and each is deliberate:

1. **The killer objection is answered third, before the product is presented.** A post-solution sceptic will not process a feature until the reason they discarded the last one is addressed. Most pages put this in an FAQ. Here it is the pivot.
2. **The refusal fold sits between the mechanism and the differentiator.** The mechanism fold uses exactly the vocabulary that triggers the sequencer misread: cadence, follow-up, template, send, draft. The misread has to be closed the moment it forms, and before the record fold asks for trust.
3. **The page ends on limits, then the ask.** Stating what the product will not do immediately before requesting access is counterintuitive and correct: it is the chosen credibility mechanism, and it converts the absence of pricing, customers and notifications from gaps into evidence of the same behaviour the page has been describing for eight folds.

---

# PART C — INFORMATION ARCHITECTURE

Nine sections. Every one is justified against a reader question. Sections that appear on most SaaS pages and are absent here are listed in §H with reasons.

---

### 1 · HERO

| | |
|---|---|
| **Position** | Above the fold |
| **Purpose** | Answer what / who / why / next in under ten seconds, and put the differentiator in the first frame |
| **Reader question** | "What is this, and is it for me?" |
| **Core message** | You log the email. The follow-ups, the queue and the firm's record keep themselves. |
| **Supporting message** | Origination and outreach for boutique M&A desks. The only input is one you were already making. |
| **Evidence required** | The Outreach desk queue panel, light mode, labelled DEMO BOOK, with one row carrying a "2 prior" chip |
| **CTA** | Primary: Request access. Secondary: scroll cue into the mechanism. |
| **Why here** | Comprehension has to precede everything. The queue is the only frame where the value is visible in the picture itself (`DESIGN_CONTEXT` §24). The "2 prior" chip is present so the differentiator is in frame one rather than fold six, which is §24's explicit recommendation. |

---

### 2 · THE SHAPE OF THE DAY

| | |
|---|---|
| **Position** | Second |
| **Purpose** | Recognition. Prove we have sat on the desk before we claim anything. |
| **Reader question** | "Do you actually understand how I work?" |
| **Core message** | Three spreadsheets, a browser, and you holding them together. |
| **Supporting message** | And every so often, that costs something. |
| **Evidence required** | Specific texture: the header block above the real column row, the exchange-rate line, the follow-up column nobody sorts. The four losses as a compact strip. |
| **CTA** | None. This beat must not sell. |
| **Why here** | Stage 1: specificity is the credibility mechanism available to a product with no customers. The four losses are the sharpest writing in the project but are pitched at a partner's fear, so they are demoted to a closing strip rather than leading, per `DESIGN_CONTEXT` §2's own note that a page built only on them describes a product that prevents disasters. |

---

### 3 · WHY THE LAST ONE DIED

| | |
|---|---|
| **Position** | Third. The pivot. |
| **Purpose** | Name the objection before the reader does, and reframe it from a discipline failure to an architecture failure |
| **Reader question** | "We bought one of these and nobody updated it. Why is this different?" |
| **Core message** | It died of maintenance. Nobody was undisciplined. |
| **Supporting message** | An incomplete record is worse than none, because it gets consulted and believed. |
| **Evidence required** | None. This beat is argument, and it is the only place on the page where that is correct. |
| **CTA** | None. |
| **Why here** | A post-solution reader cannot evaluate a feature until this is answered. Answering it here converts the rest of the page from a pitch into a demonstration of a claim already made. It also flatters the reader by absolving them, which buys attention cheaply and honestly. |

---

### 4 · ONE ACT IN

| | |
|---|---|
| **Position** | Fourth. The mechanism. |
| **Purpose** | Prove the claim in section 3 by making the reader perform it |
| **Reader question** | "So what do I actually have to do?" |
| **Core message** | One act in, four consequences out, none of them typed. |
| **Supporting message** | The anchor never moves, which is the whole reason the date can be trusted. |
| **Evidence required** | An interaction the visitor performs (press and hold to log), resolving into the four consequences: the clock, the queue, the report, the record |
| **CTA** | None. Interrupting the demonstration with a button wastes it. |
| **Why here** | Directly after the promise it proves. The anchor's setup sentence has room here and would not in a hero. |

---

### 5 · IT DOES EVERYTHING EXCEPT DECIDE

| | |
|---|---|
| **Position** | Fifth. The hinge. |
| **Purpose** | Kill the sequencer read and the AI read at the moment they form; establish the stance |
| **Reader question** | "Hold on. Is this going to email people for me?" |
| **Core message** | Everything it does automatically is derived from something you did. Nothing is done on your behalf. |
| **Supporting message** | One message at a time, from your own mailbox, when you press send. No relay, no bulk send. |
| **Evidence required** | Six behaviours listed plainly, each traceable to a shipped surface |
| **CTA** | None. |
| **Why here** | Section 4 uses the exact vocabulary of outbound automation. The misread forms here or nowhere. Placing this before the record fold also means the differentiator arrives to a reader who now trusts the product's stance. |

---

### 6 · WHAT IT LEAVES BEHIND

| | |
|---|---|
| **Position** | Sixth. The differentiator. |
| **Purpose** | Show the compounding asset the firm actually buys |
| **Reader question** | "What do I get that a tidy spreadsheet would not give me?" |
| **Core message** | May's target is June's buyer, and June opens already knowing. |
| **Supporting message** | Nobody typed the right-hand column. |
| **Evidence required** | One company on two deals, side by side. The "2 prior" chip expanding into warm history. The Master List as an ordinary table carrying deal chips and a "Worked by" stack. |
| **CTA** | None. |
| **Why here** | This is the page's destination, and it can only land after the reader believes the record was kept without effort, which sections 4 and 5 establish. Leading with it would produce the database reading `DESIGN_CONTEXT` §12 warns about. |

---

### 7 · THE WAY IN

| | |
|---|---|
| **Position** | Seventh. The conversion moment. |
| **Purpose** | Demolish the switching cost, remove the latency from the differentiator, and demonstrate the honesty behaviour in one strip |
| **Reader question** | "How long until we are actually running on this, and does it start empty?" |
| **Core message** | Start with the workbook you already keep. |
| **Supporting message** | Your record does not start empty. It starts with what you already did. |
| **Evidence required** | Three frames: the drop zone; the review screen naming what it could not work out; the live project with its counts. The middle frame is the one that matters. |
| **CTA** | Inline secondary, pointing at the closing form |
| **Why here** | It is the last thing standing between belief and action, and it triples: switching cost, latency, and proof of candour. Stage 1 is right that this is the highest-leverage promotion available, and it is currently FAQ answer three. |

---

### 8 · WHAT IT WILL NOT DO

| | |
|---|---|
| **Position** | Eighth |
| **Purpose** | The chosen credibility mechanism, delivered as a section rather than a footnote. Also absorbs scope, pricing, notifications, database size and demo labelling. |
| **Reader question** | "What is the catch, what does it cost, and who are you?" |
| **Core message** | The whole tool is three screens. Here is what it will not do. |
| **Supporting message** | We would rather you found this out here than in month two. |
| **Evidence required** | Six plain statements: scope stops at outreach; no notifications; no bulk send; the database is a starter set; the demo book is demo; there is no price yet |
| **CTA** | None. |
| **Why here** | Immediately before the ask, so candour is the last thing in the reader's mouth. This is where four otherwise-damaging facts become consistent with everything the page has argued. |

---

### 9 · REQUEST ACCESS

| | |
|---|---|
| **Position** | Closing |
| **Purpose** | Convert |
| **Reader question** | "What happens if I do this?" |
| **Core message** | Start with the mandate you are running now. |
| **Supporting message** | Access is opening to a small number of desks. |
| **Evidence required** | Form: Firm, your name, work email, the deal you are running (optional). Risk reversal line. |
| **CTA** | **Request access** |
| **Why here** | The ask arrives after the reader knows the scope, the limits and the cost of finding out. |

---

# PART D — ABOVE THE FOLD

## D1. Recommended hero

**Primary headline**

> ### Log the email. The follow-ups, the queue and the firm's record keep themselves.

**Supporting subheadline**

> Origination and outreach for boutique M&A desks. The only thing you type is the thing you were already doing, so there is no second job called keeping the system up to date.

**Primary CTA:** `Request access`
**Secondary CTA:** `See what one email does ↓` (scroll to section 4, not a destination)

**Microcopy under the CTA:** *Access is opening to a small number of desks.*

## D2. Why this headline

The shipped incumbent is *"Log the email. The rest is derived."* It is genuinely good: concrete, mechanism-first, and it answers the maintenance objection. Its weaknesses are that **"derived" is a technical word that assumes the reader already knows what is being derived**, and that it names no payoff, which leaves the reminder-tool reading open.

The recommendation keeps its spine and its rhythm, replaces the abstraction with the three things a reader actually cares about, and moves the answer to *"who maintains this"* into the headline itself via **"keep themselves."**

## D3. Headline directions considered

| Direction | Line | Verdict |
|---|---|---|
| **Mechanism / inversion** *(recommended)* | "Log the email. The follow-ups, the queue and the firm's record keep themselves." | **Selected.** Concrete, names the payoff, answers the killer objection in the headline. |
| **Contrarian / objection-led** | "The last one died because someone had to keep it." | Strongest differentiation and memorability of any candidate, and the best fit for a post-solution reader. Rejected as a **hero** for two reasons: it assumes the reader had a CRM, and opening on a competitor's failure makes the product sound small. **Retained as section 3's headline**, where it is the right instrument. |
| **Refusal / contrarian** | "It does everything except decide." | The most ownable sentence available and Stage 1's biggest opportunity. Rejected as a hero because a stranger cannot tell what the product is from it. **Retained as section 5's headline.** |
| **Recognition / problem-led** | "Three spreadsheets, a browser, and you holding them together." | Excellent recognition, but it delays *what is this* past ten seconds. **Retained as section 2's headline.** |
| **Record-led** | "A record nobody has to keep." | Names the defensible asset, short, memorable. Rejected: "record" alone reads archival and passive, and Stage 1 flagged exactly this risk in naming Territory 1. Says nothing about the reader's day. |
| **Category-led** | "The origination and outreach system for boutique M&A desks." | True and useful for comprehension. Too inert to be a headline. **Retained inside the subheadline**, where it does its comprehension job without spending the H1. |

**Scored against the brief's eight criteria**, the selected line wins on clarity, product truth and conversion, ties on specificity, and loses on memorability only to the contrarian option, which is unusable in a hero. Three of the rejected directions are not wasted; they become section headlines, which is why the page has a consistent argumentative voice rather than one good line and eight generic ones.

## D4. Hero demonstration

**What it shows:** the Outreach desk queue panel, light theme, against the seeded demo book, labelled **DEMO BOOK**. A column of computed day-counts on the left, company names, contact names, one action per row. **One row carries a "2 prior" chip.**

**Why this and not an interaction.** The press-and-hold demonstration is the strongest single device on the reference page, but it belongs in section 4, not the hero. A hero has one job: comprehension in under ten seconds. An interaction competes with that job, and the four consequences it produces need room the hero does not have.

**Why the chip matters.** `DESIGN_CONTEXT` §24 is explicit: the strongest variant of the hero panel is the one carrying prior-work history, so the differentiator is present in the first frame rather than four folds later. This costs one chip and buys the whole record argument an early foothold.

**Why the DEMO BOOK label stays.** It is honest, it costs nothing, and under decision 4 it is no longer a disclaimer. It is the first instance of the page's credibility mechanism, appearing in the first frame.

---

# PART E — PRODUCT DEMONSTRATION STRATEGY

The product is the argument. Nothing on this page should be decoration.

## E1. What must be demonstrated rather than explained

| Priority | Demonstration | Section | Why it cannot be a sentence |
|---|---|---|---|
| **1** | **The derivation, performed** | 4 | The claim is that nothing else is typed. A sentence asserting that is exactly what a failed CRM's marketing also said. Letting the reader perform the act and watch four things they did not type appear is the only version that survives scepticism. |
| **2** | **The importer naming what it could not work out** | 7 | This is the chosen credibility spine, and it is un-imitable. Feature copy cannot fake a product showing its own uncertainty. It must be shown verbatim, as evidence, not illustrated. |
| **3** | **The record speaking before the approach** | 6 | The "2 prior" chip expanding into who worked them, for which client, with what result. **FACT: this has never been shown as screens anywhere.** The highest-value untold story in the product. Static images undersell it; it needs the reveal. |
| **4** | **One company, two deals, side by side** | 6 | The one case where static is correct, because the point is the contrast, not the motion. Caption does the work: *"Nobody typed the right-hand column."* |
| **5** | **The queue with computed lateness** | 1 | Needs no caption. Value visible in the picture. |

## E2. The sequence a visitor sees

1. A queue that is obviously maintained by something other than a person (hero).
2. Their own working day, described more precisely than they expected (section 2).
3. Nothing. Argument only (section 3).
4. Their own hand producing four consequences (section 4).
5. A list of moments where the software stopped and handed the decision back (section 5).
6. Two columns, one of which nobody typed (section 6).
7. A workbook going in, an admission coming out, a live project with history (section 7).
8. A short list of things it will not do (section 8).

## E3. What should be zoomed into

- The **day-count column** on the queue. It is monospaced and tabular, and it is the single detail that makes the product read as an instrument rather than a template.
- The **flag list** in the import review. Verbatim, at readable size. *"Excel had no date for this event, dated to the last known touch."*
- The **"2 prior" chip**, at the moment of expansion.
- The **THIN DATA · N<5** marker in analytics, if analytics appears at all.

## E4. What must NOT be shown

**FACT-backed exclusions from `DESIGN_CONTEXT` §24, all retained:**

- The **dashboard's red HEAVY PRESSURE gauge.** The most alarming frame in the product, and it is a state, not an identity. Showing it opens the page on "you are behind", which is the wrong emotional note for a product whose promise is composure.
- **The company record.** Raw system values (`TARGET`, `REFERRAL`, `MEDIUM`) and lorem-ipsum seed notes.
- **Settings**, whose read-only Team panel implies a capability the product does not have.
- **The empty new-firm dashboard**, the login screen, and the orphaned `/companies` route.
- **Any dark-theme capture**, unless the whole brand moves dark. The existing light-mode screenshots are the intentional, recent, reusable assets.
- **The seeded firm name "Upstream Capital Advisors"**, which currently makes the product appear as its own customer inside the screenshots used to sell it. This must be reseeded before capture.

---

# PART F — MESSAGING SYSTEM

## F1. Value proposition hierarchy

**One sentence**

> Everything you currently keep across three spreadsheets and a browser happens in one place, and it keeps itself, because the only thing you type is that an email went out.

**Primary value proposition**

> **You stop keeping the system, and the system starts keeping you.** The follow-up schedule, the day's order of work, the firm's record and the reporting all come out of one act you were performing anyway.

**Supporting value propositions**

| # | Value | User problem | Product capability | Functional benefit | Emotional benefit | Reason to believe |
|---|---|---|---|---|---|---|
| 1 | **Nothing to maintain** | The last system died because updating it was a second job | One logged act; the anchor, cadence, queue, funnel and analytics derived server-side | No re-typing, no sorting, no Monday compile | Composure. The number was computed, not remembered | Performed by the reader in section 4. **FACT**, `app/core` cadence engine, anchor immutable by rule |
| 2 | **Control stays with you** | "Will this send something on my behalf?" | Six surfaces that advise, warn, draft or ask, and never act | One message at a time from your own mailbox; no relay, no bulk send | Being taken seriously by your software | **FACT**, six independent surfaces, §26 evidence map |
| 3 | **The firm arrives already knowing** | A buyer known for years opens as a stranger | Firm-wide deduplicated company record with placements; warm history before the approach | You open the second deal carrying the first | Continuity. Your past work comes back to you | **FACT**, verified in the demo book: one company on three engagements, another on two |
| 4 | **The way in costs a workbook** | "How long until we are running on it?" | Whole-workbook import that reconstructs backdated outreach history | Days rather than a quarter, and the record starts full | Relief without a project | **FACT**, the importer, its fourteen flags, and its rolled-back preview |

**Every one of these is supported by shipped behaviour.** No benefit here requires a capability the product does not have.

## F2. Feature prioritisation

| Tier | Feature | Communicated as |
|---|---|---|
| **MUST UNDERSTAND** | The single logged act and the derivation from it | Mechanism, performed |
| | The fixed anchor | Proof, inside the mechanism |
| | Whole-workbook import with reconstructed history | Its own fold |
| | The refusal to act, across six surfaces | Its own fold |
| | The firm-wide deduplicated record and warm history | Its own fold |
| **SHOULD UNDERSTAND** | Sending from your own mailbox, one at a time | Inside the refusal fold. Doubles as the sequencer killer |
| | The append-only log | One line in the record fold: it cannot be edited afterwards |
| | The day's queue ordered by lateness | Hero image, and one consequence in section 4 |
| | Scope stops at outreach | Limits fold |
| **NICE TO KNOW** | Analytics opening on a written finding | One line, partner-facing, inside the mechanism's "report" consequence |
| | The hand-checked company database | One line in the limits fold, framed as *checked*, never as *large* |
| | Confidentiality enforced server-side | One line in the limits fold |
| | Contacts, the rolodex, relationship facts | Omit from the page. Real, but the person-level story is a view rather than an entity (**FACT**, §4.4), and claiming it invites a promise the schema cannot keep |
| **DO NOT SHOW** | AI drafting and fit scoring | Peripheral, off by default, and in tension with the "no second job" argument. Mentioning it puts the product in the wrong category against the wrong competitors |
| | Team collaboration as a self-serve capability | A firm cannot add a second user. Under decision 2 the page may say *we set the workspace up with your people in it*, which is true of hand-provisioning, and may not say *invite your team* |
| | Notifications, reminders, "nothing slips" as an active promise | **FACT**: no notification path exists anywhere. The product surfaces a lapse reliably on arrival; it does not prevent one |
| | Database size, reach, freshness, "new to you" | 164 rows, no shared tier, no provenance, no refresh |
| | Any figure implying traction | There are no customers. The house style forbids it |
| | Pipeline board, command palette, saved searches, exports, templates | Real, and page noise. They make a small tool look like a feature catalogue, which forfeits the smallness argument |

## F3. Differentiation

**The alternative is not another product. It is the reader's current arrangement**, in three forms: the spreadsheets (the real incumbent, named throughout the product's own copy as *"Import from Excel"*), a browser plus an LLM for the sourcing half, and the memory of a CRM that failed.

The meaningful difference is not features. It is **where the record comes from**:

| | Every alternative | This |
|---|---|---|
| **How the record gets kept** | Somebody keeps it, beside the work | The work keeps it |
| **Therefore, completeness** | As complete as someone's discipline that month | Complete by construction |
| **Therefore, trust** | Consulted with a caveat | Consulted |
| **Therefore, across deals** | Each engagement starts near zero | The second deal inherits the first |
| **At the point of action** | It acts for you, increasingly | It stops and hands the decision back |

**RESEARCHED FACT, from the repository's own buyer research and no further:** DealCloud is *"the standard"* and *"expensive and clunky"*; Affinity is *"clean"* with *"limited workflow"*; Salesforce is *"an instance nobody updates."* No competitor beyond the five named in the source is inferred, named, or characterised anywhere on this page. Competitive research was not extended beyond the source, because the source is unusually explicit and the marginal value of naming more vendors is negative for a page whose real opponent is a spreadsheet.

**The defensible difference is the causal chain, not any single link**, and a chain is harder to communicate than a feature. That is precisely why the page performs it in section 4 rather than asserting it.

## F4. Proof strategy

### Proof that exists

| Proof | Strength | Where it is used |
|---|---|---|
| **The product admitting what it does not know** | **Primary spine (decision 4).** The importer's fourteen plain-English flags, THIN DATA · N<5, the advisory duplicate check that never blocks, an FAQ that tells the wrong buyer to leave | Sections 7 and 8, and structurally in the DEMO BOOK label from frame one |
| **The running product, labelled** | Demonstration vehicle. Three intentional light-mode screenshots against the demo book already exist and are annotated | Sections 1, 4, 6, 7 |
| **The mechanism, performed** | Strong. The reader's own hand is the evidence | Section 4 |
| **A verified cross-deal example** | Strong and concrete. Confirmed by query, not only by copy: one company on three engagements, another on two | Section 6 |
| **164 hand-checked organisations with cited sources and deliberately blank revenue** | Small, verifiable, unusual. Framed as *checked*, never as *large* | One line, section 8 |
| **Engineering and confidentiality posture** | Currently unused. Answers *"is this a weekend project?"* | One line, section 8. Demoted under decision 4 |

### Proof that does not exist, and must not be invented

Customers. Logos. Testimonials. Case studies. Traction metrics. Outcome numbers of any kind. Named users. Pilot results. Time-saved figures. **The product's own house style rule 4 forbids outcome numbers on the grounds that there are no customers yet, and that rule is correct and is inherited by this page.**

### The proof gap that decision 4 does not close

**A page whose credibility rests on candour has to say who is being candid.** There is no about, no founder, no company entity anywhere. See §J1.

## F5. Objection handling

Every objection is answered at the earliest point in the story where the reader forms it. **No FAQ section is recommended**, because an FAQ is where a page puts objections it did not have the confidence to answer in the narrative. Five of these are currently in the reference page's FAQ; four move forward.

| Objection | Forms when | Answered where | How |
|---|---|---|---|
| "We bought one and nobody updated it" | Immediately, on recognising the category | **Section 3, as the pivot** | Named before the reader names it, and reframed from discipline to architecture |
| "Is this going to email people for me?" | Section 4, on the words cadence and send | **Section 5, its own fold** | Six behaviours; one message at a time from your own mailbox |
| "Our desk has run on these sheets for years" | Section 2 | **Section 7** | Those exact sheets, with the fragility removed, imported whole |
| "How long until we are running on it?" | Section 6, once they want it | **Section 7** | The workbook is the setup. History arrives with it |
| "Is this an AI tool?" | Any mention of drafting | **Prevented, not answered.** AI is absent from the page | Silence is the correct instrument here |
| "What if we outgrow it?" | Late | **Section 8** | It stops at outreach on purpose. If you need execution today, we are the wrong tool today |
| "What does it cost?" | Late | **Section 8** | There is no price yet, and we will not invent one |
| "Is my buyer list safe with a startup?" | Section 7, at the moment of upload | **Section 8** | Confidentiality enforced server-side, one line, specific and true to the build |
| "Who else uses it?" | Anywhere | **Section 8** | The book in every screenshot is seeded demo data, and it is labelled. There are no customers to show you yet |
| **"Who are you?"** | Section 9, at the form | **Currently unanswerable.** See §J1 | — |

## F6. Voice — provisional, and inherited rather than invented

**FACT:** a documented house style already exists in `marketing/content/site.ts`, and `DESIGN_CONTEXT` §25 calls it *"the strongest brand asset that exists."* It is not replaced here. It is inherited verbatim and extended by two rules.

**Inherited:**
1. No em dashes in rendered copy. Comma, colon or full stop.
2. Say the concrete thing. *"You find out from the CFO"* beats *"poor visibility."*
3. No AI vocabulary. Named ban list: seamless, leverage, robust, empower, streamline, elevate, unlock, actionable, solutions.
4. No outcome numbers. There are no customers, so there are no results. The only figures on the page live inside the demo book, which is labelled.
5. Write like someone who has sat on the desk: plain, a little dry, and allowed to notice that losing a warm thread stings.
6. The claim ledger. Every claim gets exactly one home on the page.

**Extended, provisionally, for this page only:**

7. **Never blame the reader.** The product advises instead of blocking; the copy absolves instead of scolding. *"Nobody was undisciplined"* is the register. This is already the instinct in the shipped line *"Nobody did anything wrong."*
8. **State limits in the same voice as capabilities.** No hedging typography, no fine print, no apologetic framing. A limit delivered in the same flat tone as a feature is the page's proof mechanism working.

**Marked provisional** because naming and visual identity have not been decided, and either may shift the register. Nothing above depends on the name "Upstream."

---

# PART G — FINAL COPY

House style applied throughout. No em dashes, no banned vocabulary, no outcome numbers, no invented figures.

---

## 1 · HERO

**Headline**
> Log the email. The follow-ups, the queue and the firm's record keep themselves.

**Subheadline**
> Origination and outreach for boutique M&A desks. The only thing you type is the thing you were already doing, so there is no second job called keeping the system up to date.

**Primary CTA:** `Request access`
**Secondary CTA:** `See what one email does ↓`
**CTA microcopy:** Access is opening to a small number of desks.
**Image caption:** Today's queue, ordered by how late it is. Nobody sorted this. `DEMO BOOK`

*Alternative headline, if a shorter line is required for layout:*
> **One act in. The follow-ups, the queue and the record come out.**
*Weaker: "one act in" needs the next sentence to mean anything, where the recommended line stands alone.*

---

## 2 · THE SHAPE OF THE DAY

**Headline**
> Three spreadsheets, a browser, and you holding them together.

**Body**
> The master list for this mandate. The email schedule, with the follow-up column nobody sorts. The contact list someone else owns. And when the client's list runs out, a browser: searches, directories, portfolio pages, an LLM, reassembled by hand into something you can send.
>
> The same company gets typed three times. The header block sits above the real column row. The exchange rate is on line four. None of it is difficult. It is just that the only thing joining any of it together is you, and you are also doing the actual work.

**Sub-beat headline**
> And every so often, it costs something.

| | Found out |
|---|---|
| Two analysts email the same CFO | From the CFO |
| The follow-up date passes on a Tuesday | Three weeks later |
| A buyer you have known for years opens as a stranger | You don't |
| An analyst leaves on Friday | In the handover |

**Turn line**
> All four are the same failure. The work was done. It had nowhere to live.

---

## 3 · WHY THE LAST ONE DIED

**Headline**
> The last one died because someone had to keep it.

**Body**
> A desk buys a system. For three weeks everything gets entered. Then a live deal lands, and entering things is the first thing to go, because entering things was never the job.
>
> Nobody was undisciplined. The tool asked people to record as well as do, and recording as well as doing is a second job. A record that needs a second job is always a little incomplete, and a little incomplete is worse than empty, because an incomplete record still gets consulted and believed.
>
> So the question is not whether this one is better. It is whether this one needs you.

---

## 4 · ONE ACT IN

**Headline**
> One act in. Four consequences out.

**Subheadline**
> Hold to log the email, the way you would in the app. Nothing below this was typed.

**The four consequences**

> **The clock.** Anchored to 12 March. Follow-ups fall on 26 March, 9 April, 23 April. The anchor never moves. A follow-up sent late does not buy the next one more time, which is the whole reason the date can be trusted.

> **The queue.** The row stops waiting for its first email and joins the day's work, sorted by how late it is. Nobody sorts it.

> **The report.** Volume and reply rate move. Nobody compiles anything on Monday.

> **The record.** A line is appended that the next mandate will read. It cannot be edited afterwards.

**Closing line**
> That is the whole input. Everything under it is computed on the server, which is why there is nothing for you to keep up to date.

---

## 5 · IT DOES EVERYTHING EXCEPT DECIDE

**Headline**
> It does everything except decide.

**Subheadline**
> This is not a sequencer. Email goes out one message at a time, from your own mailbox, when you press send. No relay, no shared sending domain, no bulk send. The recipient sees a normal email from you.

**The six**

> It reads your workbook, then asks which deal each tab belongs to. Sheet names do not say, so it will not guess.
>
> It tells you a company may already be on another deal. It does not stop you adding it.
>
> It drafts from the deal's own context. You edit it. You send it.
>
> It will not set a status because you dragged a card. A column is never written directly.
>
> It scores a company against the mandate, and lets you mark the score wrong.
>
> It hides its own numbers when there is too little data for them to mean anything.

**Closing line**
> Everything it does on its own is worked out from something you did. Nothing is done on your behalf.

---

## 6 · WHAT IT LEAVES BEHIND

**Headline**
> May's target is June's buyer, and June opens already knowing.

**Subheadline**
> A company is held once for the whole firm. Every deal it has sat on hangs off that one record.

**Comparison caption**
> Nobody typed the right-hand column.

**Warm history block**
> A candidate carries a small chip: **2 prior**. Open it and it says who worked them, for which client, how it went, and when. That the firm has approached them is visible to everyone. What was said is visible only to the people on that deal.

**Closing line**
> This is not a setting anyone can switch on later. Either the record was complete while the work was happening, or it was not.

---

## 7 · THE WAY IN

**Headline**
> Start with the workbook you already keep.

**Subheadline**
> Not a configuration project. Drop the client's files in, all of them, and the project comes out live.

**Three frames**

> **1.** Drop the workbook. Header blocks, exchange-rate lines, running counts and all. It hunts down the real column row rather than assuming row one.
>
> **2.** It tells you what it could not work out. *"Excel had no date for this event, dated to the last known touch."* *"Type not in the firm's category vocabulary, imported as Other."* Fourteen named flags, in plain English, before a single row is written.
>
> **3.** The project is live. Companies, contacts, and every outreach event backdated to its real date, with the clock already in the right state, including the companies that are already late.

**Closing lines**
> Nothing is written until you apply. The preview is a true dry run and rolls itself back.
>
> Your record does not start empty. It starts with what you already did.

**Inline CTA:** `Start with the deal you are running →`

---

## 8 · WHAT IT WILL NOT DO

**Headline**
> The whole tool is three screens. Here is what it will not do.

**The list**

> **It stops at outreach.** Execution, bid management and diligence are somebody else's software. If you need those today, we are the wrong tool today.
>
> **It will not chase you.** There are no notifications, reminders or digests. The clock runs, and it speaks when you open the app.
>
> **It will not send for you.** One message at a time, on your press. There is no bulk send and there is not going to be one.
>
> **It is not a data provider.** It ships with a set of organisations someone checked by hand, with the sources cited and revenue left blank rather than invented. It is a place to start, not a market map.
>
> **The book in every screenshot on this page is seeded demo data**, and it is labelled that way on the images. There are no customers to show you yet.
>
> **There is no price yet.** When there is one it will be on this page, and not before.

**Closing line**
> We would rather you found all of that out here than in month two.

---

## 9 · REQUEST ACCESS

**Headline**
> Start with the mandate you are running now.

**Subheadline**
> Access is opening to a small number of desks. Tell us the firm and the deal you are running, and we will set the workspace up with your people already in it.

**Form fields:** Firm · Your name · Work email · The deal you are running now *(optional)*
**Button:** `Request access`
**Form microcopy:** One reply, from a person. You are not being added to a sequence.

**Risk reversal**
> Import the workbook you already keep. If the first week does not read like your own desk, you have lost a week and a spreadsheet.

**Footer note**
> The book shown throughout is seeded demo data. This ships empty except for a database of real organisations someone checked by hand.

---

## Copy inventory — final vs alternative

**FINAL RECOMMENDATION** is everything above. Alternatives worth holding, and only these:

| Slot | Alternative | When to use |
|---|---|---|
| Hero headline | "One act in. The follow-ups, the queue and the record come out." | Only if layout forces a shorter line. It is weaker standing alone. |
| Hero headline | "Log the email. The rest is derived." *(shipped)* | If continuity with existing assets, including the OG card, is worth more than clarity. It is the more elegant line and the less informative one. |
| Section 3 headline | "You already tried the fix. It died of maintenance." | Slightly more accusatory. Use if testing shows the recommended line reads too gentle. |
| Section 5 subheadline | "No relay. No shared sending domain. No bulk send." | A harder, three-beat version. Use if the sequencer misread proves stubborn. |
| CTA label | "Request access" *(recommended)* / "Ask for a workspace" | The second is warmer and matches hand-provisioning; the first is unambiguous. Prefer the first. |

Microcopy that must survive edit, because each does a job no other line does: *Access is opening to a small number of desks* · *Nobody sorted this* · *Nothing below this was typed* · *Nobody typed the right-hand column* · *Nothing is written until you apply* · *One reply, from a person.*

---

# PART H — CONTENT TO EXCLUDE

Specific to this product. Each with the reason it would cost something.

| Excluded | Why |
|---|---|
| **An FAQ section** | Four of the five current FAQs are load-bearing objections and have been promoted into the narrative. An FAQ at the end would restate them, which breaks the claim ledger, and would signal that the page lacked the confidence to answer them where they arise. |
| **A pricing section** | No price exists. Handled as one line in section 8. |
| **Logos, testimonials, customer counts, "trusted by"** | None exist. The house style forbids inventing any, and a page whose spine is candour cannot open with a fabrication. |
| **Any outcome metric** | No customers, therefore no results. Time-saved and reply-rate-improvement claims are both unavailable. |
| **AI, anywhere** | Peripheral, off by default, and in direct tension with the "no second job" argument. Naming it recategorises the product against the wrong competitors and invites the automation misread the page spends a whole fold closing. |
| **"Invite your team", seat counts, collaboration UI** | A firm cannot add a second user. Under hand-provisioning the page may promise the workspace comes with the team in it, and may not promise self-serve invitations. |
| **"Nothing slips" as an active promise** | There is no notification path. The honest form is that a lapse is visible the moment you open it. |
| **Database size, reach, freshness, coverage claims, "new to you"** | 164 rows, copied per firm, no provenance, no refresh. Size is the one claim this product cannot make. |
| **A feature grid or capability matrix** | The product is deliberately small and its smallness is a selling point. A grid trades a real advantage for the appearance of a bigger one. |
| **Integrations section** | Gmail and Microsoft Graph are mechanisms inside the sending story, not a value proposition. A logo strip of two mail providers reads as thin. |
| **The river, current, flow and upstream metaphor** | Stage 1: the industry's river vocabulary is saturated to the point of inaudibility, it names the least-built half of the product, and it exists partly to justify a name that is under test. The page must not be built to justify a name again. |
| **"Deal intelligence, institutionalized."** | A leftover that violates the product's own copy rules. It should be removed from login and signup too. |
| **A founder story or company narrative** | None exists and it must not be invented. See §J1 for why its absence is nonetheless a problem. |
| **Security certifications, SOC 2, DPA language** | The engineering is genuinely strong; no obligation or certification is stated anywhere. Describing behaviour is honest; implying compliance is not. |
| **The dashboard, the pressure gauge, settings, the login screen, dark captures** | See §E4. |
| **Any generic hero illustration, abstract gradient or stock imagery** | The product is the argument. Decoration in place of evidence is exactly what the page's credibility mechanism is defined against. |

---

# PART I — MOBILE CONTENT PRIORITY

Mobile must preserve the argument, not compress the page. The argument survives if and only if recognition, objection, mechanism and the ask survive in order.

| Rank | Content | Mobile treatment |
|---|---|---|
| **1 · Essential** | Hero headline, subheadline, primary CTA | Full. Headline may wrap to three lines. |
| **1 · Essential** | Hero queue panel | Crop to four rows including the row with the "2 prior" chip. A cropped legible queue beats a full illegible one. |
| **1 · Essential** | Section 3 in full | It is text and it is the pivot. It costs almost nothing and carries the most. |
| **1 · Essential** | Section 4, the four consequences | Keep. If the press-and-hold interaction cannot be made reliable on touch, replace with an autoplaying three-state animation. Do not replace with a static image; the point is that nothing was typed. |
| **1 · Essential** | Section 9 form and risk-reversal line | Full. Four fields, stacked. |
| **2 · Important** | Section 2 body and the turn line | Keep the body. The four-loss table becomes four stacked lines. |
| **2 · Important** | Section 5, all six behaviours | Keep. It is short text and it prevents the fatal misread. |
| **2 · Important** | Section 7, frames 2 and 3 | Frame 2 is the credibility spine and must stay legible. Frame 1 (the drop zone) is the most cuttable image on the page. |
| **2 · Important** | Section 8 list | Keep. Six short lines. |
| **3 · Secondary** | Section 6 side-by-side comparison | Restructure to stacked before and after with the caption between them. The contrast survives stacking; a shrunken two-column table does not. |
| **3 · Secondary** | The Master List screenshot | Crop to three rows, or drop. The warm-history block carries this fold alone if it must. |
| **4 · Removable** | Section 7 frame 1 | Cut. |
| **4 · Removable** | Secondary hero CTA | Cut. The scroll cue is redundant on touch. |
| **4 · Removable** | Analytics imagery of any kind | Cut. Partner-facing, and the partner will reach the page on a desktop. |

**Never cut on mobile:** the DEMO BOOK label, the import review's flag text, and the caption *"Nobody typed the right-hand column."* Each is the entire load-bearing content of its section.

---

# PART J — CRITICAL STRATEGIC ISSUES

Resolve before visual design begins. Ordered by consequence.

### J1. The page has no author. **BLOCKING.**

A page whose credibility mechanism is *"we tell you what we do not know"*, asking for the most confidential document a desk owns, from an entity with no about page, no named person, no company and no jurisdiction. **FACT** (§19.13, §19.14). The contradiction is structural, not cosmetic, and no amount of copy fixes it.

**Minimum resolution:** a name, a sentence about who built this and why, and a legal entity in the footer. It does not need to be a founder story. It needs to not be anonymous.

### J2. The form has nowhere to post. **BLOCKING, and technical.**

**FACT** (§18-C): the landing page is a static export on GitHub Pages and cannot accept form submissions. Decision 1 requires a form. Until a submission path exists, the page's only conversion action is inoperable, which is the exact failure the current `/coming-soon` dead end already represents.

**Resolution is an infrastructure decision, not a design one.** It must be settled before the page is built, not after.

### J3. The demo firm is named after the product.

**FACT** (§17.1): the seeded firm is "Upstream Capital Advisors", so the screenshots used to sell the product show the product as its own customer. Every capture on this page inherits that. **The demo book must be reseeded under a neutral firm name before any screenshot is taken.** Cheap to fix, expensive to ship.

### J4. Screenshot assets are theme-locked and partly stale.

**FACT** (§18-C): screenshots are baked WebP and must be regenerated whenever the app's theme changes. The light-or-dark default is still undecided (§18-D.12). Capturing before that decision guarantees a recapture.

### J5. Four of the required demonstrations have never been captured.

**FACT** (§24): the warm-history reveal *"has never been shown as screens anywhere"*, and the import's three frames, the one-company-two-deals comparison and the performed derivation all need production. These are not "export the existing assets" tasks. See §G below for the brief.

### J6. Name and identity remain undecided, and this page must not be built to justify a name.

**FACT** (§17.1): three landing rebuilds in six weeks, each around a different premise, to justify a name treated internally as a project name. **This blueprint is deliberately name-independent.** Nothing in Part G depends on the string "Upstream", and the river metaphor is excluded (§H). If the name changes, the copy survives. That is intentional and should be preserved through the visual stage.

### J7. Two vocabularies still collide in the product the page points at.

**FACT** (§9): Schedule vs Outreach desk, Sourcing vs Discover, Master List vs Companies, mandate vs engagement. The page uses *mandate* and *deal* in copy and *queue* rather than *Schedule*. If the product's labels are reconciled, the page's terms should follow. If they are not, a visitor moves from the page's vocabulary into a different one on first login.

---

# PART K — ASSET REQUIREMENTS

Do not design these yet. This is the brief for the stage that does.

| # | Asset | Section | Purpose | Must communicate | Product evidence required | Priority |
|---|---|---|---|---|---|---|
| 1 | **Hero queue panel** | 1 | Instant comprehension | An ordered list of real work with computed lateness that obviously nobody sorted | Outreach desk, light theme, demo book, **one row carrying a "2 prior" chip**, DEMO BOOK label, day-count column legible | **P0** |
| 2 | **The derivation, performed** | 4 | The page's central proof | That four things appeared and none was typed | Three states: awaiting first email → the log act → anchor date, three future follow-ups, queue position, appended timeline line. Reader-driven, with an animated fallback and a reduced-motion path | **P0** |
| 3 | **Import, three frames** | 7 | Switching cost, latency, candour | That the middle frame is the product admitting what it could not read | Drop zone; review screen with counters and *"{n} rows need a second look"* and the flag list **verbatim and legible**; the live project line with its counts | **P0** |
| 4 | **Warm history reveal** | 6 | The differentiator | That the software knew something the analyst could not have looked up | Discover mid-search → candidate row with "2 prior" → expanded block naming analyst, client, sentiment, date. **Never captured before. Needs the reveal; static undersells it.** | **P0** |
| 5 | **One company, two deals** | 6 | The compounding asset | Contrast, not motion | Static before and after, from the verified demo example. Caption: *"Nobody typed the right-hand column."* The one case where static is correct | **P1** |
| 6 | **The four losses strip** | 2 | Consequence without alarm | Four events and how each was found out | Typographic. No illustration | **P1** |
| 7 | **The six refusals** | 5 | The counter-position | Six moments where the software stopped | Typographic list. Each traceable to a shipped surface | **P1** |
| 8 | **Master List crop** | 6 | The differentiator as an ordinary table | That the record is structural, not a feature | One row per company with deal chips, "Worked by" stack, Deals count. Existing light-mode asset, recaptured after J3 | **P2** |
| 9 | **Queue clearing loop** | 1 or 4 | Progress and finiteness | The most satisfying second in the product | Row flash and collapse, counter tick, horizon strip recount. Animation already exists in the app | **P2** |
| 10 | **Reseeded demo book** | All | Prerequisite to every capture | — | Neutral firm name, lorem-ipsum notes removed, dev-tool chrome absent (§17.17) | **P0, blocking 1, 3, 4, 5, 8, 9** |

**Assets explicitly not required:** hero illustration, abstract or gradient artwork, river or water imagery, icon set beyond the product's own, team photography, logo strip, analytics imagery, dark-theme captures.

---

# PART L — CRITICAL SELF-REVIEW

Answered against the brief's §25, without softening.

**Is the story genuinely derived from the product?** Yes. Every section maps to a shipped behaviour, and the two sections with no image (3 and 8) are the two that are pure argument by design. The one place I extended beyond both sources is the sequencing synthesis in §A2 conflict 1, which is labelled as a recommendation rather than a finding.

**Is the page communicating a clear transformation?** Yes: from holding four artifacts together by memory, to a record that is complete because the work wrote it. The transformation is stated at the start (section 2), proved in the middle (section 4), and paid off at the end (section 6).

**Could a stranger understand the product in ten seconds?** Yes, if the hero image is legible. The headline names the input and three outputs; the subheadline names the audience and category. It is a long headline, and that is a deliberate trade of elegance for comprehension against a sceptical reader. If the visual stage cannot set twelve words well, the fallback in §G is available and is worse.

**Is the hero differentiated or generic?** Differentiated, but not maximally. "It does everything except decide" is the more ownable line and it is unusable in a hero because a stranger cannot tell what the product is from it. The differentiation is instead carried by the "2 prior" chip in the first frame and by section 5. **This is a real compromise and it is recorded as one.**

**Are we explaining features instead of value?** Mostly not. The risk concentrates in section 5, which is a list of six behaviours. It is retained because each behaviour is evidence for one claim, not six claims, and because the closing line converts the list back into a stance.

**Is every section necessary?** Nine sections, each with a distinct reader question. The two most vulnerable to a cut are 2 and 8. Cutting 2 costs recognition, which is the only persuasion mechanism available to a product with no customers. Cutting 8 costs the credibility spine chosen in decision 4. Neither should be cut.

**Is the CTA logically earned?** Yes. It arrives after the reader knows the mechanism, the stance, the switching cost and the limits. The commitment level matches a chronic problem. The one weakness is that the ask is *access*, which the reader did not know was rationed until the hero microcopy told them, and that is honest but it is also the only pressure the page applies.

**Are any claims unsupported?** I believe none. The three closest to the line, and why each is defensible: *"we will set the workspace up with your people already in it"* is true under hand-provisioning and would be false under self-serve, which is why decision 2 was required before writing it. *"The whole tool is three screens"* is the product's own shipped claim and `DESIGN_CONTEXT` §25 affirms it is true. *"Fourteen named flags"* is a counted fact from the importer.

**Did we invent a user, pain point, competitor, result or positioning?** No user, no result, no competitor beyond the five in the source, and no metric. The pain points are all traceable, though the *ranking* of them is inference and is labelled as such in Stage 1 and inherited here.

**Are we following Stage 1 or quietly changing it?** Changing it in four named places (§A2), each argued from product evidence rather than preference: the anchor demoted from hook to proof, the refusal promoted from brand appendix to fold, the sourcing moment restored as a paragraph, and the record moved from opening claim to destination. All four are stated, not slipped in.

**If Stage 1 is wrong somewhere, is it identified?** Yes, and so is a disagreement between the two source documents that neither of them acknowledges (§A2 conflict 1), and a gap both of them miss (§A3).

**Does the page have one central idea?** Yes: *that one keeps itself.* Every section is either the setup for it, the proof of it, the payoff from it, or a limit on it.

**Would the visitor remember the product after leaving?** They will remember two things: that they logged an email and four things appeared, and that it told them what it could not read. Whether they remember the *name* is a question this stage cannot answer, and §J6 explains why the page has been built so that it does not matter.

**Where this blueprint is weakest.** Three places, stated plainly. The hero trades memorability for clarity. Section 5 is a list in a page that otherwise argues. And the whole page rests on a credibility mechanism that is undermined by §J1 until someone puts a name to it.

---

# THE DELIVERABLE

## A. LANDING PAGE STRATEGIC SUMMARY

- **What the page is selling.** Not a CRM, not a queue, not saved time. A firm's memory made true: a complete, uneditable account of who the firm approached and what happened, obtained without anyone maintaining it.
- **Who it is selling to.** The analyst on a boutique or mid-market M&A advisory desk, who is the adopter and the gatekeeper; the partner, who is the buyer and reads the same page differently. The analyst's fear (a second job) is addressed first, because adoption is the gate.
- **Core problem.** The record has always been a separate task from the work, so it never gets kept, and an incomplete record is worse than none because it gets consulted and believed.
- **Core transformation.** From holding three spreadsheets and a browser in agreement by memory, to working in one place where recording is identical to doing.
- **Central product insight.** Collapse recording into doing and the record becomes complete by construction rather than by discipline.
- **Primary value proposition.** You stop keeping the system, and the system starts keeping you.
- **Key differentiation.** The record is written by the work, and the software refuses to act on your behalf at every point where it could. Six shipped surfaces support the second claim.
- **Primary conversion action.** Request access.
- **Biggest messaging risk.** Being read as an outbound sequencer. Second: being read as another CRM to maintain. Both are closed structurally by page order rather than by an FAQ.
- **Biggest opportunity.** To own the anti-position in a category racing toward automation. It is true of this build, provable in six places, and occupied by nobody.

## B. FINAL LANDING PAGE STORY

The page opens on a queue that is obviously being kept by something other than a person, and says so in one sentence: you log the email, and the follow-ups, the queue and the record keep themselves. That is comprehension, and it buys the next thirty seconds.

It then spends those seconds not selling. It describes the reader's day in more detail than they expected a stranger to manage: the master list, the schedule with the column nobody sorts, the contact list somebody else owns, the browser when the client's list runs out, the header block above the real column row. Recognition is the only persuasion mechanism available to a product with no customers, and it is spent here, deliberately, before any claim. It closes with the four occasions when the arrangement costs something, and the line that turns them: *the work was done, it had nowhere to live.*

Because the reader has almost certainly tried the obvious fix, the page names it next, before presenting anything. The last system died of maintenance, nobody was undisciplined, and an incomplete record is worse than an empty one. This is the pivot, and it reframes the whole category from a discipline problem into an architecture problem. It ends on the only question that now matters: whether this one needs you.

That question is answered by making the reader perform the mechanism rather than read about it. They hold to log an email, and four things appear that they did not type: an anchor date with three follow-ups derived from it, a queue position, a moved report, an appended line. The anchor is explained here, where there is room, because it is what makes the date trustworthy.

At exactly this moment the reader is one step from the wrong conclusion, because cadence, follow-up and send are the vocabulary of bulk outbound tooling. So the page turns immediately and states the opposite: it does everything except decide. Six moments where the software stopped and handed the decision back, including the one that matters most, which is that email goes out one message at a time from the analyst's own mailbox. This is the hinge. It closes the fatal misread, and it converts the product's most distinctive behaviour from a negative into a stance.

Only now does the differentiator land, on a reader who trusts the stance. May's target is June's buyer, and June opens already knowing. One company on two deals, side by side, with the caption that does the whole job: nobody typed the right-hand column. The prior-work chip expands into who worked them and how it went. And the closing line makes the argument uncopyable: this is not a setting anyone switches on later.

The reader now wants it, so the page removes the reason not to. The way in is the workbook they already keep, in three frames, of which the middle one is the point: the product listing, in plain English, everything it could not work out. That frame does three jobs at once. It kills the switching cost, it makes the record start full rather than empty, and it is the clearest instance of the behaviour the whole page is trading on.

Then, immediately before the ask, the page states its limits in the same flat voice it used for its capabilities. It stops at outreach. It will not chase you. It will not send for you. It is not a data provider. The book in the screenshots is demo data and is labelled. There is no price yet. Each of those would be a weakness on a normal page; here they are the eighth consecutive instance of the same behaviour, and the closing line collects them: we would rather you found that out here than in month two.

The ask is then small, and earned. Start with the mandate you are running now. One reply, from a person.

## C. FINAL INFORMATION ARCHITECTURE

1. **Hero** — comprehension, the queue, the primary CTA
2. **The shape of the day** — recognition, then the four losses, then the turn
3. **Why the last one died** — the objection, named first, reframed
4. **One act in** — the mechanism, performed
5. **It does everything except decide** — the stance, and the misread closed
6. **What it leaves behind** — the record, the differentiator
7. **The way in** — import, three frames, the conversion moment
8. **What it will not do** — limits as the credibility spine
9. **Request access** — the ask

## D. FINAL COPY

See **Part G** in full, with alternatives and the microcopy that must survive edit.

## E. PRODUCT DEMONSTRATION STRATEGY

See **Part E**. In one line: the product must demonstrate that four consequences appeared from one act, and that it will tell you what it could not read. Everything else is supporting evidence.

## F. PROOF STRATEGY

See **Part F4**. Existing: the running product labelled as demo, the mechanism performed, a verified cross-deal example, 164 hand-checked organisations, an unused engineering posture, and the product's own admissions, which are now the spine. Missing and not to be invented: every form of customer proof. Missing and *fixable*: an author (§J1).

## G. ASSET REQUIREMENTS

See **Part K**. Four P0 assets, one of which (the reseeded demo book) blocks six of the others, and four of which have never been captured.

## H. CONTENT TO EXCLUDE

See **Part H**. Most consequentially: no FAQ, no pricing section, no AI, no team-invite language, no database size claim, no river metaphor, and no "nothing slips" as an active promise.

## I. MOBILE PRIORITY

See **Part I**. Essential: hero, section 3 entire, the four consequences, the form. Never cut: the DEMO BOOK label, the import flag text, and *"Nobody typed the right-hand column."*

## J. CRITICAL STRATEGIC ISSUES

See **Part J**. Two are blocking: the page currently has no author (J1), and the form has nowhere to post (J2). Both are decisions for the owner, not the designer.

## K. STAGE 2 VERDICT

### READY WITH CAVEATS

The story, architecture, messaging system and copy are complete and traceable to product evidence. Four business decisions that Stage 1 correctly identified as blocking have been taken, and taking them resolved the two largest forks in the strategy: hand-provisioning makes the firm-wide record honestly claimable, and a request-access CTA matches a problem that is chronic rather than urgent. The blueprint is deliberately independent of the product's name, so the naming stage cannot invalidate it.

**Visual design can begin on sections 2 through 9 immediately.**

**Two items must be resolved in parallel, and both are the owner's, not the designer's:**

1. **An author for the page (§J1).** A credibility strategy built on candour cannot be delivered anonymously to a buyer being asked for their most confidential document. A name, a sentence and a legal entity is the minimum.
2. **A submission path for the form (§J2).** The current static export cannot accept one, which would leave the page's only conversion action inoperable, which is the exact defect the existing dead end already has.

**One item must be resolved before any screenshot is captured (§J3):** the demo book is seeded under a firm named after the product, so every current capture shows the product as its own customer.

**Not blocking, but it will force rework if deferred:** the light-or-dark default (§J4), because screenshots are baked and theme-locked.

*Nothing in this document has been validated with a user. There is no user research, no customer evidence and no market testing anywhere in either source. Every strategic conclusion is reasoned from the implementation, the product's own copy, and the four decisions recorded in §0.*
