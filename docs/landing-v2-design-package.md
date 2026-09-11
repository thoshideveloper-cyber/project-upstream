# Upstream landing page — the design package

The single creative deliverable, written before any code or asset. The build consumes it;
every line of copy in section 6 ships verbatim.

Written 2026-08-24. Supersedes the "register of record" page (obsidian + Newsreader + amber),
which is kept only in git history.

---

## 1. The brand premise

The product is called **Upstream**, and the industry it serves already speaks a river
language it stopped hearing: deal *flow*, the *pipeline*, the *source*, going *downstream*.
The old page ignored the name and argued that the product is a ledger. This one takes the
name literally, because the name is the argument: **flow only moves one way, and a desk
that does not channel it loses it.**

The one idea the whole page teaches: **you type one word, `sent`, and everything else is
derived.** The clock, the queue, the analytics and the next mandate's head start all fall
out of a single logged event. That is the honest answer to the objection the research
turned up first, which is not "we have no CRM" but "we bought one and nobody updated it."

If a section does not serve that idea, it is not on the page.

## 2. Research: what the buyers actually say

Sources: practitioner guides and comparison writeups for M&A/IB deal teams (Amafi, Meridian,
4Degrees, Dialllog, InsightsCRM), plus the product brief's own §2.1 failure list.

Recurring phrases, kept as the copy's raw material:

- "Manual data entry is the single biggest reason IB CRM deployments fail."
- "A Salesforce instance nobody updates, or analyst-maintained Excel trackers."
- DealCloud: "the standard," and also "expensive and clunky." Affinity: "clean," and
  "limited workflow."
- What leadership wants: "reporting that leadership can run without analyst rework."
- What the desk wants: "relationship intelligence across the platform."

Two consequences for this page:

1. **The objection fold leads with "nobody updated the last one."** Answering it late is
   the same as not answering it.
2. **No outcome numbers anywhere.** There are no customers yet, so there are no results to
   cite, and an invented percentage is the fastest way to lose this audience.

**The one call to action:** *See it running.* Every section funnels there.

## 3. The palette

Sampled from the hero's own world (a river seen from above at first light: pale mist over
cold water, silt, and the one hot mark a late item makes). Light-first, because every tool
in this category ships a dark cinematic homepage and because the page is asking to be read.
The middle of the page submerges into deep water, which is the only place the dark canvas
appears and is the reason it means something when it does.

```css
:root{
  --mist:   #EDF2F0;   /* surface canvas. Cool grey-green, never cream, never #fff */
  --paper:  #F8FBFA;   /* raised surfaces */
  --ink:    #0B1A1C;   /* body ink, a deep petrol rather than black */
  --silt:   #55696B;   /* secondary ink */
  --depth:  #08201F;   /* the dark act's canvas: deep water */
  --current:#0E6E6B;   /* the brand mark, links, the drawn channel */
  --late:   #C2410C;   /* the accent proper. Overdue, and nothing else */
  --rule:   #0B1A1C14; /* hairlines */
}
```

The accent discipline: `--late` appears on the page maybe six times total, and every
appearance means the same thing, which is *this one is late*. It is the only warm colour in
the system, so it reads as heat. `--current` is the ambient brand colour and is allowed to
be everywhere the channel goes.

Deviation stated out loud: a light page with a serif would land on the banned cream/serif
default, so the display face here is a variable grotesk and the ground is cool, not warm.

## 4. The type trio

| Role | Face | Weights / axes | Why this one |
|---|---|---|---|
| Display | **Bricolage Grotesque** | wght 400–800, opsz, **wdth 75–100** | A variable grotesk with a real width axis. The headlines narrow as the page descends into deep water and widen again when it surfaces, so the type itself carries the arc. Not a face anyone reaches for by default. |
| Body | **Onest** | 400, 500 | A warm neutral built for long text at small sizes, and not Inter. |
| Data | **Spline Sans Mono** | 400, 500 | Every computed number, stamp, date and readout. Engineered, slightly narrow, holds tabular figures. |

Never Inter, never Roboto, never the previous page's Newsreader.

## 5. The signature: the channel

One continuous SVG line runs the entire height of the page, down the left gutter on wide
screens. It is the river, and it is also the outreach log, which is the joke the product is
built on: both only ever run one way and both only ever get longer.

- It **draws itself** with scroll (`pathLength`), so the page is literally being written as
  you read it.
- Every event on the page **drops a stamp into it**: a logged email, a follow-up coming due,
  a reply landing. The stamps are dated, in mono, and the dates are consistent across the
  whole page (one fictional mandate, one calendar).
- At the record fold it **forks** into two branches, March's mandate and September's, and
  they rejoin. That fork is the cross-mandate memory argument, drawn instead of asserted.
- It ends by flowing into the closing call to action.
- Reduced motion: fully drawn, all stamps present, no drives running.

Removal test: take the channel out and the page loses its structure, its sequencing and its
one visual argument. It stays.

## 6. The film, and the copy (ships verbatim)

### The hero: a scroll-scrubbed canvas, four bands

Tier 1, one continuous journey, 540vh of pinned hero (measured, not guessed: at 420vh the flick test gave each beat only four full 120px flicks; 540vh gives six). There is no AI-generated
footage: the "film" is a deterministic canvas scene rendered live at whatever the visitor's
screen is, and rendered offline by the same code for the poster and the social card. It is
one continuous downward motion, which agrees with the scroll.

| Band | Range | The footage | Copy (verbatim) | Entrance |
|---|---|---|---|---|
| 1 | 0.00–0.20 | A wide, uncountable current of pale ticks flowing down through mist. No order. | eyebrow: `DEAL FLOW, KEPT` · head: **"Two analysts. One CFO. Same Tuesday."** · sub: "Nobody did anything wrong. The client still remembers it." | Drift-down, one-time load ramp |
| 2 | 0.24–0.46 | The current splits into walled lanes. Ticks cannot cross. Two collide and flash `--late`. | head: **"One sheet per mandate is one memory per mandate."** · sub: "The file cannot see the other file, so the desk finds out from the target." | Halves parting |
| 3 | 0.50–0.72 | The walls dissolve. The ticks organise into one channel and begin aligning into rows. | head: **"Upstream keeps the whole current."** · sub: "One book for the firm. Every name arrives carrying what already happened to it." | Scatter-assemble |
| 4 | 0.76–1.00 | The rows settle. The real queue panel resolves out of the canvas and comes to rest. | head: **"Log the email. The rest is derived."** · sub: "The clock, the queue, the analytics and the next mandate's head start all come out of that one act." · CTA: `See it running` / `How the clock works` | Word-by-word rise into a staged settle |

### 5. The static hero (phones, reduced motion)

Over the rendered poster of the settled channel:

> `DEAL FLOW, KEPT`
> **Log the email. The rest is derived.**
> One book for the whole firm. The clock, the queue and the analytics all come out of the
> one act you were already doing.
> `See it running`

### The folds below the settle

**Fold 2 — What it costs.** Four entries, each a row: the event, how the desk found out, and
what it cost. Not cards.

> Head: **"Four ways a desk loses what it already earned."**
>
> 01 · "Two analysts email the same CFO." / found out: "From the CFO." / cost: "One reply, spent twice."
> 02 · "The follow-up date passes on a Tuesday." / found out: "Three weeks later." / cost: "A warm thread, cold."
> 03 · "A buyer you have known for years opens as a stranger." / found out: "You don't." / cost: "The same ground, walked twice."
> 04 · "An analyst leaves on Friday." / found out: "In the handover." / cost: "Ten years of instinct, out the door."

**Fold 3 — The turn.** One line, mostly empty band, the breath between two dense folds.

> **"All four are the same failure. The work was done. It had nowhere to live."**

**Fold 4 — One act, four consequences.** The interactive moment. The visitor holds a button
marked `Hold to log: initial email sent`, progress builds while they hold, releasing early
eases back down, and completing it lights four consequences in sequence.

> Head: **"You type one word. It is `sent`."**
> Lede: "That is the whole input. Everything under it is computed on the server, so there is
> no second job called keeping the CRM up to date."
>
> Consequence 1 — `THE CLOCK` — "Anchored to 12 March. Follow-ups fall on 26 March, 9 April,
> 23 April." Note: "The anchor never moves. A follow-up sent late does not buy the next one
> more time, which is the whole reason the date is trustworthy."
> Consequence 2 — `THE QUEUE` — "The row leaves *needs first outreach* and joins the day
> queue, sorted by how late it is."
> Consequence 3 — `THE REPORT` — "Volume and response rate move. Nobody compiles anything on
> Monday."
> Consequence 4 — `THE RECORD` — "A line is appended that the next mandate will read. It is
> never edited and never overwritten."

**Fold 5 — The desk.** The three real product surfaces, real screenshots, one caption each,
with margin notes. Copy carried over from the shipped surfaces (they describe real screens):
Master list, Outreach desk, Analytics.

> Head: **"The whole tool is three screens."**
> Lede: "Screenshots of the running app against a demo book, not renderings."

**Fold 6 — The second mandate.** The dark act begins. The channel forks.

> Head: **"March's buyer opens in September already knowing you."**
> Lede: "The firm is the unit, not the mandate. That one decision in the data model is what
> makes the rest of this possible, and it is not a setting you can switch on later."
>
> 01 "A name already in play is flagged before you send." / "Upstream checks it against every
> live mandate, near-matches included, and shows what happened last time. It advises. It does
> not block, because sometimes the second approach is the right call."
> 02 "Nothing is ever overwritten." / "Outreach is an append-only log and records are archived
> rather than deleted. You cannot quietly rewrite what happened on a deal, which is exactly
> why the record is worth trusting three years later."
> 03 "The relationship outlives the analyst." / "Who reached them, what they said, whether the
> call was worth making. It stays on the desk when the person leaves."
> 04 "The second mandate starts ahead of the first." / "The desk compounds instead of resetting."

**Fold 7 — Below the waterline.** Still dark, quieter. The buyer list is the secret.

> Head: **"A buyer list is the most confidential document a desk owns."**
> Lede: "So the answer to who can see what is enforced on the server, where a URL cannot
> argue with it."
>
> "No token is readable from the browser." / "Auth is httpOnly, Secure cookies. Nothing is
> ever written to localStorage."
> "A leaver is logged out everywhere at once." / "Refresh tokens rotate and are revoked
> server-side, not on their laptop."
> "Firm-scoped at the query, not at the view." / "An analyst cannot reach a mandate they are
> not on, because the row never loads."
> "Nothing is deleted." / "Records are archived. It is the same decision that makes the
> history survive."
> "Password hashes never leave the server." / "Not in a response body, not in a log line, not
> in an export."

**Fold 8 — What is left.** Five questions, the researched objections, in the buyers' words.
The surface returns.

> Head: **"What is left."**
>
> Q: "Our last CRM died because nobody updated it. Why is this different?"
> A: "Because updating it was a second job, done after the real one, from memory, on a
> Friday. Here the update is the send. You log the email in the tool you sent it from, and
> the clock, the queue and the report are all computed from that. There is no field anyone
> has to remember to fill in for the numbers to be right."
>
> Q: "Our desk has run on these spreadsheets for years. Why change?"
> A: "The spreadsheets work right up until they do not: a file gets overwritten, a mandate
> closes and its sheet is archived somewhere nobody looks, an analyst leaves. This is those
> exact sheets with the fragility removed. The fields, the buckets and the cadence are the
> ones you already use."
>
> Q: "How long until we are actually running on it?"
> A: "Days, not a quarter, because there is nothing to configure into a shape you recognise.
> It already is that shape. You upload the workbooks you keep today and the import maps them
> column by column, so the first screen you see is your own book."
>
> Q: "Will it send email on our behalf?"
> A: "It sends from your mailbox, one message at a time, when you press send. No relay, no
> shared sending domain, no bulk send. Your deliverability stays yours, and a target never
> receives something that reads like a campaign."
>
> Q: "What if we outgrow it?"
> A: "Upstream covers origination and outreach deliberately and stops there. Execution, bid
> management and diligence are the next stage, not a checkbox we have quietly shipped. If you
> need those today, we are the wrong tool today."

**Fold 9 — Closing.**

> Eyebrow: `ONE MANDATE IS ENOUGH TO TELL`
> Head: **"Start with the mandate you are running now."**
> Lede: "Import the workbook you already keep. If the first week does not read like your own
> desk, you have lost a week and a spreadsheet."
> CTA: `See it running` · secondary: `Read the mechanics`

**Footer.** Product, the record, the source, contact. No invented office addresses, no
invented customer logos, no invented press. The line that must be there: the demo book shown
in the screenshots is seeded demo data.

## 7. The vector and motion layer

- The channel (section 5), drawn by scroll.
- The hero canvas: one flow field, four beats, deterministic, seeded.
- One living element per fold, at whisper level: the current's slow drift behind the dark
  act, the pulse on the single overdue row, the tick of the day counter. Nothing else loops.
- Every entrance is `transform` and `opacity` only, staggered 60–120ms, and retires its
  delays when finished.
- Reduced motion: the channel is drawn, the canvas paints one still frame, the hold
  interaction completes instantly, every entrance shows its final state.

## 8. The engineering list

Blob-free (the hero is canvas, not video, so there is no Range problem), a dt-normalised
lerp on the scroll progress, delta-gated DOM and canvas writes, an rAF loop that rests when
converged and when the hero is off screen, the five static-hero gates evaluated live through
`matchMedia` change listeners, band pacing validated with the flick test, the four-layer
legibility system over the canvas, complete-and-beautiful with JavaScript disabled or the
canvas failing, and the quality floor: focus-visible, 44px coarse targets, landmarks, skip
link, tabular figures, no page-level horizontal scroll.

## 10. What the build measured

Run after the page was finished, before anyone saw it:

- **Flick test** (120 / 240 / 360px wheel steps): every beat holds full opacity
  for six normal flicks, and no beat is skippable at 360px. This is what moved
  the hero from 420vh to 540vh.
- **Contrast**: an automatic walk of every visible text node against its
  composited background found zero real failures. One reported failure was the
  harness mis-parsing a `color-mix()` background on the hero chip; measured by
  hand it is 5.0:1.
- **axe (WCAG 2.1 A and AA)**: zero violations at 1440px and at 375px.
- **Console and network**: zero errors, zero 404s, at both widths.
- **Horizontal overflow**: `scrollWidth` equals `clientWidth` at every width
  tested.
- **The five static-hero gates**: at 375px and under reduced motion the scrub
  stage is `display: none`, the still hero is shown, and the canvas is never
  armed.
- **The interactive moment**: releasing early does not complete it, a full hold
  does, and Enter completes it for anyone who cannot hold.
- **Copy gate**: zero em dashes and zero stock words in rendered copy.

## 9. The copy gate

Every viewer-facing line above ships verbatim. Before anyone sees the page: zero em dashes,
zero instances of leverage, seamless, empower, unlock, robust, actionable, data-driven,
solutions, streamline, elevate, testament, landscape, delve. Then the sweep for the quieter
tells: "not just X, it's Y", false ranges, vague attributions, big-finish conclusions. The
deliberate devices in this package (the three-beat "The clock, the queue and the analytics",
the staccato "From the CFO.") are craft and stay.

## 11. The film (added 2026-08-25)

The hero is real footage now, not a canvas rendering of one. Ten seconds of one
glacial river, generated as a single continuous locked-off take, and the scroll
position is the playhead.

**Why the footage won.** The canvas version was defensible and it read as an
argument, but it read as a diagram of an argument. A real river dividing itself
around four sandbars and then closing back over them makes the same point
without asking anyone to accept a metaphor first.

**The edit.** The film's beats do not fall at even intervals and the four bands
of copy do, so a straight scroll-to-time mapping put "one sheet per mandate"
over undivided water and "the whole current" over four channels. A seven-point
cue table in `hero.tsx` reconciles them, and it also runs the river
progressively slower: about thirteen seconds of footage per unit of scroll at
the top, four at the bottom. The settling into the register at the end is real
footage decelerating.

**What makes the scrub smooth.**
- One keyframe every six frames (`-g 6`), so a seek decodes at most five
  frames. 3.7MB at 1280x720, encoded from the generator's native resolution
  rather than upscaled to a number that adds bytes and no detail.
- Fetched once as a blob and seeked in memory, so it does not depend on the
  host supporting HTTP Range. Without that, on a host that lacks it, every seek
  clamps to zero and the hero looks frozen.
- One seek in flight at a time, with the newest request held as the only
  pending one. A hard flick costs one wasted decode, not forty. Measured: after
  a thirty-step burst the film settles on the right frame and is not seeking.
- Nothing under half a frame is requested, because two scroll positions closer
  than 1/48s land on the same picture.

**What it is not asked to do.** It is never fetched at the five static-hero
gates or on a metered connection, and the frame underneath it is frame one of
the film itself, so a visitor who never gets the file gets a finished hero
rather than a degraded one. Verified by aborting the request.

**What the canvas still does.** It draws nothing below 0.6 of the hero, because
synthetic filaments over a photograph of filaments read as dirt on the lens.
Across the last third it rises to a little over half strength and what it
brings up is the register: even rows at rest with two of them late. The two
layers make the argument together.

**What the thinner mist bought.** The four stills this replaced were dark
enough that the reading lane needed near-solid cover to hold 4.5:1, and the
cover was eating the picture. This footage is high-key, so the same measurement
pays for a much thinner veil: sublines now measure 5.4 to 5.7:1 with the
sandbars fully in shot.

## 12. Real data, and the bug it found (2026-08-25)

**The page stopped inventing companies.** The queue panel used to show Meridian
Foods, Kestrel Logistics and three more names that exist nowhere. Every row is
now lifted from the demo book the product actually ships: Glenmark Pharma 75
days late under Osha Suri, Minda Industries at 68, Dr Reddy's at 54, Strides
Pharma due today. The book is badly behind and it is left that way. A demo desk
tidied up to look calm would be arguing against the fold above it.

The record fold used to show one invented company approached twice. It now
shows **Tata Power Company**, which genuinely sits twice in that book: a target
on GreenGrow Ventures' capital raise, which replied, and a buyer on IndInfra
Capital's buy-side, which declined. Two clients, two analysts, opposite answers
from the same name. That is the argument the fold was making, and it turned out
not to need inventing.

Changing the data invalidated two lines of copy, and both were fixed rather
than left standing: the record fold's headline still said "March's buyer opens
in September" (now May and June, the months on screen), and the rail stamps ran
`9 Apr · replied` and then `23 Apr · follow-up 3`, which is a cadence
continuing after a reply on a page whose fourth rule is that a reply stops the
clock.

**The screenshots are the running app in light mode**, taken fresh against that
book, with the TanStack Query bubble and Next's dev indicator hidden because
neither exists on a deployment. WebP at q90: 248KB for all three where the old
PNGs were 1.07MB, with no visible cost to the type.

**Taking them found a real product bug.** The seed would not run: phase-8 slice
1 meant to swap `unique(company_id)` on `outreach_schedules` for
`unique(company_id, cycle_number)`, and on SQLite it added the new constraint
without dropping the old one, because it guarded the drop on a constraint name
that SQLite reflects as `None`. Postgres names that constraint, so production
was never affected; every developer machine had both, and the stricter one won.
Opening a second outreach cycle on a company has therefore never worked on a
dev machine, which is precisely the re-approach this page sells. Migration
`d5a7c9e1f3b8` drops it, by name where there is one and by table rebuild where
there is not, and does nothing on a database that is already correct.

## 13. The scroll, measured again (2026-08-25)

Two complaints, one real defect behind each.

**Unsmooth.** A profiler sampling the film against the scroll on every
animation frame found that a continuous read showed only **46 of 240 frames**.
The seek was too expensive: `-g 6` still meant decoding up to five frames to
land one. Re-encoded all-intra, where every frame is a keyframe and a seek
decodes exactly one picture. That costs 1.1MB (3.7 to 4.8) and nearly doubled
frames shown to 81, with the picture never unchanged for more than **2
animation frames** while the scroll is moving.

The first run of that profiler reported a 54-frame freeze, which was the
harness counting the idle wait after the scroll stopped. Measuring stillness is
not measuring stutter, and the fix was to the profiler.

**Long.** 540vh was five and a half screens of pinned stage. Now 420vh, a fifth
shorter. The honest cost is on the record: each beat holds four to five full
120px wheel notches instead of six to seven. Narrowing the dead gaps between
bands from 0.04 to 0.02 of the scrub gave the plateaus back what the shorter
stage took from the edges.

**The nav was smearing.** At 82% canvas plus a blur, a heading passing under
the bar did not disappear, it turned into a grey shape that sat there looking
like a rendering fault. 94%: high enough to hide what goes under it, low enough
to keep the tint of whichever act the bar is over.

## 14. Where the buttons go

Every call to action still lands on `/coming-soon`. The product is deployed and
live at `frontend-theta-two-22.vercel.app`, and that page now carries the link,
below the sentence explaining that access is limited and in second place to it.
Sending a stranger straight to a login screen they have no account for is a
worse first minute than a page that says so.
