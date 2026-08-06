"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { Lit } from "./lit";
import { Container, Readout, Section, SectionHead, Subhead } from "./primitives";

/**
 * The cadence engine, running on the page.
 *
 * Every other section that touches this says "computed server-side" and asks to
 * be believed. This one just does it. The arithmetic here is the arithmetic in
 * `backend/app/services/cadence.py`:
 *
 *     next_due       = initial_date + (follow_ups_logged + 1) * interval_days
 *     days_remaining = next_due - today
 *     is_overdue     = days_remaining < 0
 *
 * and the sequence stops outright on a reply, a bounce or a decline. The three
 * rules that are easy to get wrong, and that this exists to make legible, are:
 * the anchor is the day the *first email actually went out* and never moves; the
 * clock does not start before that; and a reply ends the sequence rather than
 * pausing it.
 *
 * Dates are resolved after mount. `new Date()` on the server and on the client
 * are different days for anyone near a date boundary, and a prerendered ladder
 * of dates that changes on hydration is a real bug, not a flicker.
 */

const INTERVALS = [5, 7, 10, 14];
const LADDER = 4;
const DAY = 86_400_000;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const fmt = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

type Step = {
  label: string;
  date: Date;
  state: "sent" | "logged" | "next" | "upcoming" | "stopped";
};

export function CadenceDemo() {
  const [today, setToday] = useState<Date | null>(null);
  const [anchor, setAnchor] = useState<string>("");
  const [interval, setInterval] = useState(7);
  const [logged, setLogged] = useState(1);
  const [replied, setReplied] = useState(false);

  useEffect(() => {
    const now = midnight(new Date());
    setToday(now);
    // A schedule mid-flight is the interesting case: far enough back that a
    // follow-up is already late, so the default state shows the thing that
    // matters rather than a tidy empty one.
    setAnchor(iso(addDays(now, -18)));
  }, []);

  const model = useMemo(() => {
    if (!today || !anchor) return null;
    const start = midnight(new Date(`${anchor}T00:00:00`));
    if (Number.isNaN(start.getTime())) return null;

    const nextDue = addDays(start, (logged + 1) * interval);
    const daysRemaining = Math.round((nextDue.getTime() - today.getTime()) / DAY);

    const steps: Step[] = [
      { label: "Initial email", date: start, state: "sent" },
      ...Array.from({ length: LADDER }, (_, i) => {
        const n = i + 1;
        const date = addDays(start, n * interval);
        const state: Step["state"] = replied
          ? n <= logged
            ? "logged"
            : "stopped"
          : n <= logged
            ? "logged"
            : n === logged + 1
              ? "next"
              : "upcoming";
        return { label: `Follow-up ${n}`, date, state };
      }),
    ];

    return { start, nextDue, daysRemaining, steps, future: start > today };
  }, [today, anchor, interval, logged, replied]);

  const stateLabel: Record<Step["state"], string> = {
    sent: "Anchor",
    logged: "Logged",
    next: "Next due",
    upcoming: "Scheduled",
    stopped: "Cancelled",
  };

  return (
    <Section id="cadence" motion>
      <Container>
        <SectionHead
          variant="split"
          title="The follow-up clock, running right here."
        >
          Every other page says &ldquo;computed automatically&rdquo; and asks you to take its
          word. Move the controls. This is the same arithmetic the server runs.
        </SectionHead>

        <Lit className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          {/* Controls */}
          <div className="bg-card/40 p-6 md:p-7">
            <fieldset className="border-0 p-0">
              <legend className="sr-only">Cadence inputs</legend>

              <label htmlFor="cad-anchor" className="block">
                <Readout>The first email went out</Readout>
                <input
                  id="cad-anchor"
                  type="date"
                  value={anchor}
                  onChange={(e) => setAnchor(e.target.value)}
                  className="mt-2.5 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
                />
              </label>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                This is the anchor. It is set by logging the first message, and it never moves
                afterwards. Nothing is due before it.
              </p>

              <div className="mt-7">
                <Readout>Days between follow-ups</Readout>
                <div className="mt-2.5 flex gap-1 rounded-lg border border-border bg-background p-1">
                  {INTERVALS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setInterval(n)}
                      aria-pressed={interval === n}
                      className={cn(
                        "flex-1 rounded-md py-1.5 font-mono text-sm transition-colors",
                        interval === n
                          ? "bg-primary/15 text-foreground ring-1 ring-primary/30"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-7">
                <Readout>Follow-ups logged so far</Readout>
                <div className="mt-2.5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setLogged((v) => Math.max(0, v - 1))}
                    disabled={logged === 0}
                    aria-label="One fewer follow-up logged"
                    className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-foreground/[0.04] disabled:opacity-40"
                  >
                    &minus;
                  </button>
                  <span
                    aria-live="polite"
                    className="min-w-8 text-center font-mono text-lg text-foreground"
                  >
                    {logged}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLogged((v) => Math.min(LADDER, v + 1))}
                    disabled={logged === LADDER}
                    aria-label="One more follow-up logged"
                    className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-foreground/[0.04] disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>

              <label className="mt-7 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={replied}
                  onChange={(e) => setReplied(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">They replied</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    A reply, a bounce or a decline stops the sequence outright. It does not pause
                    it, and nothing further is scheduled.
                  </span>
                </span>
              </label>
            </fieldset>
          </div>

          {/* The computed schedule */}
          <div className="bg-background p-6 md:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-5">
              <Subhead className="text-lg">Computed schedule</Subhead>
              <span aria-live="polite" className="font-mono text-sm">
                {!model ? (
                  <span className="text-muted-foreground">Reading the clock…</span>
                ) : replied ? (
                  <span className="text-[var(--signal)]">Sequence stopped on reply</span>
                ) : model.future ? (
                  <span className="text-muted-foreground">
                    Not started. The clock waits for the first send.
                  </span>
                ) : model.daysRemaining < 0 ? (
                  <span className="text-destructive">
                    Overdue by {Math.abs(model.daysRemaining)}{" "}
                    {Math.abs(model.daysRemaining) === 1 ? "day" : "days"}
                  </span>
                ) : model.daysRemaining === 0 ? (
                  <span className="text-primary-ink">Due today</span>
                ) : (
                  <span className="text-muted-foreground">
                    Next due in {model.daysRemaining} days
                  </span>
                )}
              </span>
            </div>

            <ol className="mt-1">
              {(model?.steps ?? []).map((s, i) => (
                <li
                  key={s.label}
                  className="flex items-center gap-4 border-b border-border py-3.5 last:border-b-0"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      s.state === "next" && "bg-primary",
                      s.state === "logged" && "bg-muted-foreground/50",
                      s.state === "sent" && "bg-foreground/60",
                      s.state === "upcoming" && "bg-muted-foreground/25",
                      s.state === "stopped" && "bg-transparent ring-1 ring-border",
                    )}
                  />
                  <span
                    className={cn(
                      "flex-1 text-sm",
                      s.state === "stopped"
                        ? "text-muted-foreground/60 line-through"
                        : "text-foreground/90",
                    )}
                  >
                    {s.label}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-sm",
                      s.state === "stopped"
                        ? "text-muted-foreground/50 line-through"
                        : "text-muted-foreground",
                    )}
                  >
                    {fmt(s.date)}
                  </span>
                  <span
                    className={cn(
                      "w-[5.5rem] shrink-0 rounded-md border px-2 py-0.5 text-center font-mono text-[10px] font-medium",
                      s.state === "next"
                        ? "border-primary/30 bg-primary/10 text-primary-ink"
                        : s.state === "stopped"
                          ? "border-dashed border-border text-muted-foreground/60"
                          : "border-border text-muted-foreground",
                    )}
                  >
                    {stateLabel[s.state]}
                  </span>
                  {i === 0 && (
                    <span className="sr-only">This date is the anchor for everything below.</span>
                  )}
                </li>
              ))}
            </ol>

            <p className="mt-5 border-t border-border pt-5 font-mono text-xs leading-relaxed text-muted-foreground">
              next_due = first_email + (logged + 1) × {interval} days
            </p>
          </div>
        </Lit>
      </Container>
    </Section>
  );
}
