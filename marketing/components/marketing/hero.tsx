"use client";

import { useCallback, useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";

import { CTA_HREF } from "@/content/site";
import { cn } from "@/lib/utils";
import { Container, CTAGhost, CTAPrimary, Display, Dot, Readout } from "./primitives";

/**
 * The fold is the product, not a picture of it.
 *
 * The panel on the right is one team's Tuesday drawn to scale: the strip sums to
 * the queue (2 + 1 + 6 + 29 = 38) and LATE matches the two overdue rows, so it
 * reads as a screen rather than as decoration. Organisation and person names are
 * invented — nothing here is a claim about anyone's pipeline — but they are
 * invented to sound like a real book of business, because "Acme Corp / Jane Doe"
 * makes a product look like a demo of itself.
 *
 * The composition is deliberately lopsided: the copy is held to a 26rem column
 * and the queue takes everything else. A 50/50 hero would give equal weight to
 * the claim and the evidence, and the evidence is the stronger of the two.
 */
const ROWS = [
  { days: "12d", tone: "over", org: "Ardent Materials", meta: "Project Kestrel · Priya Raghavan", pill: "Interested", pillTone: "signal", flag: true },
  { days: "5d", tone: "over", org: "Halvorsen Industrial", meta: "Project Kestrel · Tomás Ferreira", pill: "Overdue", pillTone: "over", flag: false },
  { days: "Today", tone: "due", org: "Bright Ridge Systems", meta: "Project Kestrel · Amara Okonkwo", pill: "Due today", pillTone: "due", flag: false },
  { days: "+2d", tone: "ok", org: "Calder Speciality", meta: "Project Nordhaven · Wei Zhang", pill: "Contacted", pillTone: "quiet", flag: false },
  { days: "+9d", tone: "ok", org: "Lindqvist Labs", meta: "Project Nordhaven · Dan Mercer", pill: "Contacted", pillTone: "quiet", flag: false },
  { days: "+14d", tone: "ok", org: "Ostrow Chemical", meta: "Project Nordhaven · Fatima Al-Hassan", pill: "Sourced", pillTone: "quiet", flag: false },
] as const;

const STRIP = [
  { label: "All", n: "38", tone: "ink" },
  { label: "Late", n: "2", tone: "over" },
  { label: "Today", n: "1", tone: "due" },
  { label: "Soon", n: "6", tone: "muted" },
  { label: "Ahead", n: "29", tone: "signal" },
] as const;

const PROOF = ["Append-only log", "Computed cadence", "Cross-mandate memory"];

const toneText: Record<string, string> = {
  over: "text-destructive",
  due: "text-primary-ink",
  ok: "text-muted-foreground",
  muted: "text-muted-foreground",
  ink: "text-foreground",
  signal: "text-[var(--signal)]",
};

const pillClass: Record<string, string> = {
  over: "border-destructive/30 bg-destructive/10 text-destructive",
  due: "border-primary/30 bg-primary/10 text-primary-ink",
  signal: "border-[color-mix(in_oklch,var(--signal)_30%,transparent)] bg-[color-mix(in_oklch,var(--signal)_12%,transparent)] text-[var(--signal)]",
  quiet: "border-border bg-foreground/[0.03] text-muted-foreground",
};

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const raf = useRef(0);

  // The beacon is a paint, not state: writing custom properties to the section
  // keeps a mousemove from ever touching React.
  const onMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || raf.current) return;
    const { clientX, clientY } = e;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--sx", `${((clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty("--sy", `${((clientY - r.top) / r.height) * 100}%`);
    });
  }, []);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <section
      ref={ref}
      onPointerMove={onMove}
      className="relative overflow-hidden pt-28 pb-16 sm:pt-32 md:pt-40 md:pb-24"
    >
      <div aria-hidden className="mkt-grid pointer-events-none absolute inset-0 opacity-60" />
      <div aria-hidden className="mkt-beacon" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background"
      />

      <Container wide className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
          {/* Claim */}
          <div>
            <Readout tone="signal" className="block">
              Origination and outreach, for M&amp;A desks
            </Readout>

            <Display as="h1" className="mt-5">
              Every follow-up on schedule. Every relationship on record.
            </Display>

            <p className="mt-6 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground text-pretty md:text-base">
              Boutique desks run origination on three spreadsheets and an inbox. Upstream is
              those three sheets joined up: the master list, the follow-up cadence and the
              contact history, held by the firm rather than by whoever happens to still work
              here.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <CTAPrimary href={CTA_HREF}>
                Book a demo
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </CTAPrimary>
              <CTAGhost href={CTA_HREF}>See the live demo</CTAGhost>
            </div>

            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2.5 border-t border-border pt-5">
              {PROOF.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <Dot />
                  <Readout>{p}</Readout>
                </li>
              ))}
            </ul>
          </div>

          {/* Evidence — the outreach queue as it actually looks */}
          <div className="mkt-sheen mkt-elev overflow-hidden rounded-xl border border-border bg-card/60 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
              <span className="flex items-center gap-2.5">
                <span className="mkt-live size-1.5 rounded-full bg-primary" />
                <Readout tone="ink">Outreach queue</Readout>
              </span>
              <Readout className="hidden sm:inline">Today · your timezone</Readout>
            </div>

            {/* Triage strip: the whole queue, split by how late it is */}
            <div className="grid grid-cols-5 divide-x divide-border border-b border-border">
              {STRIP.map((s) => (
                <div key={s.label} className="px-2 py-3 text-center sm:px-3">
                  <div className={cn("font-mono text-lg font-semibold sm:text-xl", toneText[s.tone])}>
                    {s.n}
                  </div>
                  <Readout className="mt-1 block text-[10px] tracking-[0.14em]">{s.label}</Readout>
                </div>
              ))}
            </div>

            <ul className="divide-y divide-border">
              {ROWS.map((r) => (
                <li
                  key={r.org}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.025]"
                >
                  <span
                    className={cn(
                      "w-12 shrink-0 font-mono text-xs font-semibold",
                      toneText[r.tone],
                    )}
                  >
                    {r.days}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {/* A flag, not a heartbeat: the header dot is the one pulse in
                        the hero — two rhythms above the fold competed. */}
                    {r.flag && (
                      <span className="size-1.5 shrink-0 rounded-full bg-destructive ring-2 ring-destructive/20" />
                    )}
                    <span className="min-w-0">
                      <span className="mkt-subhead block truncate text-[15px] leading-tight text-foreground">
                        {r.org}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{r.meta}</span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      "hidden shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium sm:inline",
                      pillClass[r.pillTone],
                    )}
                  >
                    {r.pill}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
              <Readout>2 overdue · clear the backlog first</Readout>
              {/* The footer states the queue's one instruction, then offers the
                  one action. Nothing else on the panel is clickable-looking. */}
              <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 font-mono text-[10px] font-medium tracking-[0.14em] text-primary-ink uppercase">
                Work the queue
                <ArrowRight className="size-3" />
              </span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
