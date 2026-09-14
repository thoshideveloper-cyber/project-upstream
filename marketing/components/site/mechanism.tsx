"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

import { CONSEQUENCES, DEMO, MECHANISM } from "@/content/site";
import { Fold } from "./fold";
import { Plate } from "./plate";
import { EASE, Reveal, Stamp } from "./primitives";
import { cn } from "@/lib/utils";

/**
 * The one interactive moment on the page, and the reader performs the
 * product's whole idea with it.
 *
 * Upstream's claim is that a desk types one thing, `sent`, and the clock, the
 * queue, the report and the record all fall out of it. A paragraph asserting
 * that is a paragraph. Holding a button until an email is logged and then
 * watching four separate things light up on their own is the claim, performed.
 *
 * The mechanics that keep it from feeling like a gimmick:
 *
 *  - Progress builds only while the visitor holds.
 *  - Releasing early eases back down. It never snaps to zero, because a snap
 *    reads as a rejection of what they just did.
 *  - Completing it lights the four consequences in sequence, so the action
 *    earns something rather than just filling a bar.
 *  - Reduced motion gets the finished state immediately, with no hold at all,
 *    and so does anyone who simply clicks or presses Enter. The hold is the
 *    designed path, never the only path.
 *  - And the four consequences light on their own shortly after the list comes
 *    into view, for the majority who scroll straight past. Holding buys a
 *    faster, earned arrival; it does not buy legibility. See the effect below
 *    for what gating this on the hold actually cost.
 */

const HOLD_MS = 950;
const RELEASE_MS = 700;

export function Mechanism() {
  const reduced = useReducedMotion();
  const [done, setDone] = useState(false);
  const [lit, setLit] = useState(0);
  const fillRef = useRef<HTMLSpanElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const seen = useInView(listRef, { once: true, margin: "-15% 0px -15% 0px" });
  const holding = useRef(false);
  const raf = useRef<number | null>(null);
  const prog = useRef(0);
  const last = useRef(0);

  // Anyone who asked for less motion gets the whole thing already done.
  useEffect(() => {
    if (reduced) {
      setDone(true);
      setLit(CONSEQUENCES.length);
    }
  }, [reduced]);

  // The consequences arrive one at a time, in the order the server computes
  // them, which is also the order they matter in.
  //
  // They arrive for a reader who never touches the button too, once the list
  // has been on screen a moment. Gating them on the hold made the unlit state
  // a RESTING state rather than a transient one, and unlit is 0.32 opacity:
  // 1.54:1 for the lines and 2.02:1 for the labels, against a 4.5:1 floor. Most
  // readers scroll past without discovering a press-and-hold, so most readers
  // met this fold permanently unreadable and it looked like a rendering fault.
  // Holding still pays — it lights them sooner and it is what sets the event
  // line above — but it is not the price of being able to read the section.
  useEffect(() => {
    if (reduced || (!done && !seen)) return;
    const base = done ? 120 : 620;
    const timers = CONSEQUENCES.map((_, i) =>
      // Never step backwards: a reader who holds after the list has already
      // lit itself must not watch it dim and re-run.
      window.setTimeout(() => setLit(n => Math.max(n, i + 1)), base + i * 300),
    );
    return () => timers.forEach(clearTimeout);
  }, [done, seen, reduced]);

  const paint = useCallback(() => {
    const el = fillRef.current;
    if (el) el.style.transform = `scaleX(${prog.current})`;
  }, []);

  const tick = useCallback(
    (now: number) => {
      const dt = Math.min(64, now - (last.current || now));
      last.current = now;
      const dir = holding.current ? dt / HOLD_MS : -dt / RELEASE_MS;
      prog.current = Math.min(1, Math.max(0, prog.current + dir));
      paint();

      if (prog.current >= 1) {
        raf.current = null;
        last.current = 0;
        setDone(true);
        return;
      }
      if (!holding.current && prog.current <= 0) {
        raf.current = null;
        last.current = 0;
        return;
      }
      raf.current = requestAnimationFrame(tick);
    },
    [paint],
  );

  const start = useCallback(() => {
    if (done) return;
    holding.current = true;
    if (raf.current === null) raf.current = requestAnimationFrame(tick);
  }, [done, tick]);

  const end = useCallback(() => {
    holding.current = false;
    if (raf.current === null && prog.current > 0) raf.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    },
    [],
  );

  /** Click, Enter, or a reduced-motion visitor: complete it outright. */
  const complete = useCallback(() => {
    if (done) return;
    holding.current = false;
    prog.current = 1;
    paint();
    setDone(true);
  }, [done, paint]);

  return (
    <Fold
      id="mechanism"
      variant="pool"
      stamp="the one input"
      className="py-28 lg:py-36"
      // One drop, four rings. It sits under the left column so the rings
      // spread outward from roughly where the reader's finger goes, and it is
      // held at whisper strength because dark ink is read over it.
      plate={<Plate name="mechanism" opacity={0.32} mask="centre" wash={0.7} position="30% 60%" />}
    >
      <div className="grid gap-14 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-20">
        {/* ── The act ─────────────────────────────────────────────────── */}
        <div>
          <Reveal>
            <Stamp>The mechanism</Stamp>
            <h2 className="u-display mt-4 text-[clamp(1.75rem,3.4vw,2.75rem)] leading-[1.06]">
              {MECHANISM.head}
            </h2>
            <p className="mt-5 max-w-[42ch] leading-relaxed text-fg-muted">{MECHANISM.lede}</p>
          </Reveal>

          <Reveal delay={0.1} className="mt-9">
            <button
              type="button"
              disabled={done}
              onPointerDown={start}
              onPointerUp={end}
              onPointerLeave={end}
              onPointerCancel={end}
              onKeyDown={(e) => {
                if (e.key === " ") {
                  e.preventDefault();
                  start();
                }
              }}
              onKeyUp={(e) => {
                if (e.key === " ") end();
                if (e.key === "Enter") complete();
              }}
              onClick={(e) => {
                // A real hold fires pointer events first and has already
                // finished; a plain click (assistive tech, or a visitor who
                // taps) completes it outright rather than doing nothing.
                if (e.detail === 0 || reduced) complete();
              }}
              className={cn(
                "u-target relative w-full overflow-hidden rounded-md border px-5 py-4 text-left transition-colors duration-300 select-none",
                done
                  ? "border-[color:color-mix(in_oklab,var(--accent)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--accent)_8%,transparent)]"
                  : "border-hair bg-[color:var(--raised)] hover:border-[color:color-mix(in_oklab,var(--accent)_45%,transparent)]",
              )}
            >
              <span
                ref={fillRef}
                aria-hidden
                className="absolute inset-0 origin-left bg-[color:color-mix(in_oklab,var(--accent)_14%,transparent)]"
                style={{ transform: "scaleX(0)" }}
              />
              <span className="relative flex items-baseline justify-between gap-4">
                <span className="text-[0.9375rem] font-medium">
                  {done ? MECHANISM.held : MECHANISM.hold}
                </span>
                <span className="u-mono text-[0.6875rem] tracking-widest text-fg-muted uppercase">
                  {done ? "logged" : MECHANISM.hint}
                </span>
              </span>
            </button>
          </Reveal>

          {/* The line that was appended. It is the whole input, shown as the
              product actually stores it: one event, stamped, never edited. */}
          <Reveal delay={0.16} className="mt-4">
            <div
              className={cn(
                "u-mono rounded-md border border-hair px-4 py-3 text-[0.75rem] transition-opacity duration-500",
                done ? "opacity-100" : "opacity-45",
              )}
            >
              <span className="text-fg-muted">event </span>
              <span className="text-accent">INITIAL_EMAIL</span>
              <span className="text-fg-muted"> · occurred_on </span>
              <span>{done ? "2026-03-12" : "pending"}</span>
              <span className="text-fg-muted"> · append only</span>
            </div>
          </Reveal>
        </div>

        {/* ── The four consequences ───────────────────────────────────── */}
        <ol ref={listRef} className="relative">
          {CONSEQUENCES.map((c, i) => {
            const on = i < lit;
            return (
              <li key={c.key} className="border-t border-hair py-6 first:border-t-0 first:pt-0">
                <motion.div
                  animate={{ opacity: on ? 1 : 0.32, x: on ? 0 : -6 }}
                  transition={{ duration: 0.55, ease: EASE }}
                >
                  <div className="flex items-baseline gap-3">
                    <span
                      className={cn(
                        "block h-1.5 w-1.5 shrink-0 translate-y-[-0.15em] rounded-full transition-colors duration-500",
                        on ? "bg-accent" : "bg-[color:var(--hair)]",
                      )}
                    />
                    <Stamp className="text-fg">{c.label}</Stamp>
                  </div>
                  <p className="u-subhead mt-2 text-[1.0625rem]">{c.line}</p>

                  {/* The clock says its own derivation out loud, because a date
                      arithmetic claim is only believable when you can see it. */}
                  {c.key === "clock" ? (
                    <div className="u-mono mt-3 flex flex-wrap items-center gap-2 text-[0.75rem]">
                      <span className="rounded border border-[color:color-mix(in_oklab,var(--accent)_40%,transparent)] px-2 py-1 text-accent">
                        {DEMO.anchor} anchor
                      </span>
                      {DEMO.followups.map((d, n) => (
                        <motion.span
                          key={d}
                          animate={{ opacity: on ? 1 : 0 }}
                          transition={{ duration: 0.4, ease: EASE, delay: on ? 0.2 + n * 0.14 : 0 }}
                          className="rounded border border-hair px-2 py-1 text-fg-muted"
                        >
                          +{DEMO.interval * (n + 1)}d · {d}
                        </motion.span>
                      ))}
                    </div>
                  ) : null}

                  <p className="mt-2 max-w-[54ch] text-[0.9375rem] leading-relaxed text-fg-muted">
                    {c.note}
                  </p>
                </motion.div>
              </li>
            );
          })}
        </ol>
      </div>
    </Fold>
  );
}
