/**
 * The one place the landing page's content is edited.
 *
 * ── Grounding ──────────────────────────────────────────────────────────────
 * Every claim on this page traces to the product brief (`M&A product brief v3`,
 * 30 May 2026) or to the build. Upstream is the **origination and outreach
 * operating system for boutique and mid-market M&A advisory desks**. It
 * productises three spreadsheets the team already runs on live mandates:
 *
 *   Master list      the target/buyer database for a mandate, and firm-wide
 *   Outreach tracker the cadence engine (fixed anchor, computed follow-ups)
 *   Contact list     person-level relationship memory, plus analytics
 *
 * Brief §5.1 is emphatic about what it is NOT: not an enterprise CRM, not mass
 * email, not valuation or NDA tooling, not midstream deal execution. That
 * narrowness is the positioning, so the page says it out loud (see SCOPE).
 *
 * Brief §6.4 names cross-mandate logic as "the defensibility layer" and the
 * source of long-term lock-in. On the page that is the MOAT section, and it is
 * the only place duplicate detection and shared contact memory are explained.
 *
 * ── The claim ledger ───────────────────────────────────────────────────────
 * Every claim gets exactly ONE home. An audit before this rewrite found the
 * duplicate-outreach claim stated five separate times, "archived, never
 * destroyed" three times, and the stop-on-reply rule three times. Nothing was
 * wrong with any single instance; together they made twelve sections feel like
 * six sections said twice, which is what makes a page read as generated.
 *
 *   the loop, named            LOOP band
 *   the four failures          PROBLEM  (pain only, never the mechanism)
 *   what it plugs into         INTEGRATIONS
 *   what each module is        MODULES
 *   anchor / interval / stop   CADENCE demo
 *   duplicates + shared memory MOAT
 *   analyst vs partner         PERSONAS
 *   what we don't build        SCOPE
 *   migration                  HOW IT WORKS
 *   auth, tenancy, deletes     SECURITY
 *   one clock, many markets    REACH
 *
 * If you add copy, find its home above. If it has none, it probably belongs in
 * a section that already exists.
 *
 * ── House style ────────────────────────────────────────────────────────────
 * 1. **No em dashes.** They were the connective tissue of every other sentence
 *    here, and they are the clearest tell that copy was generated rather than
 *    written. Full stop, comma, or colon. Usually the sentence wanted to be two.
 * 2. **Say the concrete thing.** The brief is vivid where the page was vague:
 *    "an embarrassment that damages credibility with the market" beats "a poor
 *    experience". Steal the brief's specificity.
 * 3. **No AI vocabulary.** seamless, elevate, unleash, leverage, robust,
 *    comprehensive, empower, streamline, supercharge. None of them.
 */

/* ------------------------------------------------------------------ *
 * Where the CTAs go.
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
export type Logo = { name: string };

/**
 * Both empty, because Upstream has design partners to recruit, not customers to
 * quote (brief §11.1). Fill them with quotes and names you have written
 * permission to print and the sections return on their own.
 *
 * Do not put placeholders here. A previous version rendered eleven cards reading
 * "To be reviewed" from "Jane Doe at Organisation A" behind a flag that kept the
 * section standing while empty. The intent was to avoid inventing praise, which
 * is right, but it skipped the third option: don't ship the section.
 */
export const REVIEWS: Review[] = [];
export const LOGOS: Logo[] = [];

export const HAS_REVIEWS = REVIEWS.length > 0;
export const HAS_LOGOS = LOGOS.length > 0;
export const SHOW_REVIEWS_SECTION = HAS_REVIEWS;
export const SHOW_LOGO_SECTION = HAS_LOGOS;

/* ------------------------------------------------------------------ *
 * The loop — the band under the hero.
 * ------------------------------------------------------------------ */

export type LoopStage = { label: string; context: string };

/**
 * Source → reach → track → remember. The brief's own phrase for the closed loop
 * (§7): "this closes the loop: source → outreach → track → remember".
 *
 * No figures, deliberately. The band used to count up aggregates from a seeded
 * demo database; every firm's numbers differ, so quoting any is a claim we
 * cannot stand behind.
 */
export const LOOP: LoopStage[] = [
  {
    label: "Source",
    context: "Build the target and buyer list for a mandate, against its thesis",
  },
  {
    label: "Reach",
    context: "Send from your own mailbox. The touch writes itself to the record",
  },
  {
    label: "Track",
    context: "Follow-ups compute themselves from the day the first email went out",
  },
  {
    label: "Remember",
    context: "The contact history outlives the mandate, and the analyst who ran it",
  },
];

/* ------------------------------------------------------------------ *
 * The four failures. Brief §2.1, near enough verbatim.
 * ------------------------------------------------------------------ */

/**
 * The status quo, stated as pain and nothing else.
 *
 * These rows deliberately do NOT explain how Upstream fixes each one. That was
 * the old shape, and it meant every mechanism on the page got introduced here
 * and then explained again in its own section. The relief line is one sentence,
 * and it points at the section that owns the answer.
 */
export type Failure = {
  icon: "copy" | "calendar" | "trending" | "door";
  pain: string;
  detail: string;
  /** Where on this page the answer lives. Label plus anchor. */
  answer: { label: string; href: string };
};

export const FAILURES: Failure[] = [
  {
    icon: "copy",
    pain: "Two analysts email the same CFO.",
    detail:
      "One sheet per mandate and no way to check across them. The firm finds out from the target, which is the expensive way to find out.",
    answer: { label: "How the check works", href: "#memory" },
  },
  {
    icon: "calendar",
    pain: "The follow-up date passes on a Tuesday.",
    detail:
      "Nobody had the schedule open. By the time someone does, the thread is three weeks cold and reopening it costs a favour.",
    answer: { label: "The follow-up clock", href: "#cadence" },
  },
  {
    icon: "trending",
    pain: "Every mandate rebuilds the same knowledge.",
    detail:
      "Somebody here has worked this buyer before and knows how they responded. That sits in an inbox, or in their head, and neither is searchable.",
    answer: { label: "What the second mandate knows", href: "#memory" },
  },
  {
    icon: "door",
    pain: "An analyst leaves on Friday.",
    detail:
      "Their relationships, their context and half the reason a buyer took the last call walk out with them. The firm paid for all of it.",
    answer: { label: "Where the relationships live", href: "#memory" },
  },
];

/* ------------------------------------------------------------------ *
 * What it plugs into.
 * ------------------------------------------------------------------ */

/** Checkable facts, in the slot a young page would fill with borrowed logos. */
export const INTEGRATIONS: { name: string; detail: string }[] = [
  { name: "Gmail", detail: "Send as you, from your address" },
  { name: "Outlook", detail: "The same, on Microsoft 365" },
  { name: ".xlsx / .csv", detail: "Your existing sheets, mapped and previewed" },
  { name: "Your templates", detail: "Variables fill from the record" },
  { name: "Any timezone", detail: "One clock, computed on the server" },
];

/* ------------------------------------------------------------------ *
 * The three modules. Brief §6.1–§6.3.
 * ------------------------------------------------------------------ */

export type Module = {
  id: string;
  tab: string;
  /** The spreadsheet this module replaces, named as the desk names it. */
  replaces: string;
  title: string;
  blurb: string;
  bullets: string[];
  /** Must be a real screenshot of the product. Do not add a tab without one. */
  image: string;
  caption: string;
};

export const MODULES: Module[] = [
  {
    id: "registry",
    tab: "Master list",
    replaces: "Outreach template.xlsx",
    title: "Every target and buyer on the mandate, in one row each.",
    blurb: "The same fields your template already has, with the mandate attached to them.",
    bullets: [
      "Company, HQ, revenue, headcount, type and rationale",
      "Linked to its mandate and to the people inside it",
      "Bucketed the way your desk already buckets",
      "Adding a company opens its outreach schedule automatically",
    ],
    image: "/product/master.png",
    caption: "upstream · master list",
  },
  {
    id: "outreach",
    tab: "Outreach tracker",
    replaces: "Emailing schedule.xlsx",
    title: "The queue tells you who to chase today.",
    blurb: "Overdue first, because the backlog is the part that costs you deals.",
    bullets: [
      "Overdue, due today, upcoming, in that order",
      "Every touch is an event with a timestamp, not a column you overwrite",
      "Send it from your own mailbox and it logs itself",
      "Partner escalation surfaces without anyone filing a status update",
    ],
    image: "/product/schedule.png",
    caption: "upstream · outreach tracker",
  },
  {
    id: "analytics",
    tab: "Contacts and analytics",
    replaces: "Contact list.xlsx",
    title: "Who responds, and who on your desk is getting through.",
    blurb: "Built on the event log, so the numbers cannot disagree with the record.",
    bullets: [
      "Person-level records with designation, mode and engagement",
      "Response rate by sector and by bucket",
      "Per-analyst volume, response and conversion",
      "Contacted, responded, interested, progressed, as one funnel",
    ],
    image: "/product/analytics.png",
    caption: "upstream · contacts and analytics",
  },
];

/* ------------------------------------------------------------------ *
 * The moat. Brief §6.4, which calls this "the defensibility layer".
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
export const MOAT: { title: string; detail: string }[] = [
  {
    title: "The firm is the unit, not the mandate",
    detail:
      "Every company, contact and touch belongs to the firm first and the mandate second. That one decision in the data model is what makes the rest of this possible.",
  },
  {
    title: "A name already in play gets flagged",
    detail:
      "Before anyone sends, Upstream checks the name against every other live mandate, near-matches included, and shows what happened the last time the firm approached them.",
  },
  {
    title: "The second mandate starts ahead of the first",
    detail:
      "A buyer you approached in March opens in September with their history attached: who reached them, what they said, and whether they were worth the call.",
  },
];

/* ------------------------------------------------------------------ *
 * Deliberately narrow. Brief §5.1 and §8, plus the roadmap from §9.2.
 * ------------------------------------------------------------------ */

/**
 * What the product does, what it refuses to do, and where the refusals go later.
 *
 * This section replaces a grid of six identical capability cards. The brief's
 * §5.1 is a two-column "we ARE / we are NOT" table and §8 is an explicit
 * out-of-scope list, and saying both out loud is far more persuasive than a
 * sixth card claiming a sixth capability. A buyer evaluating software has been
 * told everything is possible by everyone; a page that names its own limits is
 * the one they believe.
 */
export const DOES: string[] = [
  "Origination and outreach for a live mandate",
  "Three spreadsheets, joined into one firm-wide record",
  "A follow-up cadence that computes itself",
  "Contact memory that outlives the mandate and the analyst",
];

export const DOES_NOT: { item: string; when: string }[] = [
  { item: "Mass email and automated sending", when: "Not planned. Sending is one at a time, on purpose" },
  { item: "Valuation models, teasers, NDA generation", when: "Not planned" },
  { item: "NDA tracking, bid management, diligence", when: "Midstream. After the desk is running on this" },
  { item: "Competing with enterprise deal platforms", when: "Not the wedge. See below" },
];

/**
 * Where Upstream sits, by category rather than by company name.
 *
 * The brief names DealCloud, Affinity, Navatar, Grata, Sourcescrub and Inven
 * with prices and rollout times. Naming them on a public page turns internal
 * research into a public claim about someone else's product, so the lanes are
 * described by what they are instead. Anyone who has sat through the demos will
 * recognise all three immediately.
 */
export const LANES: { lane: string; what: string; gap: string }[] = [
  {
    lane: "Enterprise deal platforms",
    what: "Configurable relationship and deal management, built for large PE and IB.",
    gap: "Six figures a year and a quarter to roll out. Priced and paced for a firm ten times your size.",
  },
  {
    lane: "Sourcing databases",
    what: "Company search, firmographics and signals. Genuinely good at finding names.",
    gap: "They hand you a list. They do not run the outreach or remember what came of it.",
  },
  {
    lane: "Upstream",
    what: "The outreach workflow itself, built from the sheets a boutique desk already runs.",
    gap: "Narrow on purpose. It does the one job that costs you deals when it goes wrong.",
  },
];

/* ------------------------------------------------------------------ *
 * The two people. Brief §3, which is a table of exactly this.
 * ------------------------------------------------------------------ */

export type Persona = {
  label: string;
  who: string;
  title: string;
  blurb: string;
  points: string[];
};

export const PERSONAS: Persona[] = [
  {
    label: "The daily user",
    who: "Analyst / Associate",
    title: "Faster than the spreadsheet, or it does not get used.",
    blurb:
      "This one is not sentimental. If it costs an analyst more keystrokes than the sheet did, the sheet wins and the rollout is over.",
    points: [
      "One queue, worst first, no filtering required",
      "Log a touch, draft a mail or push a date from the row",
      "Several people on one mandate without a merge conflict",
      "The fields your template already has, in the order you had them",
    ],
  },
  {
    label: "The economic buyer",
    who: "Partner / Managing Director",
    title: "Nothing slipping, and nothing embarrassing.",
    blurb:
      "The partner is not going to open this daily. They need it to answer the two questions they currently answer by walking over and asking.",
    points: [
      "Every live mandate's health, without requesting a status update",
      "Duplicate outreach stopped before it reaches the market",
      "Contacted through to interested, as one funnel per mandate",
      "The firm keeps the relationships when the analyst does not",
    ],
  },
];

/* ------------------------------------------------------------------ *
 * FAQ. Objections only. Nothing here restates a section above.
 * ------------------------------------------------------------------ */

export type QA = { q: string; a: string };

export const FAQ: QA[] = [
  {
    q: "Our desk has run on these spreadsheets for years. Why change?",
    a: "Because the spreadsheets work right up until they don't: a file gets overwritten, a mandate closes and its sheet is archived somewhere, an analyst leaves. Upstream is those exact sheets with the fragility removed. The fields, the buckets and the cadence are the ones you already use.",
  },
  {
    q: "How long until we are actually running on it?",
    a: "Days, not a quarter, because there is nothing to configure into a shape you recognise. It already is that shape. The week-one sequence is on this page above.",
  },
  {
    q: "What happens to the mandates we have already closed?",
    a: "Bring them. Closed mandates are where most of the contact intelligence is, and loading them is what makes the cross-mandate layer useful on day one rather than in a year.",
  },
  {
    q: "Will this send email on our behalf?",
    a: "It sends from your mailbox, one message at a time, when you press send. There is no relay, no shared sending domain and no bulk send. Your deliverability stays yours, and a target never receives something that reads like a campaign.",
  },
  {
    q: "Can an analyst see mandates they are not on?",
    a: "No. Scoping happens at the query, not by hiding buttons. Partners see the whole book plus analytics and escalation.",
  },
  {
    q: "What if we outgrow it?",
    a: "Upstream covers origination and outreach deliberately, and stops there. Midstream execution is the next stage, not a checkbox we have quietly shipped. If you need bid management today, we are the wrong tool today.",
  },
  {
    q: "Who owns the data, and can we get it out?",
    a: "You do, and yes. Export is not a retention lever. Records are archived rather than deleted, so the export includes the full history rather than the current state of a row.",
  },
  {
    q: "Is it secure enough for live mandate data?",
    a: "Auth uses httpOnly, Secure cookies, so no token is ever readable from the browser. Refresh tokens rotate and can be revoked server-side. We do not claim certifications we have not been through.",
  },
];
