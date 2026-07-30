/**
 * The one place the landing page's content is edited.
 *
 * What the product actually is (product brief v3, §5–§6): an origination and
 * outreach operating system — a relationship CRM that runs the whole loop
 * **source → reach → track → remember** at the level of the whole team, not one
 * person's inbox. It is explicitly NOT an email scheduler and NOT a mass sender;
 * the cadence engine is one module of several, and the durable value is the
 * cross-project memory that survives staff turnover.
 *
 * The page is sold to organisations in different industries — a recruiting firm, a
 * sales team, a fundraising team, an advisory desk — so the copy here names
 * capabilities and mechanics, never figures, and never a claimed customer.
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

/* ------------------------------------------------------------------ *
 * Social proof — real content only, empty until a deployment has it.
 * ------------------------------------------------------------------ */

/** A named quote. Every field is attributed content — only ever real. */
export type Review = {
  quote: string;
  name: string;
  role: string;
  /** Their organisation, as they want it printed. */
  org: string;
};

/**
 * A review given the large card at the top of the section. The extra fields are
 * optional so a deployment can supply a plain quote and still render correctly —
 * the card drops the persona row and the outcome line when they are absent.
 */
export type FeaturedReview = Review & {
  /** Who they are on the team, e.g. "The operator" — the label above the quote. */
  persona?: string;
  /** The feeling the quote is evidence of, e.g. "Control". Shown beside persona. */
  driver?: string;
  /** The specific result that makes the quote credible. Its own line, ruled off. */
  outcome?: string;
};

/** A customer wordmark. Rendered as text today — no image assets involved. */
export type Logo = { name: string };

/**
 * Empty by default: we ship no claimed customers.
 *
 * Populate per deployment with quotes you have written permission to print. Do NOT
 * add illustrative or persona quotes to make the section look full — a fabricated
 * endorsement on a sales page is the one thing this file exists to prevent. While
 * these are empty the section still stands (see {@link SHOW_TEMPLATE_SLOTS}), but
 * it shows labelled empty slots, never invented praise.
 */
export const REVIEWS: Review[] = [];

/** Empty by default, for the same reason as {@link REVIEWS}. Supply one or two. */
export const FEATURED_REVIEWS: FeaturedReview[] = [];

/** Empty by default: we ship no claimed customers. Names only, with permission. */
export const LOGOS: Logo[] = [];

/**
 * Keep the social-proof sections on the page while their content is empty,
 * rendered from the placeholder profiles below.
 *
 * The sections are part of the pitch's structure, so they stay standing rather
 * than vanishing. Set this to `false` for a public launch where you would rather
 * they not appear at all until {@link REVIEWS} / {@link LOGOS} are filled in.
 */
export const SHOW_TEMPLATE_SLOTS = true;

/**
 * Placeholder profiles, so the section renders at full fidelity — the same cards,
 * avatars and scrolling columns a populated deployment gets.
 *
 * The quote is literally "To be reviewed", and the names are the standard
 * placeholder people (Jane Doe, Jack Roe …). Nothing here can be read as an
 * endorsement, because nothing here says anything. Replace by filling
 * {@link REVIEWS} and {@link FEATURED_REVIEWS}; these disappear automatically.
 */
const PENDING = "To be reviewed";

const PLACEHOLDER_FEATURED: FeaturedReview[] = [
  {
    persona: "The operator",
    driver: "Pending",
    quote: PENDING,
    outcome: "Outcome to be confirmed",
    name: "Jane Doe",
    role: "Outreach lead",
    org: "Organisation A",
  },
  {
    persona: "The accountable one",
    driver: "Pending",
    quote: PENDING,
    outcome: "Outcome to be confirmed",
    name: "Jack Roe",
    role: "Managing director",
    org: "Organisation B",
  },
];

const PLACEHOLDER_REVIEWS: Review[] = [
  { quote: PENDING, name: "Ada Doe", role: "Team lead", org: "Organisation C" },
  { quote: PENDING, name: "Sam Roe", role: "Head of pipeline", org: "Organisation D" },
  { quote: PENDING, name: "Lee Doe", role: "Operations lead", org: "Organisation E" },
  { quote: PENDING, name: "Nina Roe", role: "Relationship lead", org: "Organisation F" },
  { quote: PENDING, name: "Max Doe", role: "Programme lead", org: "Organisation G" },
  { quote: PENDING, name: "Ruth Roe", role: "Business development", org: "Organisation H" },
  { quote: PENDING, name: "Theo Doe", role: "Director", org: "Organisation I" },
  { quote: PENDING, name: "Iris Roe", role: "Partnerships", org: "Organisation J" },
  { quote: PENDING, name: "Otto Doe", role: "Head of research", org: "Organisation K" },
];

export const HAS_REVIEWS = REVIEWS.length > 0 || FEATURED_REVIEWS.length > 0;
export const HAS_LOGOS = LOGOS.length > 0;
/** Whether the customers section renders at all — real content, or the template. */
export const SHOW_REVIEWS_SECTION = HAS_REVIEWS || SHOW_TEMPLATE_SLOTS;
export const SHOW_LOGO_SECTION = HAS_LOGOS || SHOW_TEMPLATE_SLOTS;

/** What the section actually renders: real reviews if there are any, else the template. */
export const DISPLAY_FEATURED_REVIEWS: FeaturedReview[] = HAS_REVIEWS
  ? FEATURED_REVIEWS
  : PLACEHOLDER_FEATURED;
export const DISPLAY_REVIEWS: Review[] = HAS_REVIEWS ? REVIEWS : PLACEHOLDER_REVIEWS;

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
    context: "Send from your own mailbox, on your own templates — the touch logs itself",
  },
  {
    label: "Track",
    context: "Next-due, days remaining and overdue computed server-side, never by hand",
  },
  {
    label: "Remember",
    context: "Every touch, contact and outcome stays on the team's record, across projects",
  },
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
    title: "One row per organisation. Shared by everyone on the project.",
    blurb: "Your central list, made relational — and impossible to double-work.",
    bullets: [
      "Linked to its project, and to the people inside it",
      "Where the name came from, and how good that source was",
      "Your own book, or the whole team's",
      "Duplicate warnings before anyone reaches out cold",
    ],
    image: "/product/master.png",
    caption: "upstream · registry",
  },
  {
    id: "outreach",
    tab: "Outreach desk",
    title: "The queue says who to chase. You chase them from here.",
    blurb: "Follow-ups anchored to your first message and computed server-side.",
    bullets: [
      "Overdue, due today, upcoming — backlog first",
      "An append-only log; history is never rewritten",
      "Send from your own mailbox and it logs itself",
      "Stops on a reply, a bounce or a decline",
    ],
    image: "/product/schedule.png",
    caption: "upstream · outreach desk",
  },
  {
    id: "analytics",
    tab: "Analytics",
    title: "Know what's working before you're asked.",
    blurb: "Response performance by segment and by person, benchmarked against your own average.",
    bullets: [
      "Sourced → contacted → replied → interested",
      "Response rate by segment, source and layer",
      "Per-person volume, response and conversion",
      "A going-quiet signal on projects gone silent",
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
    blurb: "Find the organisations worth reaching before you start reaching.",
    points: [
      "Search one shared pool by sector, geography, size and type",
      "Research → shortlist → active, on a board",
      "Push into a project and the cadence starts with it",
    ],
  },
  {
    icon: "send",
    title: "Outreach",
    blurb: "Messages leave through your mailbox, not a relay — and land on the record anyway.",
    points: [
      "Templates with variables that fill from the record",
      "Drafting help from real context; you always edit",
      "Paced per person. No bulk send, by design",
    ],
  },
  {
    icon: "users",
    title: "Contacts",
    blurb: "The relationship belongs to the team, not to whoever owns the inbox.",
    points: [
      "Person-level records with role, status and history",
      "Every touch attributed, in sequence, with its outcome",
      "Someone moves on and their book stays put",
    ],
  },
  {
    icon: "network",
    title: "Cross-project memory",
    blurb: "The part that compounds: what you learn once shows up next time.",
    points: [
      "Duplicate detection across projects, near-matches included",
      "A contact from one project surfaces with context on the next",
      "Nobody reaches out cold to a name you already own",
    ],
  },
  {
    icon: "gauge",
    title: "Oversight",
    blurb: "The dashboard is the log, so there is nothing to reconcile.",
    points: [
      "Every project's health, and who is behind, in one view",
      "Escalation on overdue; a signal on projects gone quiet",
      "Drill from any number into the records behind it",
    ],
  },
  {
    icon: "lock",
    title: "Governance",
    blurb: "Scoped, reversible and auditable before it was ever pretty.",
    points: [
      "People see only the projects they're on",
      "Imports previewed, de-duplicated and reversible",
      "Soft delete only — archived, never destroyed",
    ],
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
    blurb: "One prioritised queue, and the ability to act without losing your place.",
    points: [
      "Overdue first, then due today, then what's coming",
      "Log, send or schedule from the row",
      "List, board or grid — whichever way you think",
      "Your project's vocabulary, not a generic one",
    ],
  },
  {
    label: "The accountable one",
    title: "Nothing slipping, and nothing embarrassing.",
    blurb: "The view that used to mean asking everyone individually.",
    points: [
      "Every project's health, without a status update",
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
    a: "No — sending is one part of it. Upstream holds the registry of organisations you're working, the people inside them, an append-only record of every touch, and the cross-project memory that makes the next project better informed. There is deliberately no mass sending.",
  },
  {
    q: "How is it different from Salesforce or HubSpot?",
    a: "Generic CRMs need heavy customization before they fit a team that works project by project. This is built around projects, organisations, contacts and an outreach log — the model your team already thinks in.",
  },
  {
    q: "How does the follow-up cadence work?",
    a: "Each schedule anchors to the date you log the first message, and that anchor never moves. Next-due and overdue are computed server-side on one shared clock, and the sequence stops itself when someone responds, bounces or declines.",
  },
  {
    q: "How does our data get in?",
    a: "Two ways, and neither is retyping. Upload a spreadsheet and a guided flow maps the columns, previews duplicates and applies the batch reversibly — or connect a mailbox so outreach is recorded as you send it.",
  },
  {
    q: "Does it help us find new organisations to reach?",
    a: "Yes. Search a shared pool against a project's thesis, shortlist what fits, and push it into the project — the outreach schedule starts with it. Ranking assistance sorts; it never decides, and everything works with it off.",
  },
  {
    q: "Can two people reach the same organisation by mistake?",
    a: "That's the failure the cross-project layer exists to prevent. Upstream flags an organisation or contact already live on another project — near-matches included — before anyone sends, and shows what came of it last time.",
  },
  {
    q: "Who can see what?",
    a: "People see only the projects they're assigned to; whoever is accountable for the whole book sees everything, plus analytics and escalation. Scoping happens at the query, not in the interface.",
  },
  {
    q: "Is our data secure?",
    a: "Auth uses httpOnly, Secure cookies — no tokens touch the browser. Refresh tokens rotate and are revocable, and deletes are soft: records are archived, never destroyed.",
  },
];
