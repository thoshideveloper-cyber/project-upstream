/**
 * The one place the landing page's content is edited.
 *
 * ── Grounding ──────────────────────────────────────────────────────────────
 * Every claim on this page traces to the product brief (`M&A product brief v3`,
 * 30 May 2026), to `plan.md` / `CLAUDE.md`, or to something that is actually
 * shipped in `backend/app/api/*` and `frontend/app/**`. Upstream is the
 * **origination and outreach system for boutique and mid-market M&A advisory
 * desks**. It productises three spreadsheets the desk already runs:
 *
 *   Master list      the target/buyer register, per mandate and firm-wide
 *   Outreach desk    the cadence engine (fixed anchor, computed follow-ups)
 *   Contact list     person-level relationship memory, plus analytics
 *
 * ── The claim ledger ───────────────────────────────────────────────────────
 * Every claim gets exactly ONE home. The page read as generated when it
 * repeated itself: an audit once found the duplicate-outreach claim stated 5×
 * across 12 sections. Before adding copy, find its home here.
 *
 *   the four failures            LEDGER    pain only, never the fix
 *   what the product looks like  DESK      real screenshots, one caption each
 *   anchor / interval / stop     CLOCK     a working calculator, not a claim
 *   duplicates + shared history  RECORD    the one differentiator, given a fold
 *   auth, tenancy, deletes       SECRET    its own fold
 *   what's left unanswered       FAQ       five, not eight
 *
 * ── House style ────────────────────────────────────────────────────────────
 * 1. **No em dashes in rendered copy.** Full stop, comma, or colon. It was the
 *    single clearest "AI wrote this" tell on the page. JSDoc is exempt.
 * 2. **Say the concrete thing.** "You find out from the target" beats "poor
 *    visibility". Steal the brief's specificity.
 * 3. **No AI vocabulary.** seamless, elevate, unleash, leverage, robust,
 *    comprehensive, empower, streamline, supercharge. None of them.
 * 4. **No quantitative claim about outcomes.** There are no customers yet, so
 *    there are no results to cite. Figures render in exactly two places: the
 *    hero's product mock (internally consistent, labelled as a demo book) and
 *    the shipped company-database count, which is a fact about the build.
 */

/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */

/**
 * Where every CTA on the page points.
 *
 * The product app is a separate deployment and is not part of this release, so
 * "Book a demo" / "Sign in" / "See the live demo" all land on the in-app
 * coming-soon screen. Relative on purpose: it works on whatever domain this is
 * deployed to. Point it at your install when the product ships.
 */
export const CTA_HREF = "/coming-soon";

/**
 * Prefix for plain `public/` asset paths.
 *
 * Next rewrites `next/link` hrefs for `basePath` automatically, but an
 * `unoptimized` `next/image` src is passed through untouched, so on a sub-path
 * deployment the product screenshots 404 unless they carry the prefix too.
 */
export const ASSET_PREFIX = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/* ------------------------------------------------------------------ *
 * Social proof — real content only, and nothing stands in for it.
 * ------------------------------------------------------------------ */

export type Review = { quote: string; name: string; role: string; firm: string };

/**
 * Empty, because Upstream has design partners to recruit, not customers to
 * quote (brief §11.1). Fill it with quotes you have written permission to print
 * and the section returns on its own.
 *
 * Do not put placeholders here. A previous version rendered eleven cards
 * reading "To be reviewed" from "Jane Doe at Organisation A" behind a flag that
 * kept the section standing while empty. The intent was to avoid inventing
 * praise, which is right, but it skipped the third option: don't ship the
 * section.
 */
export const REVIEWS: Review[] = [];
export const SHOW_REVIEWS_SECTION = REVIEWS.length > 0;

/* ------------------------------------------------------------------ *
 * THE LEDGER. Brief §2.1, near enough verbatim.
 * ------------------------------------------------------------------ */

/**
 * The status quo, stated as pain and nothing else.
 *
 * `discovery` is the column that makes this a ledger rather than a grid of
 * feature-shaped complaints: every one of these failures is already expensive
 * by the time the firm learns about it, and that lateness is the actual
 * argument. The rows deliberately do NOT explain the fix. `answer` points at
 * the section that owns it, so each mechanism is explained exactly once.
 */
export type Failure = {
  id: string;
  pain: string;
  detail: string;
  /** How the firm finds out. Always too late, which is the point. */
  discovery: string;
  /** Where on this page the answer lives. Label plus anchor. */
  answer: { label: string; href: string };
};

export const FAILURES: Failure[] = [
  {
    id: "01",
    pain: "Two analysts email the same CFO.",
    detail:
      "One sheet per mandate, and no way to check across them. Both approaches are competent. Together they read as a firm that does not talk to itself.",
    discovery: "You find out from the target.",
    answer: { label: "The check that runs first", href: "#record" },
  },
  {
    id: "02",
    pain: "The follow-up date passes on a Tuesday.",
    detail:
      "Nobody had the schedule open. By the time someone does, the thread is three weeks cold, and reopening it costs a favour you were saving.",
    discovery: "You find out three weeks late.",
    answer: { label: "The clock, running", href: "#clock" },
  },
  {
    id: "03",
    pain: "Every mandate rebuilds the same knowledge.",
    detail:
      "Somebody here has worked this buyer before and knows exactly how they responded. That sits in an inbox, or in their head, and neither is searchable.",
    discovery: "You never find out.",
    answer: { label: "What the second mandate knows", href: "#record" },
  },
  {
    id: "04",
    pain: "An analyst leaves on Friday.",
    detail:
      "Their relationships, their context and half the reason a buyer took the last call go with them. The firm paid for all of it and kept none of it.",
    discovery: "You find out in the handover.",
    answer: { label: "Where the relationships live", href: "#record" },
  },
];

/* ------------------------------------------------------------------ *
 * THE DESK. The product, shown rather than described.
 * ------------------------------------------------------------------ */

/**
 * The three real product surfaces.
 *
 * `src` files are genuine screenshots of the running app against its seeded
 * demo firm, not renderings, and the caption on the section says so. The
 * previous page argued about a dense operational tool for nine thousand pixels
 * without once showing it, which left "I can picture myself using this" to the
 * reader's imagination.
 *
 * `notes` are the two or three things worth pointing at in each shot. They are
 * rendered as margin annotations, not as a bullet list, because the image is
 * the evidence and the text is the caption.
 */
export type Surface = {
  id: string;
  tab: string;
  title: string;
  detail: string;
  src: string;
  /** Alt text. Describes what the screenshot shows, not that it is a screenshot. */
  alt: string;
  notes: { label: string; text: string }[];
};

export const SURFACES: Surface[] = [
  {
    id: "master",
    tab: "Master list",
    title: "One row per company, enriched by everyone who touches it.",
    detail:
      "The register the desk already keeps, except a company exists once for the whole firm and carries every mandate it has ever appeared on. Switch between your book and the firm database without changing screens.",
    src: "/product/master.png",
    alt: "The Master List register: 118 companies, one row each, showing headquarters, the mandates each company sits on, which analyst worked it, revenue, headcount and a deal count.",
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
    src: "/product/schedule.png",
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
      "Volume, response rate and where each mandate sits against the firm average. Built from the same event log the analysts are filling in by working, so nobody is compiling a status report.",
    src: "/product/analytics.png",
    alt: "The Analytics screen: emails sent, response rate, responded and bounced tiles above a twelve-week volume and response chart, with a recent-versus-previous six-week comparison below.",
    notes: [
      { label: "Response rate", text: "Against the firm average, not against nothing." },
      { label: "Twelve weeks", text: "Volume and replies on one axis, so effort and result stay attached." },
      { label: "No reporting", text: "The chart is a by-product of the log. There is nothing to submit." },
    ],
  },
];

/**
 * The one number on the page that is a fact about the build rather than a claim
 * about results: `backend/app/data/company_pool.py` ships 164 verified
 * organisations, planted per firm at signup by `services/pool.seed_firm_pool`.
 * Deliberately no revenue or headcount, because those were not verifiable.
 */
export const SHIPPED_POOL = {
  count: "164",
  label: "organisations searchable on day one",
  detail:
    "Discover opens on a real company database the moment a firm is created, before anyone has imported a thing. Name, headquarters, domain, segment and sector, verified. No revenue or headcount, because those were not.",
};

/* ------------------------------------------------------------------ *
 * THE RECORD. Brief §6.4, which calls this "the defensibility layer".
 * ------------------------------------------------------------------ */

/**
 * The only place on the page that explains cross-mandate logic.
 *
 * The brief is unusually direct about why this matters: "This is what makes
 * Upstream more than a prettier spreadsheet and is the source of long-term
 * lock-in. It must be designed in from the MVP even if surfaced minimally." So
 * it gets its own fold rather than a card in a grid of six, where it previously
 * sat looking exactly as important as everything beside it.
 */
export const MOAT: { stamp: string; title: string; detail: string }[] = [
  {
    stamp: "01",
    title: "The firm is the unit, not the mandate",
    detail:
      "Every company, contact and touch belongs to the firm first and the mandate second. That one decision in the data model is what makes everything below it possible, and it is not a setting you can turn on later.",
  },
  {
    stamp: "02",
    title: "A name already in play gets flagged before you send",
    detail:
      "Upstream checks the name against every other live mandate, near-matches included, and shows what happened the last time the firm approached them. It advises. It does not block, because sometimes the second approach is the right call.",
  },
  {
    stamp: "03",
    title: "Nothing is ever overwritten",
    detail:
      "Outreach is an append-only event log and records are archived rather than deleted. You cannot quietly rewrite what happened on a deal, which is exactly why the record is worth trusting three years later.",
  },
  {
    stamp: "04",
    title: "The second mandate starts ahead of the first",
    detail:
      "A buyer approached in March opens in September with their history attached: who reached them, what they said, and whether they were worth the call. The desk compounds instead of resetting.",
  },
];

/* ------------------------------------------------------------------ *
 * THE SECRET. Security posture, all of it true to the codebase.
 * ------------------------------------------------------------------ */

export const SECURITY: { term: string; detail: string }[] = [
  {
    term: "No token is readable from the browser",
    detail: "Auth is httpOnly and Secure cookies. Nothing is ever written to localStorage.",
  },
  {
    term: "Refresh tokens rotate and revoke server-side",
    detail: "A leaver is logged out everywhere at once, from the server, not from their machine.",
  },
  {
    term: "Firm-scoped at the query, not at the view",
    detail: "An analyst cannot address a mandate they are not on, because the row never loads.",
  },
  {
    term: "Nothing is deleted",
    detail: "Records are archived. It is the same decision that makes the history survive.",
  },
  {
    term: "Password hashes never leave the server",
    detail: "They are not in a response body, a log line, or an export.",
  },
];

/* ------------------------------------------------------------------ *
 * FAQ. What is left unanswered once the page above has been read.
 * Nothing here restates the ledger, the desk, the clock, the record or
 * the secret.
 * ------------------------------------------------------------------ */

export type QA = { q: string; a: string };

export const FAQ: QA[] = [
  {
    q: "Our desk has run on these spreadsheets for years. Why change?",
    a: "Because the spreadsheets work right up until they do not: a file gets overwritten, a mandate closes and its sheet is archived somewhere nobody looks, an analyst leaves. Upstream is those exact sheets with the fragility removed. The fields, the buckets and the cadence are the ones you already use.",
  },
  {
    q: "How long until we are actually running on it?",
    a: "Days, not a quarter, because there is nothing to configure into a shape you recognise. It already is that shape. You upload the workbooks you keep today and the import maps them column by column, so the first screen you see is your own book.",
  },
  {
    q: "What happens to the mandates we have already closed?",
    a: "Bring them. Closed mandates hold most of the contact intelligence a desk owns, and loading them is what makes the cross-mandate layer useful on day one rather than in a year.",
  },
  {
    q: "Will this send email on our behalf?",
    a: "It sends from your mailbox, one message at a time, when you press send. There is no relay, no shared sending domain and no bulk send. Your deliverability stays yours, and a target never receives something that reads like a campaign.",
  },
  {
    q: "Who can see what?",
    a: "Analysts see the mandates they are assigned and nothing else. Partners see the whole book, the analytics and the escalation queue. It is enforced on the server, so the answer does not change if someone edits a URL.",
  },
  {
    q: "What if we outgrow it?",
    a: "Upstream covers origination and outreach deliberately, and stops there. Midstream execution, bid management and diligence are the next stage, not a checkbox we have quietly shipped. If you need those today, we are the wrong tool today.",
  },
];
