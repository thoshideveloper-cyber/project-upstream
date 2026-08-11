"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";

import { ASSET_PREFIX, SHIPPED_POOL, SURFACES } from "@/content/site";
import { cn } from "@/lib/utils";
import { EASE, SPRING } from "@/components/motion/primitives";
import { Container, Display, Gutter, Lede, Readout, Section, Stamp, Subhead } from "./primitives";

/**
 * The desk. The product, shown.
 *
 * The previous page argued about a dense operational tool for nine thousand
 * pixels and never once showed it, while three real screenshots sat unused in
 * `public/product/`. That is the single largest conversion hole a page like
 * this can have: an analyst deciding whether to move a live mandate off a
 * spreadsheet needs to see the thing they would be moving it into, and no
 * amount of prose substitutes. "I can picture myself using this" is a step in
 * the argument, not a nice-to-have.
 *
 * These are captures of the running app against its seeded demo firm. Nothing
 * is a rendering, nothing is a Figma frame, and the caption says so, because a
 * dressed-up mockup is worth less than an honest screenshot to exactly the
 * audience this page is for.
 *
 * The image is cropped at the bottom rather than framed. A screenshot floating
 * in white space with a fake browser chrome around it reads as a picture of
 * software; one that runs out of the frame reads as a window onto a screen that
 * continues, which is the truth.
 */
export function Desk() {
  const [active, setActive] = useState(0);
  const surface = SURFACES[active];
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Roving focus. A tablist that only responds to clicks is a tablist a
  // keyboard user has to tab through item by item to reach the third panel.
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const last = SURFACES.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = active === last ? 0 : active + 1;
    if (e.key === "ArrowLeft") next = active === 0 ? last : active - 1;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }, [active]);

  return (
    <Section id="desk" rhythm="base" className="overflow-clip">
      <Container wide>
        <Gutter stamp="02 / The desk">
          <div className="grid gap-6 md:grid-cols-[1.1fr_1fr] md:items-end md:gap-12">
            <Display>
              This is the desk. <span className="mkt-turn">There is no fourth screen.</span>
            </Display>
            <Lede className="md:pb-1">
              Three surfaces and one book behind them. Captures of the running application against
              the demo firm it ships with, not renderings.
            </Lede>
          </div>

          {/* ── The selector ─────────────────────────────────────────────── */}
          <div
            role="tablist"
            aria-label="Product surfaces"
            onKeyDown={onKeyDown}
            className="mt-14 flex snap-x items-center overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {SURFACES.map((s, i) => {
              const on = i === active;
              return (
                <button
                  key={s.id}
                  ref={(n) => {
                    tabRefs.current[i] = n;
                  }}
                  role="tab"
                  id={`desk-tab-${s.id}`}
                  aria-selected={on}
                  aria-controls={`desk-panel-${s.id}`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setActive(i)}
                  className={cn(
                    "relative shrink-0 snap-start px-4 py-3.5 text-sm whitespace-nowrap transition-colors duration-200 first:pl-0 md:text-[15px]",
                    on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="mr-2.5 font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.tab}
                  {on && (
                    // One indicator that travels, not three that fade. The
                    // movement is the thing that says these are one control.
                    <motion.span
                      layoutId="desk-indicator"
                      aria-hidden
                      className="absolute inset-x-0 -bottom-px h-px bg-primary"
                      transition={SPRING}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── The panel ────────────────────────────────────────────────── */}
          <div
            role="tabpanel"
            id={`desk-panel-${surface.id}`}
            aria-labelledby={`desk-tab-${surface.id}`}
            className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-16"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={surface.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <Subhead className="text-[1.4rem] md:text-[1.6rem]">{surface.title}</Subhead>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {surface.detail}
                </p>

                {/* The margin notes. A description list, because that is what
                    this is: a term and what it means on this screen. */}
                <dl className="mt-8 space-y-4 border-t border-border pt-6">
                  {surface.notes.map((n) => (
                    <div key={n.label} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4">
                      <dt>
                        <Readout tone="signal">{n.label}</Readout>
                      </dt>
                      <dd className="text-[13px] leading-relaxed text-muted-foreground text-pretty">
                        {n.text}
                      </dd>
                    </div>
                  ))}
                </dl>
              </motion.div>
            </AnimatePresence>

            <div className="relative">
              <AnimatePresence mode="wait" initial={false}>
                <motion.figure
                  key={surface.id}
                  initial={{ opacity: 0, scale: 1.015 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.995 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="mkt-elev relative overflow-hidden rounded-lg border border-border bg-card"
                >
                  {/* Cropped, not framed: the shot dissolves at the bottom
                      rather than ending in a tidy edge, because the real screen
                      does not end there either. */}
                  <div className="[mask-image:linear-gradient(to_bottom,black_72%,transparent)]">
                    <Image
                      src={`${ASSET_PREFIX}${surface.src}`}
                      alt={surface.alt}
                      width={1200}
                      height={750}
                      sizes="(min-width: 1024px) 60vw, 100vw"
                      className="block w-full"
                      priority={false}
                    />
                  </div>
                </motion.figure>
              </AnimatePresence>
            </div>
          </div>

          <figcaption className="mt-6 text-xs leading-relaxed text-muted-foreground lg:ml-[calc(21rem+4rem)]">
            The demo firm that ships with the application. Company names are real organisations;
            the analysts, the mandates and every figure on these screens are seeded demo data.
          </figcaption>

          {/* ── The one fact worth a band of its own ─────────────────────── */}
          <ShippedPool />
        </Gutter>
      </Container>
    </Section>
  );
}

/**
 * The company database, given a band.
 *
 * This is the only number on the page that is neither a mock nor a claim about
 * results: `backend/app/data/company_pool.py` really does ship 164 verified
 * organisations, and `services/pool.seed_firm_pool` really does plant a copy
 * for every firm at signup. It answers the objection that kills most CRM
 * evaluations in week one, which is that the thing is an empty box until
 * somebody spends a fortnight filling it.
 *
 * The absence is worth as much as the count, so it is stated: no revenue, no
 * headcount, because those were not verifiable and inventing them would have
 * made the whole database untrustworthy.
 */
function ShippedPool() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="mt-16 grid gap-8 border-t border-border pt-10 md:grid-cols-[auto_minmax(0,1fr)] md:items-start md:gap-16"
    >
      <div className="flex items-baseline gap-3">
        <span className="mkt-display text-[clamp(3rem,7vw,4.75rem)] text-primary-ink tabular-nums">
          {SHIPPED_POOL.count}
        </span>
        <Stamp className="max-w-[11rem] leading-relaxed">{SHIPPED_POOL.label}</Stamp>
      </div>
      <p className="max-w-[58ch] text-sm leading-relaxed text-muted-foreground text-pretty md:pt-4">
        {SHIPPED_POOL.detail}
      </p>
    </motion.div>
  );
}
