"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";

import { ASSET_PREFIX, DESK_HEAD, DESK_LEDE, SURFACES } from "@/content/site";
import { Fold } from "./fold";
import { Reveal, Stamp } from "./primitives";
import { cn } from "@/lib/utils";

/**
 * The desk: the product, shown.
 *
 * A previous version of this page argued about a dense operational tool for
 * nine thousand pixels without once showing it, which left "I can picture
 * myself using this on a Tuesday" entirely to the reader's imagination. The
 * screenshots do work no amount of prose does, and everything after them is
 * read differently because of it.
 *
 * The shape is a held frame: the reader scrolls through three captions on the
 * left while one screen stays pinned on the right and changes under them. It is
 * the only fold on the page that pins anything after the hero, which is what
 * makes it feel like the moment the page stops talking and points.
 */
export function Desk() {
  const [active, setActive] = useState(0);

  return (
    <Fold id="desk" stamp="26 Mar · follow-up 1" className="py-28 lg:py-36">
      <Reveal className="max-w-[36rem]">
        <Stamp>The product</Stamp>
        <h2 className="u-display mt-4 text-[clamp(1.75rem,3.4vw,3rem)] leading-[1.06]">
          {DESK_HEAD}
        </h2>
        <p className="u-mono mt-4 text-[0.8125rem] text-fg-muted">{DESK_LEDE}</p>
      </Reveal>

      <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-16">
        {/* The captions, one per screen. */}
        <div>
          {SURFACES.map((s, i) => (
            <Caption key={s.id} index={i} onEnter={setActive} active={active === i} surface={s} />
          ))}
        </div>

        {/* The held frame. Sticky on wide screens; on narrow ones each caption
            carries its own shot inline, because a pinned screenshot on a phone
            is a screenshot nobody can see next to its words. */}
        <div className="hidden lg:block">
          <div className="sticky top-[16vh]">
            <div className="u-elev relative aspect-[1200/750] overflow-hidden rounded-lg border border-hair bg-[color:var(--raised)]">
              {SURFACES.map((s, i) => (
                <Image
                  key={s.id}
                  src={`${ASSET_PREFIX}${s.src}`}
                  alt={s.alt}
                  width={1200}
                  height={750}
                  className={cn(
                    "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
                    active === i ? "opacity-100" : "opacity-0",
                  )}
                  priority={i === 0}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              {SURFACES.map((s, i) => (
                <span
                  key={s.id}
                  aria-hidden
                  className={cn(
                    "h-px flex-1 transition-colors duration-500",
                    active === i ? "bg-accent" : "bg-[color:var(--hair)]",
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Fold>
  );
}

function Caption({
  surface,
  index,
  active,
  onEnter,
}: {
  surface: (typeof SURFACES)[number];
  index: number;
  active: boolean;
  onEnter: (i: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.6, margin: "-20% 0px -20% 0px" });
  // In an effect, not in render: setting a parent's state while rendering a
  // child is the "cannot update a component while rendering" warning, and in
  // React 19 it is a real re-entrancy bug rather than a style note.
  useEffect(() => {
    if (inView) onEnter(index);
  }, [inView, index, onEnter]);

  return (
    <div ref={ref} className="border-t border-hair py-10 first:border-t-0 lg:min-h-[62vh] lg:py-16">
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            "block h-1.5 w-1.5 rounded-full transition-colors duration-500",
            active ? "bg-accent" : "bg-[color:var(--hair)]",
          )}
        />
        <Stamp className="text-fg">{surface.tab}</Stamp>
      </div>
      <h3 className="u-subhead mt-3 text-[clamp(1.25rem,2vw,1.625rem)]">{surface.title}</h3>
      <p className="mt-3 max-w-[44ch] leading-relaxed text-fg-muted">{surface.detail}</p>

      <Image
        src={`${ASSET_PREFIX}${surface.src}`}
        alt={surface.alt}
        width={1200}
        height={750}
        className="u-elev mt-6 w-full rounded-lg border border-hair lg:hidden"
      />

      <dl className="mt-6 space-y-2">
        {surface.notes.map((n) => (
          <div key={n.label} className="flex gap-3 text-[0.8125rem]">
            <dt className="u-mono w-[7.5rem] shrink-0 text-fg-muted">{n.label}</dt>
            <dd className="text-fg-muted">{n.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
