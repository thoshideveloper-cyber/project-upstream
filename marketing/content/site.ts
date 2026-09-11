/**
 * The one place this page's words are edited.
 *
 * ── Where the copy comes from ──────────────────────────────────────────────
 * `docs/landing-v2-design-package.md` §6. Every string below was authored
 * there and ships verbatim; a build pass wires it in and never paraphrases it.
 *
 * ── Grounding ──────────────────────────────────────────────────────────────
 * Every claim traces to the product brief (`M&A product brief v3`), to
 * `plan.md` / `CLAUDE.md`, or to something actually shipped in
 * `backend/app/api/*` and `frontend/app/**`. Upstream is the origination and
 * outreach system for boutique and mid-market M&A advisory desks: the master
 * list, the cadence engine and the contact record, joined.
 *
 * ── The claim ledger ───────────────────────────────────────────────────────
 * Every claim gets exactly ONE home. The previous page was audited once and
 * found stating the duplicate-outreach claim five times across twelve
 * sections, which is the single loudest tell that nobody was in charge of it.
 *
 *   the four losses              LOSSES     pain only, never the fix
 *   anchor / derivation          MECHANISM  performed by the reader, not claimed
 *   what the product looks like  DESK       real screenshots, one caption each
 *   cross-mandate memory         RECORD     the differentiator, given a fold
 *   auth, tenancy, deletes       DEPTH      its own fold
 *   everything still unanswered  FAQ        five, and the first one is the real one
 *
 * ── House style ────────────────────────────────────────────────────────────
 * 1. No em dashes in rendered copy. Comma, colon or full stop. JSDoc exempt.
 * 2. Say the concrete thing. "You find out from the CFO" beats "poor visibility".
 * 3. No AI vocabulary: seamless, leverage, robust, empower, streamline, elevate,
 *    unlock, actionable, solutions.
 * 4. No outcome numbers. There are no customers yet, so there are no results.
 *    The only figures on the page are inside the demo book, which is labelled.
 * 5. Write like someone who has sat on the desk: plain, a little dry, and
 *    allowed to notice that losing a warm thread actually stings.
 */

/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */

/** Where every call to action on the page points. */
export const CTA_HREF = "/coming-soon";

/**
 * The live product, which is a separate deployment on its own domain.
 *
 * Not what the buttons point at. Every call to action still lands on
 * `/coming-soon`, because access is limited and sending a stranger straight to
 * a login screen they have no account for is a worse first minute than a page
 * that says so. That page carries this link for the people who do have one.
 */
export const APP_URL = "https://frontend-theta-two-22.vercel.app";

/**
 * Prefix for plain `public/` asset paths. Next rewrites `next/link` hrefs for a
 * sub-path deployment, but an unoptimized `next/image` src is passed through
 * untouched, so the screenshots 404 on GitHub Pages without this.
 */
export const ASSET_PREFIX = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * The demo mandate's calendar. One fictional book, one set of dates, used by
 * the hero queue, the interactive derivation and the record fold, so a reader
 * who checks the dates against each other finds them consistent.
 *
 * 12 March is the anchor. The cadence interval is 14 days, which is the
 * product's default, so the follow-ups fall where §5.2 of plan.md says they do:
 * initial_date + n x interval, and a late send never moves them.
 */
export const DEMO = {
  anchor: "12 Mar",
  interval: 14,
  followups: ["26 Mar", "9 Apr", "23 Apr"],
} as const;

/* ------------------------------------------------------------------ *
 * NAV
 * ------------------------------------------------------------------ */

export const NAV: { label: string; href: string }[] = [
  { label: "The cost", href: "#cost" },
  { label: "The mechanism", href: "#mechanism" },
  { label: "The desk", href: "#desk" },
  { label: "The record", href: "#record" },
  { label: "Questions", href: "#questions" },
];

/* ------------------------------------------------------------------ *
 * HERO. Four bands over the scrubbed canvas, then the settle.
 * ------------------------------------------------------------------ */

export type Band = {
  id: string;
  /** Scroll progress through the pinned hero, [start, end]. */
  range: [number, number];
  eyebrow?: string;
  head: string;
  sub: string;
  /** Which entrance the words take. Each echoes what the canvas is doing. */
  entrance: "drift" | "part" | "scatter" | "settle";
};

export const BANDS: Band[] = [
  {
    id: "hook",
    range: [0.0, 0.22],
    eyebrow: "Deal flow, kept",
    head: "Two analysts. One CFO. Same Tuesday.",
    sub: "Nobody did anything wrong. The client still remembers it.",
    entrance: "drift",
  },
  {
    id: "split",
    range: [0.24, 0.47],
    head: "One sheet per mandate is one memory per mandate.",
    sub: "The file cannot see the other file, so the desk finds out from the target.",
    entrance: "part",
  },
  {
    id: "channel",
    range: [0.49, 0.72],
    head: "Upstream keeps the whole current.",
    sub: "One book for the firm. Every name arrives carrying what already happened to it.",
    entrance: "scatter",
  },
  {
    id: "settle",
    range: [0.74, 1.0],
    head: "Log the email. The rest is derived.",
    sub: "The clock, the queue, the analytics and the next mandate's head start all come out of that one act.",
    entrance: "settle",
  },
];

/** The composed hero for phones and reduced motion, over the poster. */
export const STATIC_HERO = {
  eyebrow: "Deal flow, kept",
  head: "Log the email. The rest is derived.",
  sub: "One book for the whole firm. The clock, the queue and the analytics all come out of the one act you were already doing.",
  cta: "See it running",
};

export const HERO_CTA = { primary: "See it running", secondary: "How the clock works" };

/**
 * The queue that resolves out of the canvas at the settle.
 *
 * Every row is lifted from the demo book the product actually ships with, not
 * composed for the page: the companies, the people, their titles, the
 * follow-up numbers and the lateness are what `/schedule/due` returns for
 * `partner@upstream.test` against the seeded book. The panel says "demo book"
 * on its own face, because a marketing page showing a firm's queue without
 * saying whose it is is the one thing this page cannot do.
 *
 * The ordering is not a design decision. It is the cadence engine's output,
 * sorted by how late each row is, and exactly one row is promoted as the thing
 * to do next. The book is badly behind, which is left alone: a demo desk
 * tidied up to look calm would be arguing against the fold above it.
 */
export type QueueRow = {
  company: string;
  contact: string;
  /** Negative is overdue, in days. Zero is due today. */
  due: number;
  touch: string;
  stage: string;
};

export const QUEUE: QueueRow[] = [
  { company: "Glenmark Pharma", contact: "Osha Suri, Head of Strategy", due: -75, touch: "Follow-up 2", stage: "Contacted" },
  { company: "Minda Industries", contact: "Jyoti Bhardwaj, General Manager", due: -68, touch: "Follow-up 2", stage: "Contacted" },
  { company: "Ipca Laboratories", contact: "Triya Dalal, COO", due: -59, touch: "Follow-up 3", stage: "Interested" },
  { company: "Dr Reddy's Laboratories", contact: "Warda Nair, COO", due: -54, touch: "Follow-up 4", stage: "Contacted" },
  { company: "Strides Pharma", contact: "Thomas Sura, VP Corp Dev", due: 0, touch: "Follow-up 3", stage: "Contacted" },
];

/* ------------------------------------------------------------------ *
 * THE COST. Brief §2.1, stated as loss and nothing else.
 * ------------------------------------------------------------------ */

/**
 * `found` is the column that makes this a reckoning rather than a grid of
 * feature-shaped complaints: every one of these is already expensive by the
 * time the firm hears about it, and the lateness is the argument. No row
 * explains the fix.
 */
export type Loss = { n: string; event: string; found: string; cost: string };

export const LOSSES: Loss[] = [
  {
    n: "01",
    event: "Two analysts email the same CFO.",
    found: "From the CFO.",
    cost: "One reply, spent twice.",
  },
  {
    n: "02",
    event: "The follow-up date passes on a Tuesday.",
    found: "Three weeks later.",
    cost: "A warm thread, cold.",
  },
  {
    n: "03",
    event: "A buyer you have known for years opens as a stranger.",
    found: "You don't.",
    cost: "The same ground, walked twice.",
  },
  {
    n: "04",
    event: "An analyst leaves on Friday.",
    found: "In the handover.",
    cost: "Ten years of instinct, out the door.",
  },
];

export const COST_HEAD = "Four ways a desk loses what it already earned.";

/** The breath between two dense folds. One line, one band, mostly empty. */
export const TURN = {
  line: "All four are the same failure.",
  turn: "The work was done. It had nowhere to live.",
};

/* ------------------------------------------------------------------ *
 * THE MECHANISM. The reader performs the product's one idea.
 * ------------------------------------------------------------------ */

export const MECHANISM = {
  head: "You type one word. It is sent.",
  lede: "That is the whole input. Everything under it is computed on the server, so there is no second job called keeping the CRM up to date.",
  hold: "Hold to log: initial email sent",
  held: "Logged. 12 March.",
  hint: "Press and hold",
};

export type Consequence = { key: string; label: string; line: string; note: string };

export const CONSEQUENCES: Consequence[] = [
  {
    key: "clock",
    label: "The clock",
    line: "Anchored to 12 March. Follow-ups fall on 26 March, 9 April, 23 April.",
    note: "The anchor never moves. A follow-up sent late does not buy the next one more time, which is the whole reason the date is trustworthy.",
  },
  {
    key: "queue",
    label: "The queue",
    line: "The row stops waiting for its first email and joins the day queue, sorted by how late it is.",
    note: "Nobody sets a reminder. The queue is the schedule, recomputed every morning against today's date.",
  },
  {
    key: "report",
    label: "The report",
    line: "Volume and response rate move. Nobody compiles anything on Monday.",
    note: "The chart is a by-product of the log, so there is no status report to submit and nothing to reconcile.",
  },
  {
    key: "record",
    label: "The record",
    line: "A line is appended that the next mandate will read.",
    note: "It is never edited and never overwritten. Three years later it still says what actually happened.",
  },
];

/* ------------------------------------------------------------------ *
 * THE DESK. The product, shown rather than described.
 * ------------------------------------------------------------------ */

export type Surface = {
  id: string;
  tab: string;
  title: string;
  detail: string;
  src: string;
  /** Describes what the screenshot shows, not that it is a screenshot. */
  alt: string;
  notes: { label: string; text: string }[];
};

export const DESK_HEAD = "The whole tool is three screens.";
export const DESK_LEDE = "Screenshots of the running app against a demo book, not renderings.";

export const SURFACES: Surface[] = [
  {
    id: "master",
    tab: "Master list",
    title: "One row per company, enriched by everyone who touches it.",
    detail:
      "The register the desk already keeps, except a company exists once for the whole firm and carries every mandate it has ever appeared on. Switch between your book and the firm database without changing screens.",
    src: "/product/master.webp",
    alt: "The Master List register: one row per company showing headquarters, the mandates each company sits on, which analyst worked it, revenue, headcount and a deal count.",
    notes: [
      { label: "Worked by", text: "The analyst who owns the relationship, on the row." },
      { label: "Deals", text: "How many mandates this name has already appeared on." },
      { label: "Firm database", text: "One toggle from your book to everything the firm holds." },
    ],
  },
  {
    id: "schedule",
    tab: "Outreach desk",
    title: "Today, sorted by how late it is.",
    detail:
      "Not an inbox and not a task list. The queue is ordered by the cadence engine, so the first thing on screen is the thing that has been waiting longest, and clearing it is the whole job.",
    src: "/product/schedule.webp",
    alt: "The Outreach desk: a day strip counting late, today and the week ahead, then a priority queue of companies with days overdue, contact name, last touch and a log-follow-up action on each row.",
    notes: [
      { label: "Late", text: "Computed, not typed. Nobody maintains this number." },
      { label: "Now", text: "One row promoted above the rest. Start here." },
      { label: "Log follow-up", text: "Appends an event. It never overwrites the last one." },
    ],
  },
  {
    id: "analytics",
    tab: "Analytics",
    title: "What the partner asks on Monday, already answered.",
    detail:
      "Volume, response rate and where each mandate sits against the firm average. Built from the same event log the analysts fill in by working, so nobody is compiling a status report.",
    src: "/product/analytics.webp",
    alt: "The Analytics screen: a line reading sixty-nine companies are overdue a follow-up, then emails sent, reply rate, interested and bounce rate tiles, an outreach funnel from contacted through replied to interested marking the biggest drop-off, and a twelve-week volume and replies chart beside reply timing.",
    notes: [
      { label: "The finding", text: "The screen opens on what is wrong, then shows the numbers." },
      { label: "The funnel", text: "Contacted, replied, interested, with the worst step named." },
      { label: "No reporting", text: "The chart is a by-product of the log. There is nothing to submit." },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * THE RECORD. Brief §6.4, "the defensibility layer". The dark act.
 * ------------------------------------------------------------------ */

export const RECORD = {
  // Named after the two mandates actually on screen below it. The line used to
  // say March and September, which was true of the invented company it used to
  // show and is not true of Tata Power.
  head: "May's target is June's buyer, and June opens already knowing.",
  lede: "The firm is the unit, not the mandate. That one decision in the data model is what makes the rest of this possible, and it is not a setting you can switch on later.",
};

export const RECORD_ITEMS: { n: string; title: string; detail: string }[] = [
  {
    n: "01",
    title: "A name already in play is flagged before you send.",
    detail:
      "Upstream checks it against every live mandate, near-matches included, and shows what happened last time. It advises. It does not block, because sometimes the second approach is the right call.",
  },
  {
    n: "02",
    title: "Nothing is ever overwritten.",
    detail:
      "Outreach is an append-only log and records are archived rather than deleted. You cannot quietly rewrite what happened on a deal, which is exactly why the record is worth trusting three years later.",
  },
  {
    n: "03",
    title: "The relationship outlives the analyst.",
    detail:
      "Who reached them, what they said, whether the call was worth making. It stays on the desk when the person leaves.",
  },
  {
    n: "04",
    title: "The second mandate starts ahead of the first.",
    detail: "The desk compounds instead of resetting.",
  },
];

/**
 * One name on two mandates. The moat is hard to say and easy to show, so the
 * fold shows it rather than claiming it.
 *
 * This is not an illustration. Tata Power Company sits twice in the demo book,
 * once as a target on GreenGrow Ventures' capital raise and once as a buyer on
 * IndInfra Capital's buy-side, under two different analysts. It replied on one
 * and declined on the other. A desk keeping a sheet per mandate has those two
 * facts in two files that cannot see each other, and whoever opens the second
 * one starts from nothing.
 *
 * The right-hand column is what the record already holds about this name. Every
 * line of it is derived from the left-hand column: no field on that side is
 * typed by anybody.
 */
export const RECORD_TRACE = {
  company: "Tata Power Company",
  first: {
    label: "GreenGrow Ventures · capital raise",
    role: "Approached as a target",
    events: [
      "22 May · initial email · Priya Sharma",
      "5 Jun · follow-up 2 · no reply yet",
      "17 Aug · replied · 87 days after the first email",
      "Gauri Om, General Manager, is the live contact",
    ],
  },
  second: {
    label: "IndInfra Capital · buy-side",
    role: "Opens already knowing",
    events: [
      "Already in play since 22 May, under Priya Sharma",
      "Declined here on 25 Jun, after two follow-ups",
      "Hardik Sharaf said no; Gauri Om did not",
      "Said no to this deal, not to the firm",
    ],
  },
  note: "Nobody typed the right-hand column. It is the left-hand column, read back.",
};

/* ------------------------------------------------------------------ *
 * BELOW THE WATERLINE. Security, all of it true to the codebase.
 * ------------------------------------------------------------------ */

export const DEPTH = {
  head: "A buyer list is the most confidential document a desk owns.",
  lede: "So the answer to who can see what is enforced on the server, where a URL cannot argue with it.",
  /** Above the redacted panel. The names in it are genuinely not in the DOM. */
  redactHead: "Your book, to somebody who should not have it",
  redactNote: "Not a black rectangle over the text. The rows never load.",
};

export const SECURITY: { term: string; detail: string }[] = [
  {
    term: "No token is readable from the browser.",
    detail: "Auth is httpOnly, Secure cookies. Nothing is ever written to localStorage.",
  },
  {
    term: "A leaver is logged out everywhere at once.",
    detail: "Refresh tokens rotate and are revoked server-side, not on their laptop.",
  },
  {
    term: "Firm-scoped at the query, not at the view.",
    detail: "An analyst cannot reach a mandate they are not on, because the row never loads.",
  },
  {
    term: "Nothing is deleted.",
    detail: "Records are archived. It is the same decision that makes the history survive.",
  },
  {
    term: "Password hashes never leave the server.",
    detail: "Not in a response body, not in a log line, not in an export.",
  },
];

/* ------------------------------------------------------------------ *
 * QUESTIONS. The researched objections. The first one is the real one.
 * ------------------------------------------------------------------ */

export type QA = { q: string; a: string };

export const FAQ_HEAD = "What is left.";

export const FAQ: QA[] = [
  {
    q: "Our last CRM died because nobody updated it. Why is this different?",
    a: "Because updating it was a second job, done after the real one, from memory, on a Friday. Here the update is the send. You log the email in the tool you sent it from, and the clock, the queue and the report are all computed from that. There is no field anyone has to remember to fill in for the numbers to be right.",
  },
  {
    q: "Our desk has run on these spreadsheets for years. Why change?",
    a: "The spreadsheets work right up until they do not: a file gets overwritten, a mandate closes and its sheet is archived somewhere nobody looks, an analyst leaves. This is those exact sheets with the fragility removed. The fields, the buckets and the cadence are the ones you already use.",
  },
  {
    q: "How long until we are actually running on it?",
    a: "Days, not a quarter, because there is nothing to configure into a shape you recognise. It already is that shape. You upload the workbooks you keep today and the import maps them column by column, so the first screen you see is your own book.",
  },
  {
    q: "Will it send email on our behalf?",
    a: "It sends from your mailbox, one message at a time, when you press send. No relay, no shared sending domain, no bulk send. Your deliverability stays yours, and a target never receives something that reads like a campaign.",
  },
  {
    q: "What if we outgrow it?",
    a: "Upstream covers origination and outreach deliberately and stops there. Execution, bid management and diligence are the next stage, not a checkbox we have quietly shipped. If you need those today, we are the wrong tool today.",
  },
];

/* ------------------------------------------------------------------ *
 * CLOSING
 * ------------------------------------------------------------------ */

export const CLOSING = {
  eyebrow: "One mandate is enough to tell",
  head: "Start with the mandate you are running now.",
  lede: "Import the workbook you already keep. If the first week does not read like your own desk, you have lost a week and a spreadsheet.",
  primary: "See it running",
  secondary: "Read the mechanics",
};

export const FOOTER_NOTE =
  "The book shown in the screenshots is seeded demo data. Upstream ships empty except for a database of real organisations someone checked by hand.";
