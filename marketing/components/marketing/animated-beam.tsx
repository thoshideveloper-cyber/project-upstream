"use client";

import { useCallback, useEffect, useState, type CSSProperties, type RefObject } from "react";

import { cn } from "@/lib/utils";

export type Beam = {
  /** Node the beam leaves from. */
  from: RefObject<HTMLElement | null>;
  /** Node the beam arrives at. */
  to: RefObject<HTMLElement | null>;
  /** Stagger, in ms, so the packets don't travel in lockstep. */
  delay?: number;
};

/**
 * Measured beam overlay — an SVG absolutely positioned over a relative container,
 * drawing a hairline rail between each pair of DOM nodes with an amber packet
 * travelling along it (`.mkt-beam-*` in globals.css).
 *
 * Positions are measured from the live DOM rather than hard-coded, so the same
 * beams follow the nodes when the layout flips from a column on mobile to a row
 * on desktop. The connector picks its axis from the dominant delta: a horizontal
 * S-curve when the nodes sit side by side, a vertical one when they're stacked.
 *
 * Decorative: `aria-hidden`, and under `prefers-reduced-motion` the packet stops
 * and the rail simply reads as a static amber trace (see globals.css).
 */
export function AnimatedBeams({
  containerRef,
  beams,
  duration = 3.2,
  className,
}: {
  containerRef: RefObject<HTMLElement | null>;
  /** Must be referentially stable (refs are — memoise the array). */
  beams: Beam[];
  /** Seconds for one packet to travel the rail. */
  duration?: number;
  className?: string;
}) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [paths, setPaths] = useState<string[]>([]);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const c = container.getBoundingClientRect();
    if (!c.width || !c.height) return;

    const next = beams.map(({ from, to }) => {
      const a = from.current;
      const b = to.current;
      if (!a || !b) return "";

      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      // Container-local centres.
      const acx = ar.left + ar.width / 2 - c.left;
      const acy = ar.top + ar.height / 2 - c.top;
      const bcx = br.left + br.width / 2 - c.left;
      const bcy = br.top + br.height / 2 - c.top;

      const horizontal = Math.abs(bcx - acx) >= Math.abs(bcy - acy);
      // Leave from the edge that faces the target, arrive at the facing edge.
      const sx = horizontal ? ar.right - c.left : acx;
      const sy = horizontal ? acy : ar.bottom - c.top;
      const ex = horizontal ? br.left - c.left : bcx;
      const ey = horizontal ? bcy : br.top - c.top;

      const c1 = horizontal ? [sx + (ex - sx) / 2, sy] : [sx, sy + (ey - sy) / 2];
      const c2 = horizontal ? [ex - (ex - sx) / 2, ey] : [ex, ey - (ey - sy) / 2];

      return `M ${sx} ${sy} C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${ex} ${ey}`;
    });

    setBox({ w: c.width, h: c.height });
    setPaths(next);
  }, [beams, containerRef]);

  useEffect(() => {
    measure();

    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    for (const { from, to } of beams) {
      if (from.current) ro.observe(from.current);
      if (to.current) ro.observe(to.current);
    }
    window.addEventListener("resize", measure);
    // Re-measure once webfonts land — the cards resize as Cormorant/Outfit swap in.
    document.fonts?.ready.then(measure).catch(() => {});

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [beams, containerRef, measure]);

  return (
    <svg
      aria-hidden
      fill="none"
      viewBox={box ? `0 0 ${box.w} ${box.h}` : undefined}
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-700",
        box ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      {paths.map((d, i) =>
        d ? (
          <g key={i}>
            <path d={d} className="mkt-beam-rail" />
            <path
              d={d}
              pathLength={1}
              className="mkt-beam-pulse"
              style={
                {
                  "--beam-dur": `${duration}s`,
                  "--beam-delay": `${beams[i].delay ?? 0}ms`,
                } as CSSProperties
              }
            />
          </g>
        ) : null,
      )}
    </svg>
  );
}
