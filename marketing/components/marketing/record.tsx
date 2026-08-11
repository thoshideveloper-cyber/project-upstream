"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";

import { MOAT } from "@/content/site";
import { Cascade, CascadeItem, EASE } from "@/components/motion/primitives";
import { Lit } from "./lit";
import { Container, Display, Gutter, Lede, Readout, Section, Stamp, Subhead } from "./primitives";

/**
 * Cross-mandate memory, given the fold it is owed.
 *
 * The brief (§6.4) is blunt about this one: "This is what makes Upstream more
 * than a prettier spreadsheet and is the source of long-term lock-in. It must
 * be designed in from the MVP even if surfaced minimally." It used to be one
 * card in a grid of six, sized and weighted exactly like Governance and
 * Oversight, which told the reader it mattered exactly as much as they do.
 *
 * Two devices carry it.
 *
 * **The spine draws itself as you read.** The rule beside the four beats is
 * scroll-linked, so the record visibly accumulates while you scroll through the
 * section explaining that the record accumulates. It is the one place on the
 * page where a scroll-linked animation is saying the same thing as the words
 * next to it, which is the only justification a scroll-linked animation has.
 *
 * **The panel is the moment the feature happens.** An analyst types a company
 * another desk is already working, and the system says so before the email goes
 * rather than after the target does. Showing the warning is worth more than
 * three bullets describing a warning.
 */
export function Record() {
  const listRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ["start 78%", "end 62%"],
  });
  // Spring the raw progress so a trackpad flick does not make the rule twitch.
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.6 });
  const spineScale = useTransform(smooth, (v) => (reduced ? 1 : v));

  return (
    <Section id="record" rhythm="loose">
      <Container>
        <Gutter stamp="04 / The record">
          <Display size="statement" className="max-w-[19ch]">
            The firm remembers, <span className="mkt-turn">or nobody does.</span>
          </Display>
          <Lede className="mt-8">
            One sheet per mandate means the desk forgets everything the moment a deal closes.
            Hold the record at the firm and it compounds instead: the same buyers, the same
            bankers and the same conversations keep coming back, and the second time you are
            ready for them.
          </Lede>

          <div className="mt-16 grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-20">
            {/* ── The four beats, on a spine that fills ─────────────────── */}
            <div ref={listRef} className="relative">
              <span
                aria-hidden
                className="absolute top-2 bottom-2 left-[3.5px] w-px bg-border"
              />
              <motion.span
                aria-hidden
                style={{ scaleY: spineScale }}
                className="absolute top-2 bottom-2 left-[3.5px] w-px origin-top bg-gradient-to-b from-primary via-primary/70 to-primary/20"
              />

              <Cascade as="ol" gap={0.09}>
                {MOAT.map((m) => (
                  <CascadeItem as="li" key={m.stamp} className="relative pb-12 pl-9 last:pb-0">
                    <span
                      aria-hidden
                      className="absolute top-[0.5rem] left-0 size-2 rounded-full bg-primary ring-4 ring-background"
                    />
                    <Stamp className="mb-2.5">{m.stamp}</Stamp>
                    <Subhead className="text-[1.3rem] md:text-[1.45rem]">{m.title}</Subhead>
                    <p className="mt-3 max-w-[56ch] text-sm leading-relaxed text-muted-foreground text-pretty">
                      {m.detail}
                    </p>
                  </CascadeItem>
                ))}
              </Cascade>
            </div>

            {/* ── The moment itself ────────────────────────────────────── */}
            <DuplicateFlag />
          </div>
        </Gutter>
      </Container>
    </Section>
  );
}

/**
 * The cross-mandate warning, as the analyst sees it.
 *
 * Sticky on desktop so it stays beside all four beats: the panel is the proof
 * for every one of them, not for whichever happens to be level with it.
 */
function DuplicateFlag() {
  return (
    <figure className="lg:sticky lg:top-28 lg:self-start">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.75, ease: EASE }}
      >
      <Lit className="mkt-elev overflow-hidden rounded-lg border border-border bg-card/70">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <Readout tone="ink">Adding to mandate</Readout>
          <Readout>Project Kestrel</Readout>
        </div>

        <div className="px-4 py-4">
          <p className="mkt-subhead text-[15px] text-foreground">Ardent Materials Pvt Ltd</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Speciality chemicals · Pune · Strategic buyer
          </p>
        </div>

        {/* The flag. Amber, because on this page amber means "look here", and
            it arrives a beat after the row above it, which is the order the
            analyst experiences: you type the name, then the system objects. */}
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          whileInView={{ opacity: 1, height: "auto" }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.45 }}
          className="overflow-hidden border-t border-primary/25 bg-primary/[0.07]"
        >
          <div className="px-4 py-4">
            <Readout tone="signal" className="block">
              Already in play
            </Readout>
            <p className="mt-2.5 text-sm leading-relaxed text-foreground/90">
              This buyer is live on <span className="font-medium">Project Halvorsen</span>, owned by
              Priya Raghavan.
            </p>
            <dl className="mt-4 space-y-2 border-t border-primary/20 pt-3.5 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Last touched</dt>
                <dd className="font-mono text-foreground/80">14 Mar 2026</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Outcome</dt>
                <dd className="font-mono text-foreground/80">Declined</dd>
              </div>
            </dl>
            <p className="mt-3.5 border-t border-primary/20 pt-3.5 text-xs leading-relaxed text-muted-foreground">
              &ldquo;Not looking at this sector again until FY27.&rdquo;
            </p>
          </div>
        </motion.div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <Readout>Add anyway, or reassign</Readout>
          <span className="font-mono text-[10px] tracking-[0.13em] text-muted-foreground uppercase">
            Advisory, not a block
          </span>
        </div>
      </Lit>
      </motion.div>

      <figcaption className="mt-4 text-xs leading-relaxed text-muted-foreground text-pretty">
        The check runs before the email, not after the buyer mentions it. Names and dates here are
        illustrative.
      </figcaption>
    </figure>
  );
}
