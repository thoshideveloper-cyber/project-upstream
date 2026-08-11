"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { SECURITY } from "@/content/site";
import { cn } from "@/lib/utils";
import { EASE, SPRING } from "@/components/motion/primitives";
import { Container, Display, Gutter, Lede, Readout, Section, Subhead } from "./primitives";

/**
 * Security, demonstrated on the one asset that makes a desk nervous.
 *
 * The previous version of this fold was an Evervault-style card: hex glyphs
 * churning under a cursor-tracked mask, revealing the words "Secure by
 * default". It looked good and it said nothing. It is also one of the most
 * copied components on the internet, so its main effect on a reader who has
 * seen it before is to say "assembled from parts".
 *
 * This says something instead. The panel is a live buyer list, and the control
 * beside it changes *who is looking*. Each of the three viewers maps to a rule
 * that is really enforced in the codebase:
 *
 *   Partner at the firm      sees the book        (role-based visibility)
 *   Analyst, not on it       sees it redacted     (per-mandate assignment)
 *   Anyone at another firm   sees nothing at all  (firm-scoped tenancy)
 *
 * The third state is the important one, and it is why the redacted rows are
 * genuinely absent from the DOM rather than covered by a rectangle: firm
 * scoping happens at the query. There is no row in the response to inspect, so
 * there is no row in the markup either. A security section that lies in its own
 * markup is worse than no security section.
 */

type ViewerId = "partner" | "unassigned" | "outside";

const VIEWERS: { id: ViewerId; label: string; sub: string }[] = [
  { id: "partner", label: "A partner at the firm", sub: "Assigned to everything" },
  { id: "unassigned", label: "An analyst not on this mandate", sub: "Same firm, different book" },
  { id: "outside", label: "Anyone at another firm", sub: "A different tenant entirely" },
];

const ROWS = [
  { org: "Ardent Materials", person: "Priya Raghavan", state: "Interested", tone: "signal" },
  { org: "Halvorsen Industrial", person: "Tomás Ferreira", state: "Contacted", tone: "quiet" },
  { org: "Bright Ridge Systems", person: "Amara Okonkwo", state: "Responded", tone: "positive" },
  { org: "Calder Speciality", person: "Wei Zhang", state: "Contacted", tone: "quiet" },
  { org: "Lindqvist Labs", person: "Dan Mercer", state: "Declined", tone: "over" },
];

const stateClass: Record<string, string> = {
  signal: "border-signal/30 bg-signal/10 text-signal",
  positive: "border-positive/30 bg-positive/10 text-positive",
  over: "border-destructive/30 bg-destructive/10 text-destructive-ink",
  quiet: "border-border bg-foreground/[0.03] text-muted-foreground",
};

/** Redaction bar widths, fixed per row so they do not reshuffle on every render. */
const BAR = ["68%", "84%", "74%", "62%", "79%"];

export function Secret() {
  const [viewer, setViewer] = useState<ViewerId>("partner");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const i = VIEWERS.findIndex((v) => v.id === viewer);
      const last = VIEWERS.length - 1;
      let next: number | null = null;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") next = i === last ? 0 : i + 1;
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = i === 0 ? last : i - 1;
      if (next === null) return;
      e.preventDefault();
      setViewer(VIEWERS[next].id);
      refs.current[next]?.focus();
    },
    [viewer],
  );

  return (
    <Section id="secret" rhythm="base">
      <Container>
        <Gutter stamp="05 / The secret">
          <div className="grid gap-6 border-b border-border pb-12 md:grid-cols-[1.1fr_1fr] md:items-end md:gap-12">
            <Display>Who you are talking to is the whole secret.</Display>
            <Lede className="md:pb-1">
              A live buyer list is the most commercially sensitive thing a desk holds. It was
              locked down in the data model, not bolted on before a security review.
            </Lede>
          </div>

          <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
            {/* ── The demonstration ────────────────────────────────────── */}
            <div>
              <div
                role="radiogroup"
                aria-label="Who is looking at this list"
                onKeyDown={onKeyDown}
                className="divide-y divide-border overflow-hidden rounded-lg border border-border"
              >
                {VIEWERS.map((v, i) => {
                  const on = v.id === viewer;
                  return (
                    <button
                      key={v.id}
                      ref={(n) => {
                        refs.current[i] = n;
                      }}
                      role="radio"
                      aria-checked={on}
                      tabIndex={on ? 0 : -1}
                      onClick={() => setViewer(v.id)}
                      className={cn(
                        "relative flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors",
                        on ? "bg-primary/[0.06]" : "hover:bg-foreground/[0.025]",
                      )}
                    >
                      {on && (
                        <motion.span
                          layoutId="viewer-mark"
                          aria-hidden
                          className="absolute inset-y-0 left-0 w-0.5 bg-primary"
                          transition={SPRING}
                        />
                      )}
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 shrink-0 rounded-full transition-colors",
                          on ? "bg-primary" : "bg-muted-foreground/35",
                        )}
                      />
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block text-sm transition-colors",
                            on ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {v.label}
                        </span>
                        <span className="mt-0.5 block font-mono text-[10px] tracking-[0.13em] text-muted-foreground uppercase">
                          {v.sub}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <BuyerList viewer={viewer} />
            </div>

            {/* ── The proofs ───────────────────────────────────────────── */}
            <dl className="divide-y divide-border border-t border-border">
              {SECURITY.map((s) => (
                <div key={s.term} className="py-5">
                  <Subhead as="dt" className="text-[1.05rem] leading-snug">
                    {s.term}
                  </Subhead>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                    {s.detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Gutter>
      </Container>
    </Section>
  );
}

function BuyerList({ viewer }: { viewer: ViewerId }) {
  const gone = viewer === "outside";
  const redacted = viewer === "unassigned";

  return (
    <div className="mkt-elev mt-6 overflow-hidden rounded-lg border border-border bg-card/60">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <Readout tone={gone ? "muted" : "ink"}>
          {gone ? "Project ————" : "Project Kestrel · buyer list"}
        </Readout>
        <Readout>{gone ? "—" : redacted ? "5 rows withheld" : "5 of 38"}</Readout>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {gone ? (
          <motion.div
            key="gone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="flex min-h-[16.5rem] flex-col items-center justify-center gap-3 px-6 py-14 text-center"
          >
            <span className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
              404 · no such mandate
            </span>
            <p className="max-w-[36ch] text-sm leading-relaxed text-muted-foreground text-pretty">
              A firm is the tenant boundary, so this is not a permission failure. From outside the
              firm the mandate does not exist to be denied.
            </p>
          </motion.div>
        ) : (
          <motion.ul
            key="rows"
            initial="hidden"
            animate="shown"
            exit={{ opacity: 0 }}
            variants={{ shown: { transition: { staggerChildren: 0.04 } } }}
            className="min-h-[16.5rem] divide-y divide-border"
          >
            {ROWS.map((r, i) => (
              <motion.li
                key={r.org}
                variants={{ hidden: { opacity: 0, y: 6 }, shown: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.35, ease: EASE }}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="min-w-0 flex-1">
                  {redacted ? (
                    <>
                      {/* Genuinely absent, not hidden: the row never loaded. */}
                      <span className="sr-only">Company name withheld</span>
                      <motion.span
                        aria-hidden
                        className="mkt-redact block h-3.5"
                        initial={{ width: 0 }}
                        animate={{ width: BAR[i] }}
                        transition={{ duration: 0.5, ease: EASE, delay: i * 0.04 }}
                      />
                      <motion.span
                        aria-hidden
                        className="mkt-redact mt-1.5 block h-2.5 opacity-60"
                        initial={{ width: 0 }}
                        animate={{ width: `calc(${BAR[i]} * 0.62)` }}
                        transition={{ duration: 0.5, ease: EASE, delay: 0.06 + i * 0.04 }}
                      />
                    </>
                  ) : (
                    <>
                      <span className="mkt-subhead block truncate text-[15px] text-foreground">
                        {r.org}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.person}
                      </span>
                    </>
                  )}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] font-medium",
                    redacted ? "border-border text-muted-foreground/50" : stateClass[r.tone],
                  )}
                >
                  {redacted ? "———" : r.state}
                </span>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      <p className="border-t border-border px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        {gone
          ? "Nothing crosses a firm boundary: not a company, not a contact, not a touch."
          : redacted
            ? "Enforced at the query, not in the view. The withheld rows are not in the response, so there is nothing to inspect."
            : "Partners see the whole book, the analytics and the escalation queue."}
      </p>
    </div>
  );
}
