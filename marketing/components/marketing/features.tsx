"use client";

import { useState } from "react";
import Image from "next/image";
import { BarChart3, Building2, CalendarClock, type LucideIcon } from "lucide-react";

import { ASSET_PREFIX, MODULES } from "@/content/site";
import { cn } from "@/lib/utils";
import { SheetsToSystem } from "./mechanism";
import { CardTitle, CheckItem, Container, Section, SectionIntro } from "./primitives";

/** Icon per module id. Content lives in content/site.ts; the glyph stays here. */
const ICONS: Record<string, LucideIcon> = {
  registry: Building2,
  outreach: CalendarClock,
  analytics: BarChart3,
};

const FEATURES = MODULES;

export function Features() {
  const [active, setActive] = useState(FEATURES[0].id);
  const feature = FEATURES.find((f) => f.id === active) ?? FEATURES[0];

  return (
    <Section id="product" motion>
      <Container>
        <SectionIntro eyebrow="The system" title="The sheets you already run, connected.">
          The list of who you&apos;re working, the schedule of who to reach, and the people you
          actually know — joined up so the numbers finally agree.
        </SectionIntro>

        {/* The mechanism, before the claims: the sheets converging into one system. */}
        <SheetsToSystem />

        {/* Tab bar — a real tablist: arrow keys move between tabs, only the active
            one is a tab stop, and each is wired to the panel it controls. */}
        <div role="tablist" aria-label="Product areas" className="mt-14 flex flex-wrap gap-2">
          {FEATURES.map((f, i) => {
            const Icon = ICONS[f.id] ?? Building2;
            const on = f.id === active;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                id={`feature-tab-${f.id}`}
                aria-selected={on}
                aria-controls="feature-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(f.id)}
                onKeyDown={(e) => {
                  const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                  if (!dir) return;
                  e.preventDefault();
                  const next = FEATURES[(i + dir + FEATURES.length) % FEATURES.length];
                  setActive(next.id);
                  document.getElementById(`feature-tab-${next.id}`)?.focus();
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-all",
                  on
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border bg-foreground/[0.02] text-muted-foreground hover:border-border hover:bg-foreground/[0.05] hover:text-foreground",
                )}
              >
                <Icon aria-hidden className={cn("size-4", on ? "text-primary" : "text-muted-foreground")} />
                {f.tab}
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <div
          id="feature-panel"
          role="tabpanel"
          aria-labelledby={`feature-tab-${feature.id}`}
          tabIndex={0}
          className="mt-8 grid gap-8 rounded-2xl border border-border bg-card/40 p-6 md:grid-cols-[0.85fr_1.15fr] md:p-7 lg:gap-12"
        >
          <div className="flex flex-col justify-center">
            <CardTitle>{feature.title}</CardTitle>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground text-pretty">
              {feature.blurb}
            </p>
            <ul className="mt-6 space-y-3">
              {feature.bullets.map((b) => (
                <CheckItem key={b}>{b}</CheckItem>
              ))}
            </ul>
          </div>

          {/* Framed product shot */}
          <div className="mkt-elev overflow-hidden rounded-xl border border-border bg-background">
            <div className="flex items-center gap-1.5 border-b border-border/60 px-3 py-2">
              <span className="size-2 rounded-full bg-muted-foreground/25" />
              <span className="size-2 rounded-full bg-muted-foreground/25" />
              <span className="size-2 rounded-full bg-muted-foreground/25" />
              <span className="ml-2 font-mono text-[10px] tracking-[0.15em] text-muted-foreground">
                {feature.caption}
              </span>
            </div>
            <div className="relative aspect-[16/10] w-full">
              <Image
                key={feature.image}
                src={`${ASSET_PREFIX}${feature.image}`}
                alt={feature.tab}
                fill
                sizes="(max-width: 768px) 100vw, 640px"
                className="object-cover object-left-top"
                /* Five sections below the fold: `priority` was emitting a high-priority
                   <link rel=preload> that competed with the hero. The aspect box
                   already reserves the space, so there is nothing to shift. */
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
