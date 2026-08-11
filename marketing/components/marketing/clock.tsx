"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";
import { EASE, SPRING } from "@/components/motion/primitives";
import { Container, Display, Gutter, Lede, Readout, Section, Subhead } from "./primitives";

/**
 * The cadence engine, running on the page.
 *
 * Every other section that touches this says "computed server-side" and asks to
 * be believed. This one just does it, and it is the single most persuasive
 * thing on the site for the same reason a currency converter is the most
 * persuasive thing on a money-transfer page: the reader stops evaluating a
 * claim and starts operating an instrument.
 *
 * The arithmetic here is the arithmetic in `backend/app/services/cadence.py`:
 *
 *     next_due       = initial_date + (follow_ups_logged + 1) * interval_days
 *     days_remaining = next_due - today
 *     is_overdue     = days_remaining < 0
 *
 * and the sequence stops outright on a reply, a bounce or a decline. The three
 * rules that are easy to get wrong, and that this exists to make legible, are:
 * the anchor is the day the *first email actually went out* and never moves;
 * the clock does not start before that; and a reply ends the sequence rather
 * than pausing it.
 *
 * NOTE: if that service changes, this demo is a second place that has to
 * change.
 *
 * Dates resolve after mount. `new Date()` on the server and on the client are
 * different days for anyone near a date boundary, and a prerendered ladder of
 * dates that changes on hydration is a real bug, not a flicker.
 */

const INTERVALS = [5, 7, 10, 14];
const LADDER = 4;
const DAY = 86_400_000;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

type Step = {
  label: string;
  date: Date;
  state: "sent" | "logged" | "next" | "upcoming" | "stopped";
};

const STATE_LABEL: Record<Step["state"], string> = {
  sent: "Anchor",
  logged: "Logged",
  next: "Next due",
  upcoming: "Scheduled",
  stopped: "Cancelled",
};

export function Clock() {
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

  const status = !model
    ? { key: "loading", text: "Reading the clock…", tone: "text-muted-foreground" }
    : replied
      ? { key: "stopped", text: "Sequence stopped on reply", tone: "text-signal" }
      : model.future
        ? { key: "future", text: "Not started. The clock waits for the first send.", tone: "text-muted-foreground" }
        : model.daysRemaining < 0
          ? {
              key: "over",
              text: `Overdue by ${Math.abs(model.daysRemaining)} ${Math.abs(model.daysRemaining) === 1 ? "day" : "days"}`,
              tone: "text-destructive",
            }
          : model.daysRemaining === 0
            ? { key: "today", text: "Due today", tone: "text-primary-ink" }
            : { key: "ahead", text: `Next due in ${model.daysRemaining} days`, tone: "text-muted-foreground" };

  return (
    <Section id="clock" rhythm="base">
      <Container>
        <Gutter stamp="03 / The clock">
          <div className="grid gap-6 border-b border-border pb-12 md:grid-cols-[1.1fr_1fr] md:items-end md:gap-12">
            <Display>
              Everyone writes &ldquo;computed&rdquo;.{" "}
              <span className="mkt-turn">Here is the arithmetic.</span>
            </Display>
            <Lede className="md:pb-1">
              Move the controls. This is the same calculation the server runs, with the same three
              rules that make it worth trusting.
            </Lede>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
            {/* ── Inputs ─────────────────────────────────────────────────── */}
            <div className="bg-card/60 p-6 md:p-7">
              <fieldset className="border-0 p-0">
                <legend className="sr-only">Cadence inputs</legend>

                <label htmlFor="cad-anchor" className="block">
                  <Readout>The first email went out</Readout>
                  <input
                    id="cad-anchor"
                    type="date"
                    value={anchor}
                    onChange={(e) => setAnchor(e.target.value)}
                    className="mt-2.5 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
                  />
                </label>
                <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                  This is the anchor. It is set by logging the first message, and it never moves
                  afterwards. Nothing is due before it.
                </p>

                <div className="mt-7">
                  <Readout>Days between follow-ups</Readout>
                  <div className="mt-2.5 flex gap-1 rounded-md border border-border bg-background p-1">
                    {INTERVALS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setInterval(n)}
                        aria-pressed={interval === n}
                        className={cn(
                          "relative flex-1 rounded py-1.5 font-mono text-sm transition-colors",
                          interval === n ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {interval === n && (
                          <motion.span
                            layoutId="interval-pill"
                            aria-hidden
                            className="absolute inset-0 rounded bg-primary/15 ring-1 ring-primary/30"
                            transition={SPRING}
                          />
                        )}
                        <span className="relative">{n}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-7">
                  <Readout>Follow-ups logged so far</Readout>
                  <div className="mt-2.5 flex items-center gap-3">
                    <Stepper
                      label="One fewer follow-up logged"
                      disabled={logged === 0}
                      onClick={() => setLogged((v) => Math.max(0, v - 1))}
                    >
                      &minus;
                    </Stepper>
                    <span aria-live="polite" className="min-w-8 text-center font-mono text-lg text-foreground">
                      {logged}
                    </span>
                    <Stepper
                      label="One more follow-up logged"
                      disabled={logged === LADDER}
                      onClick={() => setLogged((v) => Math.min(LADDER, v + 1))}
                    >
                      +
                    </Stepper>
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

            {/* ── Output ─────────────────────────────────────────────────── */}
            <div className="bg-background p-6 md:p-7">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-5">
                <Subhead className="text-lg">Computed schedule</Subhead>
                <span aria-live="polite" className="font-mono text-sm">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={status.key + status.text}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.22, ease: EASE }}
                      className={cn("inline-block", status.tone)}
                    >
                      {status.text}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </div>

              <ol className="mt-1">
                {(model?.steps ?? []).map((s, i) => (
                  <li
                    key={s.label}
                    className="flex items-center gap-4 border-b border-border py-3.5 last:border-b-0"
                  >
                    <motion.span
                      aria-hidden
                      layout
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
                        "flex-1 text-sm transition-colors duration-300",
                        s.state === "stopped"
                          ? "text-muted-foreground/60 line-through"
                          : "text-foreground/90",
                      )}
                    >
                      {s.label}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-sm transition-colors duration-300",
                        s.state === "stopped"
                          ? "text-muted-foreground/50 line-through"
                          : "text-muted-foreground",
                      )}
                    >
                      {fmt(s.date)}
                    </span>
                    <span
                      className={cn(
                        "w-[5.5rem] shrink-0 rounded border px-2 py-0.5 text-center font-mono text-[10px] font-medium transition-colors duration-300",
                        s.state === "next"
                          ? "border-primary/30 bg-primary/10 text-primary-ink"
                          : s.state === "stopped"
                            ? "border-dashed border-border text-muted-foreground/60"
                            : "border-border text-muted-foreground",
                      )}
                    >
                      {STATE_LABEL[s.state]}
                    </span>
                    {i === 0 && (
                      <span className="sr-only">This date is the anchor for everything below.</span>
                    )}
                  </li>
                ))}
              </ol>

              {/* The formula, set as type rather than tucked into a caption. It
                  is the whole promise of the section in eleven characters. */}
              <p className="mt-6 border-t border-border pt-6 font-mono text-[13px] leading-relaxed text-muted-foreground">
                <span className="text-foreground">next_due</span> = first_email + (logged + 1) &times;{" "}
                <motion.span
                  key={interval}
                  initial={{ color: "var(--primary)" }}
                  animate={{ color: "var(--foreground)" }}
                  transition={{ duration: 0.9, ease: EASE }}
                  className="inline-block"
                >
                  {interval}
                </motion.span>{" "}
                days
              </p>
            </div>
          </div>
        </Gutter>
      </Container>
    </Section>
  );
}

function Stepper({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      whileTap={{ scale: 0.94 }}
      transition={SPRING}
      className="inline-flex size-9 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-foreground/[0.04] disabled:opacity-40"
    >
      {children}
    </motion.button>
  );
}
