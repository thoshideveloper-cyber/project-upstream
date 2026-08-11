"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { FAQ as QA, CTA_HREF } from "@/content/site";
import { cn } from "@/lib/utils";
import { EASE } from "@/components/motion/primitives";
import { Container, CTALink, Display, Gutter, Lede, Section } from "./primitives";

/**
 * The objections, and only the ones that actually come up.
 *
 * Nothing here restates the ledger, the desk, the clock, the record or the
 * secret. An FAQ that re-explains the page above it is not answering
 * questions, it is padding, and a reader can tell within two entries.
 *
 * The disclosure animates height rather than swapping a class on a `0fr` grid
 * row, and it unmounts on close. A collapsed panel that stays in the DOM with
 * `overflow: hidden` is still in the accessibility tree, which is how a screen
 * reader ends up reading all six answers whatever is expanded.
 */
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="faq" rhythm="base">
      <Container>
        <Gutter stamp="06 / Objections">
          <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
            <div className="md:sticky md:top-28 md:self-start">
              <Display>Questions, answered.</Display>
              <Lede className="mt-6 max-w-[34ch]">
                What teams ask after everything above, before moving a live mandate.
              </Lede>
              <CTALink href={CTA_HREF} className="mt-7">
                Still curious? Book a demo
              </CTALink>
            </div>

            <ul className="border-t border-border">
              {QA.map((item, i) => {
                const on = open === i;
                return (
                  <li key={item.q} className="border-b border-border">
                    <h3>
                      <button
                        type="button"
                        onClick={() => setOpen(on ? null : i)}
                        aria-expanded={on}
                        aria-controls={`faq-answer-${i}`}
                        id={`faq-question-${i}`}
                        className="group flex w-full items-center justify-between gap-6 py-5 text-left"
                      >
                        <span
                          className={cn(
                            "mkt-subhead text-[1.05rem] transition-colors md:text-[1.15rem]",
                            on ? "text-foreground" : "text-foreground/80 group-hover:text-foreground",
                          )}
                        >
                          {item.q}
                        </span>
                        {/* Two rules crossing, not a rotating chevron: the
                            vertical bar collapses into the horizontal one, so
                            the control shows which way it is about to go. */}
                        <span aria-hidden className="relative size-3.5 shrink-0">
                          <span
                            className={cn(
                              "absolute top-1/2 left-0 h-px w-full -translate-y-1/2 transition-colors duration-300",
                              on ? "bg-primary" : "bg-muted-foreground group-hover:bg-foreground",
                            )}
                          />
                          <motion.span
                            className={cn(
                              "absolute top-0 left-1/2 h-full w-px -translate-x-1/2",
                              on ? "bg-primary" : "bg-muted-foreground group-hover:bg-foreground",
                            )}
                            animate={{ scaleY: on ? 0 : 1 }}
                            transition={{ duration: 0.3, ease: EASE }}
                          />
                        </span>
                      </button>
                    </h3>

                    <AnimatePresence initial={false}>
                      {on && (
                        <motion.div
                          id={`faq-answer-${i}`}
                          role="region"
                          aria-labelledby={`faq-question-${i}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.34, ease: EASE }}
                          className="overflow-hidden"
                        >
                          <p className="max-w-[66ch] pb-6 text-sm leading-relaxed text-muted-foreground text-pretty">
                            {item.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          </div>
        </Gutter>
      </Container>
    </Section>
  );
}
