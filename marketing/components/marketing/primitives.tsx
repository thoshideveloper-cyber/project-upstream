import Link from "next/link";
import { Check, type LucideIcon } from "lucide-react";

import { MotionSection } from "@/components/motion-section";
import { cn } from "@/lib/utils";

/**
 * The page's shared shell vocabulary.
 *
 * The sections were built at different times and drifted: six different card
 * shells, five mono letter-spacings, three icon-chip sizes, section rules in two
 * border tokens. Everything below is the single source for those decisions, so a
 * new section can only look like the rest of the page.
 *
 * The scale, once:
 *   section rule   border-t border-border            (one token, never /60)
 *   section rhythm py-24 md:py-32                    ("band" = py-14 md:py-16)
 *   section h2     DisplayHeading                    (text-4xl sm:text-5xl)
 *   card h3        font-display text-xl              (CardTitle)
 *   lede           text-[15px]                       (Lede)
 *   card body      text-sm
 *   list item      text-sm + CheckItem marker
 *   mono label     text-[11px] tracking-[0.2em]      (Eyebrow / BandLabel)
 *   mono meta      text-[10px] tracking-[0.15em]
 *   card shell     rounded-2xl border-border bg-card/40 p-6 md:p-7   (Card)
 *   icon chip      size-9 rounded-lg + size-4 glyph  (IconChip)
 */

/** Page-width container. Narrow, generous gutters — a reading measure, not a wall. */
export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("mx-auto w-full max-w-6xl px-6 md:px-8", className)}>{children}</div>;
}

/**
 * Mono-uppercase eyebrow with a leading amber tick — the app's instrument-panel
 * label voice ("WORK QUEUE · TRIAGE"), carried onto the marketing surface so the
 * two read as one product.
 */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.2em] text-primary-ink uppercase",
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-[1px] bg-primary" />
      {children}
    </span>
  );
}

/**
 * Centred mono label for the thin bands (the loop strip, the wordmark strip) and
 * for a mid-section divider line. No amber tick — the tick marks a section
 * opening, and a band is not one.
 */
export function BandLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-center font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Cormorant display heading — the tombstone voice. Sizes tuned per section. */
export function DisplayHeading({
  children,
  className,
  as: Tag = "h2",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <Tag
      className={cn(
        "font-display font-medium tracking-tight text-balance text-foreground",
        Tag === "h1" ? "text-[2.6rem] leading-[1.02] sm:text-6xl" : "text-4xl leading-[1.05] sm:text-5xl",
        className,
      )}
      style={{ letterSpacing: "-0.02em" }}
    >
      {children}
    </Tag>
  );
}

/** Card heading — one size for every card on the page. */
export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={cn(
        "font-display text-xl leading-snug font-medium text-balance text-foreground",
        className,
      )}
    >
      {children}
    </h3>
  );
}

/** Section lede — one or two lines, never a paragraph. */
export function Lede({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("max-w-xl text-[15px] leading-relaxed text-muted-foreground text-pretty", className)}>
      {children}
    </p>
  );
}

/**
 * A page section: the rule above it and the vertical rhythm inside it, decided
 * once. `motion` renders a MotionSection instead, for sections that own a looping
 * animation and need to know when they're on screen.
 */
export function Section({
  children,
  id,
  className,
  band = false,
  rule = true,
  motion = false,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
  /** Thin horizontal strip rather than a full section. */
  band?: boolean;
  /** The hairline above the section. Off only where two bands sit together. */
  rule?: boolean;
  motion?: boolean;
  "aria-label"?: string;
}) {
  const classes = cn(
    id && "scroll-mt-20",
    rule && "border-t border-border",
    band ? "py-14 md:py-16" : "py-24 md:py-32",
    className,
  );

  if (motion) {
    return (
      <MotionSection id={id} aria-label={ariaLabel} className={classes}>
        {children}
      </MotionSection>
    );
  }
  return (
    <section id={id} aria-label={ariaLabel} className={classes}>
      {children}
    </section>
  );
}

/**
 * The eyebrow / heading / lede stack that opens a section.
 *
 * Left-aligned everywhere. Two sections used to centre theirs, which was the
 * clearest tell that the page had been assembled from different sources.
 */
export function SectionIntro({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <DisplayHeading className="mt-5">{title}</DisplayHeading>
      {children && <Lede className="mt-5">{children}</Lede>}
    </div>
  );
}

/** The one card shell. `lift` for grids of cards; off for static panels. */
export function Card({
  children,
  className,
  lift = true,
  as: Tag = "article",
}: {
  children: React.ReactNode;
  className?: string;
  lift?: boolean;
  as?: "article" | "div" | "figure" | "li";
}) {
  return (
    <Tag
      className={cn(
        "flex flex-col rounded-2xl border border-border bg-card/40 p-6 md:p-7",
        lift && "hover-lift",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** Square icon plate. Amber glyph marks a capability; muted marks a problem. */
export function IconChip({
  icon: Icon,
  tone = "primary",
  className,
}: {
  icon: LucideIcon;
  tone?: "primary" | "muted";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-foreground/[0.03]",
        className,
      )}
    >
      <Icon
        aria-hidden
        className={cn("size-4", tone === "primary" ? "text-primary" : "text-muted-foreground")}
      />
    </span>
  );
}

/** The one list marker on the page: an amber check in a soft disc. */
export function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/90">
      <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15">
        <Check aria-hidden className="size-3 text-primary" />
      </span>
      {children}
    </li>
  );
}

/** A ruled-off closing line inside a card — the single amber beat per card. */
export function CardBeat({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 flex items-start gap-2.5 border-t border-border/60 pt-5 text-sm font-medium text-foreground/90">
      <span aria-hidden className="mt-[0.15rem] font-mono text-xs text-primary">
        →
      </span>
      {children}
    </p>
  );
}

// Focus is the one site-wide ring in globals.css (`:focus-visible`) — a second,
// button-only ring language meant two different focus treatments on one page.
const cta =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-sm font-medium tracking-tight " +
  "transition-all duration-200";

/** Primary CTA — the amber signal. */
export function CTAPrimary({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        cta,
        "bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0.72_0.16_58/0.6)]",
        "hover:-translate-y-px hover:bg-primary/90 active:translate-y-0",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Secondary CTA — quiet hairline. */
export function CTAGhost({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        cta,
        "border border-border bg-foreground/[0.02] text-foreground hover:border-primary/40 hover:bg-foreground/[0.05]",
        className,
      )}
    >
      {children}
    </Link>
  );
}
