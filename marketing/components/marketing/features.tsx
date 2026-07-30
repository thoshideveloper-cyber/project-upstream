"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { BarChart3, Building2, CalendarClock, type LucideIcon } from "lucide-react";

import { ASSET_PREFIX, MODULES } from "@/content/site";
import { cn } from "@/lib/utils";
import { SheetsToSystem } from "./mechanism";
import { Container, Marker, Readout, Section, SectionHead, Subhead } from "./primitives";

/** Icon per module id. Content lives in content/site.ts; the glyph stays here. */
const ICONS: Record<string, LucideIcon> = {
  registry: Building2,
  outreach: CalendarClock,
  analytics: BarChart3,
};

/**
 * Three modules, one screen each.
 *
 * The tabs were three loose pills that each drew their own border when selected;
 * nothing connected them, so the group didn't read as one control. This is a
 * single track with one amber capsule that travels — the segmented control the
 * product's own filter bars use. The panel behind it is the section now: the
 * screenshot runs full-bleed to the panel edge and the copy is held to a narrow
 * column beside it, because the screen is the claim and the bullets are the
 * footnote.
 *
 * Keyboard semantics are unchanged: a real tablist, arrow keys move between tabs,
 * only the selected tab is a tab stop, each is wired to the panel it controls.
 */
export function Features() {
  const [active, setActive] = useState(MODULES[0].id);
  const feature = MODULES.find((f) => f.id === active) ?? MODULES[0];

  const trackRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  const measure = useCallback(() => {
    const el = tabRefs.current[active];
    if (!el || !trackRef.current) return;
    setPill({ x: el.offsetLeft, w: el.offsetWidth });
  }, [active]);

  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <Section id="product" motion>
      <Container wide>
        <SectionHead kicker="Three of the modules" title="The sheets you already run, connected.">
          The list of who you&apos;re working, the schedule of who to reach, and the people you
          actually know — joined up so the numbers finally agree.
        </SectionHead>

        {/* The mechanism, before the claims: the sheets converging into one system. */}
        <SheetsToSystem />

        <div
          ref={trackRef}
          role="tablist"
          aria-label="Product areas"
          className="relative mt-14 inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-border bg-card/40 p-1"
        >
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-1 rounded-lg bg-primary/12 ring-1 ring-primary/30 transition-all duration-300 ease-out",
              pill ? "opacity-100" : "opacity-0",
            )}
            style={pill ? { transform: `translateX(${pill.x - 4}px)`, width: pill.w } : { width: 0 }}
          />
          {MODULES.map((f, i) => {
            const Icon = ICONS[f.id] ?? Building2;
            const on = f.id === active;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                id={`feature-tab-${f.id}`}
                ref={(n) => {
                  tabRefs.current[f.id] = n;
                }}
                aria-selected={on}
                aria-controls="feature-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(f.id)}
                onKeyDown={(e) => {
                  const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                  if (!dir) return;
                  e.preventDefault();
                  const next = MODULES[(i + dir + MODULES.length) % MODULES.length];
                  setActive(next.id);
                  document.getElementById(`feature-tab-${next.id}`)?.focus();
                }}
                className={cn(
                  "relative inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-200",
                  on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  aria-hidden
                  strokeWidth={1.75}
                  className={cn("size-4", on ? "text-primary" : "text-muted-foreground")}
                />
                {f.tab}
              </button>
            );
          })}
        </div>

        <div
          id="feature-panel"
          role="tabpanel"
          aria-labelledby={`feature-tab-${feature.id}`}
          tabIndex={0}
          className="mt-6 grid overflow-hidden rounded-xl border border-border bg-card/40 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]"
        >
          <div className="flex flex-col justify-center p-6 md:p-8">
            <Subhead className="text-xl">{feature.title}</Subhead>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
              {feature.blurb}
            </p>
            <ul className="mt-7 space-y-3 border-t border-border pt-6">
              {feature.bullets.map((b) => (
                <Marker key={b}>{b}</Marker>
              ))}
            </ul>
          </div>

          {/* The screen itself, framed like a window onto the app. */}
          <div className="relative border-t border-border bg-background lg:border-t-0 lg:border-l">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="size-1.5 rounded-full bg-muted-foreground/30" />
              <span className="size-1.5 rounded-full bg-muted-foreground/30" />
              <span className="size-1.5 rounded-full bg-muted-foreground/30" />
              <Readout className="ml-2 text-[10px] tracking-[0.14em] normal-case">
                {feature.caption}
              </Readout>
            </div>
            <div className="relative aspect-[16/10] w-full">
              <Image
                key={feature.image}
                src={`${ASSET_PREFIX}${feature.image}`}
                alt={`${feature.tab} — ${feature.blurb}`}
                fill
                sizes="(max-width: 1024px) 100vw, 800px"
                className="object-cover object-left-top"
                /* Below the fold: `priority` was emitting a high-priority preload
                   that competed with the hero. The aspect box already reserves the
                   space, so there is nothing to shift. */
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
