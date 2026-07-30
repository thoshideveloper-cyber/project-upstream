/**
 * The one place the landing page's content is edited.
 *
 * What the product actually is (product brief v3, §5–§6): an origination and
 * outreach operating system. A relationship CRM that runs the whole loop
 * **source → reach → track → remember** at the level of the whole team, not one
 * person's inbox. It is explicitly NOT an email scheduler and NOT a mass sender;
 * the cadence engine is one module of several, and the durable value is the
 * cross-project memory that survives staff turnover.
 *
 * The page is sold to organisations in different industries (a recruiting firm, a
 * sales team, a fundraising team, an advisory desk) so the copy here names
 * capabilities and mechanics, never figures, and never a claimed customer.
 *
 * ── House style ────────────────────────────────────────────────────────────
 * Two rules, both learned the hard way:
 *
 * 1. **No em dashes.** They were the connective tissue of every other sentence
 *    on this page, which is the single clearest tell that copy was generated
 *    rather than written. If a clause needs setting off, use a full stop, a
 *    comma, or a colon. Usually the sentence just wanted to be two sentences.
 * 2. **Say the concrete thing.** "The date passes on a Tuesday and nobody has
 *    the schedule open" beats "follow-ups can be missed". No "seamless",
 *    "elevate", "unleash", "leverage", "robust", "comprehensive", "empower".
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
 * deployment the product screenshots 404 unless they carry the prefix too. Empty
 * for a normal root deployment.
 */
export const ASSET_PREFIX = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/* ------------------------------------------------------------------ *
 * Social proof — real content only, and nothing stands in for it.
 * ------------------------------------------------------------------ */

/** A named quote. Every field is attributed content, so only ever real. */
export type Review = {
  quote: string;
  name: string;
  role: string;
  /** Their organisation, as they want it printed. */
  org: string;
};

/** A customer wordmark. Rendered as text today; no image assets involved. */
export type Logo = { name: string };

/**
 * Both empty by default: we ship no claimed customers.
 *
 * Populate per deployment with quotes and names you have written permission to
 * print. Do NOT add illustrative or persona quotes to make a section look full.
 *
 * There used to be a `SHOW_TEMPLATE_SLOTS` flag here that kept the sections
 * standing while empty, rendering eleven cards reading "To be reviewed" from
 * "Jane Doe at Organisation A", plus a row of dashed grey rectangles labelled
 * CUSTOMER WORDMARKS. The intent was honesty. The effect was a page that looked
 * unfinished and, worse, auto-generated. A sales page does not get to hold space
 * for evidence it doesn't have.
 *
 * So the sections are gone, and their slots do real work instead: what Upstream
 * connects to (`INTEGRATIONS`) and what it replaces (`REPLACES`). Both are
 * statements of fact about the product, which is the strongest thing a page can
 * say before it has customers. Fill these arrays and the reviews section returns.
 */
export const REVIEWS: Review[] = [];
export const LOGOS: Logo[] = [];

export const HAS_REVIEWS = REVIEWS.length > 0;
export const HAS_LOGOS = LOGOS.length > 0;
/** Both sections render only when there is something true to put in them. */
export const SHOW_REVIEWS_SECTION = HAS_REVIEWS;
export const SHOW_LOGO_SECTION = HAS_LOGOS;

/* ------------------------------------------------------------------ *
 * The loop — the band under the hero.
 * ------------------------------------------------------------------ */

/**
 * A cell in the band under the hero.
 *
 * NOTE: no numeric field, deliberately. The band used to count up figures from a
 * seeded demo database; every organisation's aggregates differ, so quoting any is
 * a claim we cannot stand behind. The cells state the loop instead.
 */
export type Metric = { label: string; context: string };

/** Source → reach → track → remember: the whole product in four cells. */
export const CAPABILITIES: Metric[] = [
  {
    label: "Source",
    context: "Search one shared pool against your thesis, then push what fits into a project",
  },
  {
    label: "Reach",
    context: "Send from your own mailbox, on your own templates. The touch logs itself",
  },
  {
    label: "Track",
    context: "Next-due, days remaining and overdue are computed on the server, never by hand",
  },
  {
    label: "Remember",
    context: "Every touch, contact and outcome stays on the team's record, across projects",
  },
];

/* ------------------------------------------------------------------ *
 * What it connects to. Replaces the empty customer-wordmark band.
 * ------------------------------------------------------------------ */

/**
 * Facts about what the product works with, in the slot where a page this young
 * would normally put logos it hasn't earned. Every line here is checkable
 * against the build: OAuth send through Gmail and Outlook, a guided spreadsheet
 * import, per-firm templates, and one server-side clock.
 */
export const INTEGRATIONS: { name: string; detail: string }[] = [
  { name: "Gmail", detail: "Send as you, from your address" },
  { name: "Outlook", detail: "Same, on Microsoft 365" },
  { name: ".xlsx / .csv", detail: "Guided import, previewed and reversible" },
  { name: "Your templates", detail: "Variables fill from the record" },
  { name: "Any timezone", detail: "One clock, computed server-side" },
];

/* ------------------------------------------------------------------ *
 * Modules — the tabbed section with product screenshots.
 * ------------------------------------------------------------------ */

export type Module = {
  id: string;
  tab: string;
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
    tab: "The registry",
    title: "One row per organisation, and everyone on the project sees the same one.",
    blurb: "Your central list, made relational, and impossible to double-work.",
    bullets: [
      "Linked to its project, and to the people inside it",
      "Where the name came from, and how good that source turned out to be",
      "Filter to your own book, or read the whole team's",
      "Duplicate warnings before anyone reaches out cold",
    ],
    image: "/product/master.png",
    caption: "upstream · registry",
  },
  {
    id: "outreach",
    tab: "Outreach desk",
    title: "The queue says who to chase. You chase them from here.",
    blurb: "Follow-ups anchored to your first message, computed on the server.",
    bullets: [
      "Overdue, due today, upcoming. Backlog first",
      "An append-only log, so history is never rewritten",
      "Send from your own mailbox and it logs itself",
      "Stops on a reply, a bounce or a decline",
    ],
    image: "/product/schedule.png",
    caption: "upstream · outreach desk",
  },
  {
    id: "analytics",
    tab: "Analytics",
    title: "Know what's working before anyone asks you.",
    blurb: "Response performance by segment and by person, against your own average.",
    bullets: [
      "Sourced, contacted, replied, interested",
      "Response rate by segment, source and layer",
      "Per-person volume, response and conversion",
      "A going-quiet signal on projects that have stalled",
    ],
    image: "/product/analytics.png",
    caption: "upstream · analytics",
  },
];

/* ------------------------------------------------------------------ *
 * The rest of the surface — capability groups without a screenshot.
 * ------------------------------------------------------------------ */

export type CapabilityGroup = {
  /** lucide-react icon name, resolved in the component. */
  icon: "search" | "send" | "users" | "network" | "gauge" | "lock";
  title: string;
  blurb: string;
  points: string[];
};

export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    icon: "search",
    title: "Sourcing",
    blurb: "Work out who is worth reaching before you start reaching.",
    points: [
      "Search one shared pool by sector, geography, size and type",
      "Move names through research, shortlist and active on a board",
      "Push into a project and the follow-up clock starts with it",
    ],
  },
  {
    icon: "send",
    title: "Outreach",
    blurb: "Messages go out through your mailbox, not a relay, and still land on the record.",
    points: [
      "Templates with variables that fill from the record",
      "Drafting help from real context. You always get the last edit",
      "Paced one person at a time. No bulk send, by design",
    ],
  },
  {
    icon: "users",
    title: "Contacts",
    blurb: "The relationship belongs to the team, not to whoever owns the inbox.",
    points: [
      "Person-level records with role, status and history",
      "Every touch attributed, in sequence, with what came of it",
      "Someone moves on and their book stays where it is",
    ],
  },
  {
    icon: "network",
    title: "Cross-project memory",
    blurb: "The part that compounds. What you learn once turns up the next time.",
    points: [
      "Duplicate detection across projects, near-matches included",
      "A contact from one project surfaces with context on the next",
      "Nobody reaches out cold to a name the team already owns",
    ],
  },
  {
    icon: "gauge",
    title: "Oversight",
    blurb: "The dashboard is the log, so there is nothing to reconcile.",
    points: [
      "Every project's health, and who is behind, in one view",
      "Escalation on overdue, and a signal on projects gone quiet",
      "Drill from any number into the records behind it",
    ],
  },
  {
    icon: "lock",
    title: "Governance",
    blurb: "Scoped, reversible and auditable before it was ever pretty.",
    points: [
      "People see only the projects they are on",
      "Imports previewed, de-duplicated and reversible",
      "Soft delete only. Records are archived, never destroyed",
    ],
  },
];

/* ------------------------------------------------------------------ *
 * What it replaces. Takes the slot the placeholder reviews used to hold.
 * ------------------------------------------------------------------ */

/**
 * The comparison a buyer is actually running in their head, written out.
 *
 * Every "after" cell here is a mechanic that exists in the build, not a promise.
 * The "before" column describes the three-spreadsheet status quo the product was
 * specced against; it is deliberately not aimed at a named competitor, because
 * most teams evaluating this are moving off their own files, not off Salesforce.
 */
export type Replacement = { question: string; before: string; after: string };

export const REPLACES: Replacement[] = [
  {
    question: "Who has already been contacted?",
    before: "Depends whose sheet you open, and how recently they saved it.",
    after: "One row per organisation, shared by everyone on the project.",
  },
  {
    question: "When is the next follow-up due?",
    before: "A date typed into a cell, if somebody remembered to type it.",
    after: "Counted from the day the first email actually went out.",
  },
  {
    question: "What happens when they reply?",
    before: "Someone has to notice, then remember to stop chasing.",
    after: "The sequence stops itself on a reply, a bounce or a decline.",
  },
  {
    question: "Two people chase the same name.",
    before: "You find out afterwards, usually from the person you contacted.",
    after: "Flagged across projects before anyone sends, near-matches included.",
  },
  {
    question: "What did we learn about them last time?",
    before: "It is in a thread somewhere, or in somebody's head.",
    after: "On the record, and it surfaces when the next project opens them.",
  },
  {
    question: "Someone leaves the team.",
    before: "Their relationships and half-built context leave with them.",
    after: "Their book stays. Every touch was already attributed and logged.",
  },
];

/* ------------------------------------------------------------------ *
 * The two people the product has to serve (brief §3).
 * ------------------------------------------------------------------ */

export type Persona = {
  label: string;
  title: string;
  blurb: string;
  points: string[];
};

export const PERSONAS: Persona[] = [
  {
    label: "The operator",
    title: "Faster than the spreadsheet, or it doesn't get used.",
    blurb: "One prioritised queue, and the ability to act without losing your place in it.",
    points: [
      "Overdue first, then due today, then what's coming",
      "Log, send or schedule straight from the row",
      "List, board or grid, whichever way you think",
      "Your project's vocabulary, not a generic one",
    ],
  },
  {
    label: "The accountable one",
    title: "Nothing slipping, and nothing embarrassing.",
    blurb: "The view that used to mean asking six people how it was going.",
    points: [
      "Every project's health, without asking for a status update",
      "Duplicate outreach caught before it lands",
      "First contact through to interested, as one funnel",
      "The relationships stay when the people move on",
    ],
  },
];

/* ------------------------------------------------------------------ *
 * FAQ.
 * ------------------------------------------------------------------ */

export type QA = { q: string; a: string };

export const FAQ: QA[] = [
  {
    q: "Is this an email scheduler?",
    a: "No. Sending is one part of it. Upstream holds the registry of organisations you're working, the people inside them, an append-only record of every touch, and the cross-project memory that makes the next project better informed. There is deliberately no mass sending.",
  },
  {
    q: "How is it different from Salesforce or HubSpot?",
    a: "Generic CRMs need a lot of customisation before they fit a team that works project by project. This is built around projects, organisations, contacts and an outreach log, which is the model your team already thinks in.",
  },
  {
    q: "How does the follow-up cadence work?",
    a: "Each schedule anchors to the date you log the first message, and that anchor never moves. Next-due and overdue are computed on the server against one shared clock, and the sequence stops itself when someone responds, bounces or declines. The interval is yours to set per schedule; it starts at seven days.",
  },
  {
    q: "How does our data get in?",
    a: "Two ways, and neither is retyping. Upload a spreadsheet and a guided flow maps the columns, previews the duplicates it found and applies the batch reversibly. Or connect a mailbox, and outreach is recorded as you send it.",
  },
  {
    q: "Does it help us find new organisations to reach?",
    a: "Yes. Search a shared pool against a project's thesis, shortlist what fits, and push it into the project. The outreach schedule starts with it. Ranking assistance sorts the list; it never decides, and everything still works with it turned off.",
  },
  {
    q: "Can two people reach the same organisation by mistake?",
    a: "That is the failure the cross-project layer exists to prevent. Upstream flags an organisation or contact already live on another project, near-matches included, before anyone sends, and shows what came of it last time.",
  },
  {
    q: "Who can see what?",
    a: "People see only the projects they are assigned to. Whoever is accountable for the whole book sees everything, plus analytics and escalation. Scoping happens at the query, not in the interface.",
  },
  {
    q: "Is our data secure?",
    a: "Auth uses httpOnly, Secure cookies, so no tokens touch the browser. Refresh tokens rotate and can be revoked server-side. Deletes are soft: records are archived, never destroyed.",
  },
];
