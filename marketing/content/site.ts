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
 * ── Second cut ─────────────────────────────────────────────────────────────
 * The first rewrite got every claim down to one home. This one asks a harder
 * question of each home: does the page still need it. Modules, personas,
 * scope and a migration guide all traced back to real brief sections, and all
 * of them were a second telling of hero, problem, cadence or memory in a
 * spec-sheet register. They are gone from the page; MOAT, FAILURES and FAQ
 * are what is left, because they are the only three that were saying
 * something nothing else on the page says.
 *
 *   the four failures          PROBLEM   (pain only, human, never the fix)
 *   anchor / interval / stop   CADENCE   (a working calculator, not a claim)
 *   duplicates + shared memory MOAT      (the one differentiator, given room)
 *   auth, tenancy, deletes     SECURITY  (already its own fold)
 *   what's left unanswered     FAQ       (five, not eight)
 *
 * ── House style ────────────────────────────────────────────────────────────
 * 1. **No em dashes.** Full stop, comma, or colon. Usually the sentence wanted
 *    to be two.
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
 * FAQ. What's left unanswered once the page above has been read.
 * Nothing here restates hero, problem, cadence, memory or security.
 * ------------------------------------------------------------------ */

export type QA = { q: string; a: string };

export const FAQ: QA[] = [
  {
    q: "Our desk has run on these spreadsheets for years. Why change?",
    a: "Because the spreadsheets work right up until they don't: a file gets overwritten, a mandate closes and its sheet is archived somewhere, an analyst leaves. Upstream is those exact sheets with the fragility removed. The fields, the buckets and the cadence are the ones you already use.",
  },
  {
    q: "How long until we are actually running on it?",
    a: "Days, not a quarter, because there is nothing to configure into a shape you recognise. It already is that shape: the same fields, the same buckets, the same clock, just held by the firm instead of a file.",
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
    q: "What if we outgrow it?",
    a: "Upstream covers origination and outreach deliberately, and stops there. Midstream execution (bid management, diligence) is the next stage, not a checkbox we have quietly shipped. If you need that today, we are the wrong tool today.",
  },
];
