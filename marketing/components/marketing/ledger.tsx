"use client";

import { motion } from "motion/react";

import { FAILURES } from "@/content/site";
import { Cascade, CascadeItem, EASE } from "@/components/motion/primitives";
import { Container, Display, Gutter, Lede, Readout, Section, Stamp } from "./primitives";

/**
 * The four failures, set as a ledger rather than a grid of cards.
 *
 * The card grid was the wrong form for this content twice over. It gave four
 * unrelated-looking tiles equal visual weight, and it made complaints look like
 * features, because an icon over a bold line over a paragraph is the shape of a
 * feature card and a reader has seen ten thousand of them.
 *
 * A ledger fixes both. Rows share a rule, so they read as one list of entries
 * in one book. And the third column, which is the actual argument, becomes a
 * column you can read straight down:
 *
 *   You find out from the target.
 *   You find out three weeks late.
 *   You never find out.
 *   You find out in the handover.
 *
 * That column is the section. Everything left of it is the setup.
 *
 * These rows deliberately do NOT explain how Upstream fixes each one. That was
 * the old shape, and it meant every mechanism on the page was introduced here
 * and then explained properly again two folds later. Each row points at the
 * section that owns its answer instead, which also gives the reader a working
 * table of contents for the argument.
 */
export function Ledger() {
  return (
    <Section id="ledger" rhythm="base">
      <Container>
        <Gutter stamp="01 / The cost">
          <div className="grid gap-6 border-b border-border pb-12 md:grid-cols-[1.1fr_1fr] md:items-end md:gap-12">
            <Display>Four ways a live mandate quietly costs you money.</Display>
            <Lede className="md:pb-1">
              None of these are hypothetical. They are the failures the desk this was built for
              hit often enough to stop complaining and go and build something.
            </Lede>
          </div>

          <Cascade as="ol" className="divide-y divide-border" gap={0.08}>
            {FAILURES.map((f) => (
              <CascadeItem as="li" key={f.id}>
                <Row failure={f} />
              </CascadeItem>
            ))}
          </Cascade>
        </Gutter>
      </Container>
    </Section>
  );
}

function Row({ failure: f }: { failure: (typeof FAILURES)[number] }) {
  return (
    <motion.div
      initial="rest"
      whileHover="hot"
      whileFocus="hot"
      className="group relative grid gap-x-10 gap-y-4 py-9 md:py-11 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_15rem]"
    >
      {/* The entry mark: a hairline in the far margin that fills amber as the
          row is read. Nothing translates, nothing lifts. On a page built out of
          rules, lighting a rule is the native way to say "this one". */}
      <motion.span
        aria-hidden
        className="absolute top-9 -left-4 hidden w-px origin-top bg-primary md:block"
        style={{ height: "calc(100% - 4.5rem)" }}
        variants={{ rest: { scaleY: 0, opacity: 0 }, hot: { scaleY: 1, opacity: 1 } }}
        transition={{ duration: 0.5, ease: EASE }}
      />

      <div className="lg:flex lg:gap-5">
        <Stamp className="mb-2.5 shrink-0 tabular-nums lg:mt-2 lg:mb-0">{f.id}</Stamp>
        <h3 className="mkt-subhead text-[1.35rem] text-foreground md:text-[1.55rem]">{f.pain}</h3>
      </div>

      <p className="max-w-[54ch] text-sm leading-relaxed text-muted-foreground text-pretty">
        {f.detail}
      </p>

      <div className="lg:text-right">
        {/* The column that is the argument. Destructive ink, because every one
            of these is a loss the firm has already taken by the time it lands. */}
        <p className="font-mono text-[13px] leading-snug font-medium text-balance text-destructive">
          {f.discovery}
        </p>
        <a
          href={f.answer.href}
          className="group/link mt-3 inline-flex items-center gap-1.5 text-sm text-foreground underline-offset-4 hover:underline"
        >
          {f.answer.label}
          <span
            aria-hidden
            className="text-primary transition-transform duration-200 group-hover/link:translate-x-0.5 motion-reduce:transition-none"
          >
            &rarr;
          </span>
        </a>
      </div>
    </motion.div>
  );
}

/**
 * The turn out of the ledger and into the product.
 *
 * All four failures above are one failure wearing four hats: the firm does not
 * hold its own memory. Saying that out loud, alone, on its own band, is what
 * makes the next fold land as an answer rather than as a feature tour. It is
 * also the page's first quiet moment, and a long page needs somewhere to
 * breathe between two dense folds.
 */
export function LedgerTurn() {
  return (
    <Section rule rhythm="tight" aria-label="What the four failures have in common">
      <Container>
        <Gutter stamp="01 → 02">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="mkt-display max-w-[26ch] text-[clamp(1.6rem,3.4vw,2.6rem)] text-foreground"
          >
            All four are the same failure.{" "}
            <span className="mkt-turn">The firm does not hold its own memory.</span>
          </motion.p>
          <Readout className="mt-6 block">So that is what was built</Readout>
        </Gutter>
      </Container>
    </Section>
  );
}
