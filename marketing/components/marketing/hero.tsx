"use client";

import { useCallback, useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

import { CTA_HREF } from "@/content/site";
import { cn } from "@/lib/utils";
import {
  Cascade,
  CascadeItem,
  Counter,
  EASE,
  MaskedLines,
  SOFT_SPRING,
} from "@/components/motion/primitives";
import { Lit } from "./lit";
import { Container, CTAGhost, CTAPrimary, Dot, Readout } from "./primitives";

/**
 * The fold: a claim at full measure, and the product underneath it.
 *
 * Two decisions carry this composition.
 *
 * **The headline gets the whole width.** The previous hero held it to a 30rem
 * column beside the panel, which capped it at 3.35rem and made the most
 * important sentence on the site the third most prominent thing in its own
 * fold. Set across the full measure it can run at 4.75rem without shouting,
 * and the serif does the rest.
 *
 * **The queue is cropped, not framed.** It runs off the right edge of the
 * viewport instead of sitting politely inside a container. A screenshot with
 * air on all four sides reads as a picture of software; one that leaves the
 * frame reads as a window onto something larger, which is the honest
 * impression, because the real screen is larger.
 *
 * The panel is one desk's Tuesday drawn to scale: the strip sums to the queue
 * (2 + 1 + 6 + 29 = 38) and LATE matches the two overdue rows, so it reads as a
 * screen rather than as decoration. Organisation and person names are invented,
 * and nothing here is a claim about anyone's pipeline, but they are invented to
 * sound like a real book of business, because "Acme Corp / Jane Doe" makes a
 * product look like a demo of itself.
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
  { label: "All", n: 38, tone: "ink" },
  { label: "Late", n: 2, tone: "over" },
  { label: "Today", n: 1, tone: "due" },
  { label: "Soon", n: 6, tone: "muted" },
  { label: "Ahead", n: 29, tone: "signal" },
] as const;

const PROOF = ["Append-only log", "Server-computed cadence", "Cross-mandate memory"];

const toneText: Record<string, string> = {
  over: "text-destructive",
  due: "text-primary-ink",
  ok: "text-muted-foreground",
  muted: "text-muted-foreground",
  ink: "text-foreground",
  signal: "text-signal",
};

const pillClass: Record<string, string> = {
  over: "border-destructive/30 bg-destructive/10 text-destructive-ink",
  due: "border-primary/30 bg-primary/10 text-primary-ink",
  signal: "border-signal/30 bg-signal/10 text-signal",
  quiet: "border-border bg-foreground/[0.03] text-muted-foreground",
};

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const raf = useRef(0);
  const reduced = useReducedMotion();

  // The beacon is a paint, not state: writing custom properties to the section
  // keeps a pointermove from ever touching React.
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

  // The panel leaves the fold slightly slower than the copy beside it. Depth,
  // at a strength you would not name if asked, which is the correct strength.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const panelY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : -56]);

  return (
    <section
      ref={ref}
      onPointerMove={onMove}
      className="relative overflow-clip pt-28 pb-20 sm:pt-32 md:pt-36 md:pb-28"
    >
      {/* Ruled ground. Masked to fade out downward so the section below is not
          fighting a grid that never ends. */}
      <div
        aria-hidden
        className="mkt-rules pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_82%)]"
      />
      <div aria-hidden className="mkt-beacon" />

      <Container wide className="relative">
        {/* ── The claim, at full measure ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="flex items-center gap-2.5"
        >
          <span className="mkt-live size-1.5 rounded-full bg-primary" />
          <Readout tone="signal">Origination and outreach</Readout>
          {/* Dropped below sm: at 390 the two halves wrapped into a ragged
              two-column block, and the qualifier is the half that can go. */}
          <span aria-hidden className="hidden h-3 w-px bg-border sm:block" />
          <Readout className="hidden sm:inline">For boutique M&amp;A desks</Readout>
        </motion.div>

        <MaskedLines
          as="h1"
          text="Follow-ups on a clock. A record that outlives the analyst."
          className="mkt-display mt-7 text-[clamp(2.5rem,6vw,4.75rem)] text-foreground"
          lines={[
            "Follow-ups on a clock.",
            <span key="turn" className="mkt-turn">
              A record that outlives the analyst.
            </span>,
          ]}
          delay={0.15}
        />

        <motion.div
          aria-hidden
          className="mt-12 h-px origin-left bg-border"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.5 }}
        />

        {/* ── The evidence, cropped ──────────────────────────────────────── */}
        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:gap-14 xl:gap-20">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.55 }}
          >
            <p className="text-[15px] leading-relaxed text-muted-foreground text-pretty md:text-base">
              Upstream is the master list, the follow-up schedule and the contact history for a
              deal desk, joined into one record the firm owns. Not three spreadsheets owned by
              whoever still works here.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <CTAPrimary href={CTA_HREF}>
                Book a demo
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
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
          </motion.div>

          {/* Runs off the right edge of the viewport. The section is
              overflow-clip, so the crop is the viewport rather than a mask. */}
          <motion.div
            style={{ y: panelY }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SOFT_SPRING, delay: 0.35 }}
            className="lg:-mr-8 xl:-mr-12 2xl:-mr-20"
          >
            <QueuePanel />
          </motion.div>
        </div>
      </Container>
    </section>
  );
}

/**
 * The outreach queue.
 *
 * Split out because the hero above it is already doing composition, and this is
 * a self-contained instrument: a header that says it is live, a triage strip
 * that splits the queue by how late it is, the rows themselves, and a footer
 * that states the queue's one instruction.
 */
function QueuePanel() {
  return (
    <Lit className="mkt-elev overflow-clip rounded-lg border border-border bg-card/70 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <span className="flex items-center gap-2.5">
          {/* The one heartbeat on the page. A second rhythm above the fold
              competed with this one, so the second rhythm went. */}
          <span className="mkt-live size-1.5 rounded-full bg-primary" />
          <Readout tone="ink">Outreach desk</Readout>
        </span>
        <Readout className="hidden sm:inline">Today · 38 in queue</Readout>
      </div>

      {/* Triage strip. The figures count up as they arrive, because a queue
          draining is the only thing on this page that counting can honestly
          describe. */}
      <div className="grid grid-cols-5 divide-x divide-border border-b border-border">
        {STRIP.map((s, i) => (
          <div key={s.label} className="px-2 py-3.5 text-center sm:px-3">
            <div className={cn("font-mono text-xl font-semibold sm:text-2xl", toneText[s.tone])}>
              <Counter to={s.n} delay={0.5 + i * 0.07} />
            </div>
            <Readout className="mt-1.5 block text-[10px] tracking-[0.13em]">{s.label}</Readout>
          </div>
        ))}
      </div>

      <Cascade as="ul" className="divide-y divide-border" gap={0.055} delay={0.35}>
        {ROWS.map((r) => (
          <CascadeItem
            as="li"
            key={r.org}
            className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-foreground/[0.025]"
          >
            <span className={cn("w-12 shrink-0 font-mono text-xs font-semibold", toneText[r.tone])}>
              {r.days}
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {r.flag && (
                <span className="size-1.5 shrink-0 rounded-full bg-destructive ring-2 ring-destructive/20" />
              )}
              <span className="min-w-0">
                <span className="mkt-subhead block truncate text-[15px] text-foreground">
                  {r.org}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{r.meta}</span>
              </span>
            </span>
            <span
              className={cn(
                "hidden shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] font-medium sm:inline",
                pillClass[r.pillTone],
              )}
            >
              {r.pill}
            </span>
          </CascadeItem>
        ))}
      </Cascade>

      <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
        <Readout>2 overdue · clear the backlog first</Readout>
        {/* The footer states the queue's one instruction, then offers the one
            action. Nothing else on the panel is made to look clickable. */}
        <span className="inline-flex items-center gap-1.5 rounded bg-primary/10 px-2 py-1 font-mono text-[10px] font-medium tracking-[0.13em] text-primary-ink uppercase">
          Work the queue
          <ArrowRight className="size-3" />
        </span>
      </div>
    </Lit>
  );
}
