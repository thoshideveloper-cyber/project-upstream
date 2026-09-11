"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * The channel: this page's signature, and its structure.
 *
 * One line runs down the left of every fold. It is the river the product is
 * named after and it is also the outreach log, which is the joke the whole
 * product is built on: both only ever run one way, and both only ever get
 * longer. It draws itself as you read, so the page is being written while you
 * are in it, and each fold drops one dated stamp into it, so scrolling down is
 * also time passing on one mandate: 12 March at the top, September at the
 * bottom, and the dates agree with every other date on the page.
 *
 * Two implementation notes worth keeping:
 *
 * **It is laid out, not overlaid.** The rail owns real space at xl and the
 * content is padded past it, so the line can never sit on top of a word. Below
 * xl there is no room for a margin device, so there is no rail at all rather
 * than a squeezed one.
 *
 * **The stroke does not stretch.** The viewBox is scaled with
 * `preserveAspectRatio="none"` so the meander stretches to whatever height the
 * fold turns out to be, but `vector-effect: non-scaling-stroke` keeps the line
 * itself exactly 1.25px in a 200px fold and in a 2000px one.
 */

type Variant = "straight" | "fork" | "pool" | "mouth";

/** The meanders. All start and end at x=20 so consecutive folds join up. */
const PATHS: Record<Variant, string[]> = {
  straight: ["M20 0 C 27 22, 13 58, 20 100"],
  /** The record fold: one mandate becomes two, and they rejoin. */
  fork: [
    "M20 0 C 20 18, 8 26, 8 44 C 8 62, 20 72, 20 100",
    "M20 0 C 20 18, 32 26, 32 44 C 32 62, 20 72, 20 100",
  ],
  /** The interactive fold: the channel widens where the work happens. */
  pool: ["M20 0 C 27 20, 4 40, 4 55 C 4 70, 27 78, 20 100"],
  /** The closing: the line runs out of the page rather than stopping. */
  mouth: ["M20 0 C 25 30, 14 60, 20 100"],
};

function Channel({ variant, stamp }: { variant: Variant; stamp?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Draws across the fold's own passage through the viewport, so the line is
  // always being written just ahead of what is being read.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 92%", "end 40%"],
  });
  const draw = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="absolute top-0 bottom-0 left-0 hidden w-14 xl:block"
      style={{ zIndex: 1 }}
    >
      <svg
        className="u-channel h-full w-full"
        viewBox="0 0 40 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0 }}
      >
        {PATHS[variant].map((d, i) => (
          <path key={`bed-${i}`} className="bed" d={d} vectorEffect="non-scaling-stroke" />
        ))}
        {PATHS[variant].map((d, i) => (
          <motion.path
            key={`draw-${i}`}
            d={d}
            vectorEffect="non-scaling-stroke"
            style={{ pathLength: draw }}
          />
        ))}
      </svg>
      {stamp ? (
        <div className="absolute top-[8%] left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
          <span className="block h-1.5 w-1.5 rounded-full bg-accent" />
          <span
            className="u-mono text-[0.5625rem] tracking-[0.2em] whitespace-nowrap text-fg-muted uppercase"
            style={{ writingMode: "vertical-rl" }}
          >
            {stamp}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A fold. Owns its own channel segment, its own act (surface or deep water),
 * and the padding that keeps the two apart.
 */
export function Fold({
  id,
  children,
  stamp,
  variant = "straight",
  deep = false,
  className,
  bleed = false,
  surfacing = false,
  plate,
}: {
  id?: string;
  children: React.ReactNode;
  stamp?: string;
  variant?: Variant;
  deep?: boolean;
  className?: string;
  /** Set when the fold paints its own full-width ground. */
  bleed?: boolean;
  /** The last fold of the deep act: fades back up to the surface. */
  surfacing?: boolean;
  /** A photographic ground, full width, behind everything. */
  plate?: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative scroll-mt-20",
        deep && "u-deep",
        deep && !surfacing && "u-waterline",
        surfacing && "u-surfacing",
        (bleed || plate) && "overflow-hidden",
        className,
      )}
    >
      {/* Full width, so it sits outside the measure and behind the channel. */}
      {plate}
      {surfacing ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
          style={{ background: "linear-gradient(to bottom, transparent, var(--mist))" }}
        />
      ) : null}
      <div className="relative mx-auto w-full max-w-[84rem] px-6 sm:px-8 lg:px-12 xl:pl-[5.5rem]">
        <Channel variant={variant} stamp={stamp} />
        <div className="relative" style={{ zIndex: 2 }}>
          {children}
        </div>
      </div>
    </section>
  );
}
