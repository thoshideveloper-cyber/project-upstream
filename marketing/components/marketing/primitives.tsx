import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

import { MotionSection } from "@/components/motion-section";
import { cn } from "@/lib/utils";
import { Lit } from "./lit";

/**
 * The page's shared shell vocabulary.
 *
 * The previous version of this file solved a real problem — six card shells, five
 * mono letter-spacings, three section rules — by giving every section the same
 * opener (tiny tracked uppercase kicker → display heading → lede), the same card
 * (`rounded-2xl border bg-card/40 p-6` + hover-lift), the same list marker (an
 * amber check in a disc) and the same vertical rhythm. Consistent, and uniform:
 * nine sections that open identically read as a template, not as a page.
 *
 * So the scale is still decided once, but it now offers *shapes* rather than one
 * shape. A section picks a `SectionHead` variant; the page is composed so no two
 * adjacent sections pick the same one. The kicker survives on exactly two
 * sections, where it is naming a real thing, and nowhere else.
 *
 * The scale, once:
 *   width          Container (6xl) · Container wide (7xl) · Measure (prose)
 *   rhythm         py-20 / py-28 md:py-32 / py-32 md:py-44   (tight/base/loose)
 *   rule           border-t border-border                    (one token, never /60)
 *   section h2     Display                    clamp, wdth 112
 *   panel h3       Subhead                    text-lg/xl, wdth 106
 *   lede           text-[15px] md:text-base   max-w-[62ch]
 *   body           text-sm leading-relaxed
 *   readout        Readout — mono 11px, tracking 0.18em, tabular
 *   panel          Panel — rounded-xl, hairline, pointer-lit; never nested
 *   list marker    Marker — a 10px amber gauge tick, not a check-in-a-disc
 */

/* ------------------------------------------------------------------ *
 * Measure
 * ------------------------------------------------------------------ */

/** Page-width container. `wide` for the two sections that need the extra room. */
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
        "mx-auto w-full px-5 sm:px-6 md:px-8",
        wide ? "max-w-7xl" : "max-w-6xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Type
 * ------------------------------------------------------------------ */

/**
 * Section and page headings. Wide-cut Archivo — signage, not a magazine
 * masthead. Fluid so the ceiling holds on a laptop and the floor stays readable
 * on a phone; the h1 tops out at 4.6rem, well under the 6rem shouting line.
 */
export function Display({
  children,
  className,
  as: Tag = "h2",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "p";
}) {
  return (
    <Tag
      className={cn(
        "mkt-display font-semibold text-foreground",
        // The h1 sits in a ~30rem column beside the queue panel, so its ceiling
        // is set by that measure, not by the viewport: at 4.6rem it ran to six
        // lines and stopped being a headline.
        Tag === "h1"
          ? "text-[clamp(2.15rem,4vw,3.35rem)]"
          : "text-[clamp(1.85rem,3.4vw,2.85rem)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** Panel / row heading — one size, one width, everywhere below section level. */
export function Subhead({
  children,
  className,
  as: Tag = "h3",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h3" | "h4" | "p";
}) {
  return (
    <Tag className={cn("mkt-subhead text-lg leading-snug font-semibold text-foreground", className)}>
      {children}
    </Tag>
  );
}

/** Section lede — one or two lines, capped at a reading measure. */
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
 * column headers — the things the product itself prints in mono. Never prose.
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
        "font-mono text-[11px] font-medium tracking-[0.18em] uppercase",
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

/* ------------------------------------------------------------------ *
 * Section shell
 * ------------------------------------------------------------------ */

/**
 * A page section: the rule above it and the vertical rhythm inside it. Three
 * rhythms rather than one, so the scroll has a pulse — a band between two full
 * sections, a loose section where one idea should own the fold.
 *
 * `motion` renders a MotionSection instead, for sections that own a looping
 * animation and need to know when they're on screen.
 */
export function Section({
  children,
  id,
  className,
  rhythm = "base",
  rule = true,
  motion = false,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
  rhythm?: "tight" | "base" | "loose";
  /** The hairline above the section. Off where two bands sit together. */
  rule?: boolean;
  motion?: boolean;
  "aria-label"?: string;
}) {
  const classes = cn(
    id && "scroll-mt-28",
    rule && "border-t border-border",
    rhythm === "tight" && "py-14 md:py-20",
    rhythm === "base" && "py-24 md:py-32",
    rhythm === "loose" && "py-28 md:py-44",
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
 * How a section opens. Three shapes, chosen per section so the scroll doesn't
 * repeat itself:
 *
 *  - `stack`     heading over lede, left. The quiet default.
 *  - `split`     heading left, lede right of a hairline. For sections where the
 *                lede is a caveat or a counter-claim, not a subtitle.
 *  - `statement` heading alone, wide, no lede. For the two turns in the argument
 *                that should own the fold by themselves.
 *
 * `kicker` is deliberately rare — two on the page, both naming something real.
 * A tracked uppercase label above *every* heading is scaffolding, not voice.
 */
export function SectionHead({
  title,
  children,
  kicker,
  variant = "stack",
  className,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  kicker?: string;
  variant?: "stack" | "split" | "statement";
  className?: string;
}) {
  if (variant === "statement") {
    return (
      <div className={cn("max-w-4xl", className)}>
        {kicker && <Readout className="mb-5 block">{kicker}</Readout>}
        <Display>{title}</Display>
      </div>
    );
  }

  if (variant === "split") {
    return (
      <div
        className={cn(
          "grid gap-6 border-b border-border pb-10 md:grid-cols-[1.15fr_1fr] md:items-end md:gap-12",
          className,
        )}
      >
        <div>
          {kicker && <Readout className="mb-4 block">{kicker}</Readout>}
          <Display>{title}</Display>
        </div>
        {children && <Lede className="md:pb-1">{children}</Lede>}
      </div>
    );
  }

  return (
    <div className={cn("max-w-3xl", className)}>
      {kicker && <Readout className="mb-4 block">{kicker}</Readout>}
      <Display>{title}</Display>
      {children && <Lede className="mt-5">{children}</Lede>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Surfaces
 * ------------------------------------------------------------------ */

/**
 * The one panel shell — and it is used sparingly. Most of the page is ruled
 * rows and open grids now, because a card only earns its border when elevation
 * says something. Never nest one inside another.
 */
export function Panel({
  children,
  className,
  style,
  lit = true,
  as = "article",
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Pointer-tracked edge light. Off for panels that aren't in a grid. */
  lit?: boolean;
  as?: "article" | "div" | "figure" | "li" | "section";
}) {
  const classes = cn(
    "flex flex-col rounded-xl border border-border bg-card/40 p-5 md:p-6",
    className,
  );
  if (!lit) {
    const Tag = as;
    return (
      <Tag className={classes} style={style}>
        {children}
      </Tag>
    );
  }
  return (
    <Lit as={as} className={classes} style={style}>
      {children}
    </Lit>
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
        "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-foreground/[0.03]",
        className,
      )}
    >
      <Icon
        aria-hidden
        strokeWidth={1.75}
        className={cn("size-4", tone === "primary" ? "text-primary" : "text-muted-foreground")}
      />
    </span>
  );
}

/**
 * The one list marker: a short amber rule, like a tick on a gauge face. The
 * check-in-a-disc it replaces appeared about thirty times down the page and
 * turned every list into the same SaaS feature list.
 */
export function Marker({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm leading-relaxed text-foreground/85">
      <span aria-hidden className="mt-[0.62em] h-px w-2.5 shrink-0 bg-primary" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/** A ruled-off closing line inside a panel — the single amber beat per panel. */
export function Beat({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 border-t border-border pt-4 text-sm font-medium text-foreground/90">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ *
 * Calls to action
 * ------------------------------------------------------------------ */

// Focus is the one site-wide ring in globals.css (`:focus-visible`) — a second,
// button-only ring language meant two different focus treatments on one page.
const cta =
  "group inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium " +
  "transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.985]";

/** Primary CTA — the amber signal. One per fold, never two. */
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
      className={cn(cta, "bg-primary text-primary-foreground hover:bg-primary/90", className)}
    >
      {children}
    </Link>
  );
}

/** Secondary CTA — quiet hairline, no fill. */
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
 * Tertiary CTA — a text link with a travelling arrow. The page used to offer
 * exactly one filled button and one ghost button at every decision point, which
 * gives a reader two equally-weighted choices and no quiet third option.
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
        className="size-4 text-primary transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      />
    </Link>
  );
}
