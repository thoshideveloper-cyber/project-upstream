import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The page's shared shell vocabulary.
 *
 * The lesson kept from the last rebuild: **consistency and uniformity are not
 * the same thing.** An earlier pass normalised the page onto one card, one
 * eyebrow, one reveal and one hover treatment, and that is precisely what made
 * it read as templated. So the scale is decided once here, but it offers
 * *shapes* rather than one shape, and the page is composed so no two adjacent
 * sections open the same way.
 *
 * The register, once:
 *   measure        Container (6xl) · Container wide (7xl) · Gutter (stamp rail)
 *   rhythm         py-20 / py-28 md:py-36 / py-32 md:py-48   (tight/base/loose)
 *   rule           border-t border-border   one token, never /60
 *   stamp          mono 10px, tracked, in the left gutter. The page's spine.
 *   section h2     Display     serif, clamp to 3.6rem
 *   panel h3       Subhead     serif, text-lg/xl
 *   lede           text-[15px] md:text-base, max-w-[62ch]
 *   readout        Readout     mono 11px, tracked, tabular
 *   list marker    Marker      a 3px amber dot, and nothing else has been
 *                              allowed to be the marker since
 */

/* ------------------------------------------------------------------ *
 * Measure
 * ------------------------------------------------------------------ */

/** Page-width container. `wide` for the folds that need the extra room. */
export function Container({
  children,
  className,
  wide = false,
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-7 md:px-10",
        wide ? "max-w-[92rem]" : "max-w-6xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The stamp rail: a fixed left column that carries the section's mark, with the
 * content beside it. This is the page's spine and the reason it reads as a
 * document rather than a stack of centred blocks. Below `lg` the rail collapses
 * and the stamp sits above the content, because a 9rem gutter on a phone is
 * just a wasted third of the screen.
 */
export function Gutter({
  stamp,
  children,
  className,
  aside,
}: {
  stamp?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Optional second line under the stamp, for a running count or a date. */
  aside?: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-6 lg:grid-cols-[9rem_minmax(0,1fr)] lg:gap-10", className)}>
      <div className="lg:pt-1.5">
        {stamp && <Stamp>{stamp}</Stamp>}
        {aside && <div className="mt-2 hidden lg:block">{aside}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Type
 * ------------------------------------------------------------------ */

/**
 * Section and page headings. Newsreader, which can carry a 5rem line without
 * being asked for weight, so the fold gets its presence from shape rather than
 * from a heavier cut that only works on one of the two canvases.
 */
export function Display({
  children,
  className,
  as: Tag = "h2",
  size = "section",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "p" | "span";
  /** `statement` is the full-fold turn in the argument. Twice on the page. */
  size?: "section" | "hero" | "statement";
}) {
  return (
    <Tag
      className={cn(
        // No weight utility: `.mkt-display` reads a per-theme weight token, and
        // a Tailwind font-* class would override it in one theme's favour.
        "mkt-display text-foreground",
        size === "hero" && "text-[clamp(2.6rem,6.4vw,5.1rem)]",
        size === "statement" && "text-[clamp(2.4rem,6vw,4.75rem)]",
        size === "section" && "text-[clamp(2rem,4.2vw,3.4rem)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** Panel and row headings. One size, one face, everywhere below section level. */
export function Subhead({
  children,
  className,
  as: Tag = "h3",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h3" | "h4" | "p" | "dt";
}) {
  return <Tag className={cn("mkt-subhead text-xl text-foreground", className)}>{children}</Tag>;
}

/** Section lede. One or two lines, capped at a reading measure. */
export function Lede({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground text-pretty md:text-base",
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * The instrument voice: mono, tracked, tabular. Counts, states, captions and
 * column headers, which are the things the product itself prints in mono.
 * Never prose.
 */
export function Readout({
  children,
  className,
  tone = "muted",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "muted" | "signal" | "ink";
}) {
  return (
    <span
      className={cn(
        "font-mono text-[11px] font-medium tracking-[0.16em] uppercase",
        tone === "signal" && "text-primary-ink",
        tone === "muted" && "text-muted-foreground",
        tone === "ink" && "text-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * The margin stamp. Smaller and more tracked than a Readout, because it is
 * furniture rather than content: it tells you where you are in the document and
 * then gets out of the way.
 */
export function Stamp({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "block font-mono text-[10px] font-medium tracking-[0.22em] text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Section shell
 * ------------------------------------------------------------------ */

/**
 * A page section: the rule above it and the vertical rhythm inside it. Three
 * rhythms rather than one, so the scroll has a pulse: a tight band between two
 * full folds, a loose fold where one idea should own the screen.
 */
export function Section({
  children,
  id,
  className,
  rhythm = "base",
  rule = true,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
  rhythm?: "tight" | "base" | "loose";
  /** The hairline above the section. Off where two bands sit together. */
  rule?: boolean;
  "aria-label"?: string;
}) {
  return (
    <section
      id={id}
      aria-label={ariaLabel}
      className={cn(
        id && "scroll-mt-24",
        rule && "border-t border-border",
        rhythm === "tight" && "py-14 md:py-20",
        rhythm === "base" && "py-24 md:py-36",
        rhythm === "loose" && "py-28 md:py-48",
        className,
      )}
    >
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Surfaces
 * ------------------------------------------------------------------ */

/**
 * The one list marker: a 3px amber dot.
 *
 * It has now been three other things. A check-in-a-disc, which turned every
 * list into the same SaaS feature list; a short amber rule, which at list
 * density read as a page full of dashes; and an icon per item, which was a
 * third chip size. A small dot sits quietly at the start of a line and lets the
 * sentence be the thing you look at, which is the entire job of a bullet.
 */
export function Marker({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/85">
      <span aria-hidden className="mt-[0.6em] size-[3px] shrink-0 rounded-full bg-primary" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/** The same dot, for short horizontal proof lists. One marker language. */
export function Dot() {
  return <span aria-hidden className="size-[3px] shrink-0 rounded-full bg-primary" />;
}

/* ------------------------------------------------------------------ *
 * Calls to action
 * ------------------------------------------------------------------ */

// Focus is the one site-wide ring in globals.css (`:focus-visible`). A second,
// button-only ring language meant two different focus treatments on one page.
const cta =
  "group inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium " +
  "transition-[background-color,border-color,color,box-shadow] duration-200 active:scale-[0.985] " +
  "motion-reduce:active:scale-100";

/** Primary CTA, the amber signal. One per fold, never two. */
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
        "bg-primary text-primary-foreground hover:bg-primary/90",
        "shadow-[0_1px_0_0_oklch(1_0_0/0.25)_inset,0_10px_26px_-14px_oklch(0.72_0.16_58/0.9)]",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Secondary CTA, a quiet hairline with no fill. */
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
        "border border-border text-foreground hover:border-primary/50 hover:bg-foreground/[0.04]",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Tertiary CTA: a text link with a travelling arrow. Every decision point used
 * to offer exactly one filled button and one ghost button, which gives a reader
 * two equally weighted choices and no quiet third option.
 */
export function CTALink({
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
        "group inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline",
        className,
      )}
    >
      {children}
      <ArrowUpRight
        aria-hidden
        className="size-4 text-primary transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
      />
    </Link>
  );
}
