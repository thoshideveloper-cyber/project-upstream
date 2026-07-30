import type { CSSProperties } from "react";
import DottedMap from "dotted-map";

import { Container, Readout, Section, SectionHead } from "./primitives";

/**
 * A fixed decorative arrangement — one origin, arcs out across the map. The
 * coordinates are chosen for the composition and are not labelled anywhere on the
 * page: naming cities would claim an origin and a set of destinations, and both
 * differ for every team.
 */
const HUB = { id: "hub", lat: 19.07, lng: 72.87 };
const SPOKES = [
  { id: "a", lat: 51.51, lng: -0.13 },
  { id: "b", lat: 40.71, lng: -74.01 },
  { id: "c", lat: 1.35, lng: 103.82 },
  { id: "d", lat: 25.2, lng: 55.27 },
  { id: "e", lat: 22.32, lng: 114.17 },
  { id: "f", lat: 50.11, lng: 8.68 },
];

const project = (lat: number, lng: number) => ({
  x: (lng + 180) * (800 / 360),
  y: (90 - lat) * (400 / 180),
});

const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const midX = (a.x + b.x) / 2;
  const midY = Math.min(a.y, b.y) - 55;
  return `M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`;
};

/**
 * The dot grid never changes, so it is built once here — at module scope in a
 * server component, which means at build time for this statically prerendered
 * route. It used to be a `useMemo` in a client component, which shipped all
 * 352 KB of `dotted-map`'s world geometry to the browser to redraw the same
 * decorative background on every visit.
 *
 * Two colourways, because the dot colour is baked into the SVG at build time and
 * cannot read a CSS variable: the white grid was invisible on the light canvas,
 * so the map simply wasn't there in one of the two themes. Both are emitted and
 * the theme class picks one — the geometry is identical, so nothing shifts.
 */
const buildMap = (color: string) => {
  try {
    return new DottedMap({ height: 62, grid: "diagonal" }).getSVG({
      radius: 0.22,
      color,
      shape: "circle",
      backgroundColor: "transparent",
    });
  } catch {
    return "";
  }
};

const MAP_SVG_DARK = buildMap("#FFFFFF28");
const MAP_SVG_LIGHT = buildMap("#0B0B0C26");

export function Reach() {
  const hub = project(HUB.lat, HUB.lng);
  const spokes = SPOKES.map((s) => ({ ...s, p: project(s.lat, s.lng) }));

  return (
    <Section id="reach" motion>
      <Container>
        <SectionHead variant="statement" title="One clock. Every market you work in." />
        <p className="mt-6 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground text-pretty md:text-base">
          Due-dates are computed server-side on one clock your whole team shares, so a date means
          the same thing to everyone, wherever they are.
        </p>

        <div className="relative mt-12 overflow-hidden rounded-xl border border-border bg-card/40 p-5 sm:p-8">
          <div className="relative aspect-[2/1] w-full">
            {[
              { svg: MAP_SVG_LIGHT, show: "block dark:hidden" },
              { svg: MAP_SVG_DARK, show: "hidden dark:block" },
            ].map(({ svg, show }, i) =>
              svg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
                  alt=""
                  aria-hidden
                  className={`pointer-events-none absolute inset-0 h-full w-full object-contain opacity-70 [mask-image:radial-gradient(circle_at_center,black_55%,transparent_92%)] ${show}`}
                />
              ) : null,
            )}

            <svg
              viewBox="0 0 800 400"
              className="absolute inset-0 h-full w-full"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden
            >
              <defs>
                <linearGradient id="arc" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="oklch(0.72 0.16 58)" stopOpacity="0" />
                  <stop offset="50%" stopColor="oklch(0.72 0.16 58)" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="oklch(0.72 0.16 58)" stopOpacity="0" />
                </linearGradient>
              </defs>

              {spokes.map((s, i) => (
                <path
                  key={s.id}
                  d={curve(hub, s.p)}
                  fill="none"
                  stroke="url(#arc)"
                  strokeWidth={1.4}
                  pathLength={1}
                  className="mkt-arc"
                  style={{ "--arc-delay": `${i * 220}ms` } as CSSProperties}
                />
              ))}

              {/* spoke nodes */}
              {spokes.map((s) => (
                <g key={`n-${s.id}`}>
                  <circle cx={s.p.x} cy={s.p.y} r={5} fill="oklch(0.72 0.16 58)" opacity={0.18} />
                  <circle cx={s.p.x} cy={s.p.y} r={2} fill="oklch(0.72 0.16 58)" />
                </g>
              ))}

              {/* hub — CSS, not SVG <animate>: SMIL ignores prefers-reduced-motion */}
              <circle
                cx={hub.x}
                cy={hub.y}
                r={9}
                fill="oklch(0.72 0.16 58)"
                opacity={0.15}
                className="mkt-hub-pulse"
              />
              <circle cx={hub.x} cy={hub.y} r={3} fill="oklch(0.85 0.14 70)" />
            </svg>
          </div>

          <Readout className="mt-4 block text-center">
            One record · every timezone your team works across
          </Readout>
        </div>
      </Container>
    </Section>
  );
}
