"use client";

import { useMemo, useRef } from "react";
import { FileSpreadsheet } from "lucide-react";

import { UpstreamMark } from "@/components/brand/logo";
import { AnimatedBeams } from "./animated-beam";

/** The sheets a team already runs — named as the files they actually are. */
const SHEETS = [
  { name: "The list", file: "records.xlsx", holds: "the organisations you're pursuing" },
  { name: "The schedule", file: "follow_ups.xlsx", holds: "who to reach, and when" },
  { name: "The contacts", file: "contacts.xlsx", holds: "the people you actually know" },
];

/**
 * The mechanism, shown rather than claimed: the spreadsheet nodes feeding one
 * system, with a packet of rows travelling each rail into Upstream. Stacks to a
 * top-down flow on mobile — the beams are measured from the DOM, so they follow.
 */
export function SheetsToSystem() {
  const containerRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const sheet0 = useRef<HTMLDivElement>(null);
  const sheet1 = useRef<HTMLDivElement>(null);
  const sheet2 = useRef<HTMLDivElement>(null);

  const beams = useMemo(
    () => [
      { from: sheet0, to: hubRef, delay: 0 },
      { from: sheet1, to: hubRef, delay: 420 },
      { from: sheet2, to: hubRef, delay: 840 },
    ],
    [],
  );
  const sheetRefs = [sheet0, sheet1, sheet2];

  return (
    <figure className="mx-auto mt-10 max-w-4xl">
      <div
        ref={containerRef}
        className="relative flex flex-col items-stretch gap-14 overflow-hidden rounded-xl border border-border bg-card/40 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-10 lg:px-12"
      >
        {/* Rails sit behind the nodes: the cards below are positioned, so they paint over. */}
        <AnimatedBeams containerRef={containerRef} beams={beams} />

        {/* The three sheets */}
        <div className="flex items-stretch justify-between gap-2.5 sm:w-[21rem] sm:flex-none sm:flex-col sm:gap-5 lg:w-[23rem]">
          {SHEETS.map((s, i) => (
            <div
              key={s.file}
              ref={sheetRefs[i]}
              className="relative flex flex-1 flex-col items-center gap-2 rounded-xl border border-border bg-background/80 px-2.5 py-4 text-center sm:flex-none sm:flex-row sm:items-center sm:gap-3.5 sm:px-4 sm:py-3.5 sm:text-left"
            >
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-foreground/[0.03]">
                <FileSpreadsheet aria-hidden strokeWidth={1.75} className="size-4 text-muted-foreground" />
              </span>
              <span className="min-w-0">
                <span className="mkt-subhead block text-[15px] leading-tight font-semibold text-foreground">
                  {s.name}
                </span>
                <span className="mt-1 hidden font-mono text-[10px] tracking-[0.14em] text-muted-foreground sm:block">
                  {s.file} · {s.holds}
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* The system */}
        <div className="relative flex justify-center sm:shrink-0">
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-3xl"
          />
          <div
            ref={hubRef}
            className="mkt-elev relative flex flex-col items-center gap-2 rounded-xl border border-primary/30 bg-card px-8 py-6"
          >
            <UpstreamMark size={30} className="text-foreground" />
            <span className="mkt-subhead text-lg leading-none font-semibold text-foreground">
              Upstream
            </span>
            <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-primary-ink uppercase">
              One system
            </span>
          </div>
        </div>
      </div>

      <figcaption className="mt-4 text-center font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
        Your sheets in, one connected record out. Nothing re-keyed, nothing left behind.
      </figcaption>
    </figure>
  );
}
