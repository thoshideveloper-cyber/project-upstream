"use client";

import { useState } from "react";

import { FAQ as QA, CTA_HREF } from "@/content/site";
import { cn } from "@/lib/utils";
import { Container, CTALink, Display, Lede, Section } from "./primitives";

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="faq">
      <Container>
        <div className="grid gap-10 md:grid-cols-[0.75fr_1.25fr] md:gap-16">
          <div className="md:sticky md:top-28 md:self-start">
            <Display>Questions, answered.</Display>
            <Lede className="mt-5 max-w-[38ch]">
              Everything teams ask before moving off spreadsheets.
            </Lede>
            <CTALink href={CTA_HREF} className="mt-6">
              Still curious? Book a demo
            </CTALink>
          </div>

          <ul className="border-t border-border">
            {QA.map((item, i) => {
              const on = open === i;
              return (
                <li key={item.q} className="border-b border-border">
                  <button
                    type="button"
                    onClick={() => setOpen(on ? null : i)}
                    aria-expanded={on}
                    aria-controls={`faq-answer-${i}`}
                    id={`faq-question-${i}`}
                    className="group flex w-full items-center justify-between gap-5 py-5 text-left transition-colors hover:text-foreground"
                  >
                    <span
                      className={cn(
                        "text-[15px] font-medium transition-colors md:text-base",
                        on ? "text-foreground" : "text-foreground/80 group-hover:text-foreground",
                      )}
                    >
                      {item.q}
                    </span>
                    {/* Two rules crossing, not a rotating glyph: the vertical bar
                        collapses into the horizontal one, so the control shows
                        which way it's about to go. */}
                    <span aria-hidden className="relative size-3.5 shrink-0">
                      <span
                        className={cn(
                          "absolute top-1/2 left-0 h-px w-full -translate-y-1/2 transition-colors duration-300",
                          on ? "bg-primary" : "bg-muted-foreground group-hover:bg-foreground",
                        )}
                      />
                      <span
                        className={cn(
                          "absolute top-0 left-1/2 h-full w-px -translate-x-1/2 transition-all duration-300",
                          on
                            ? "scale-y-0 bg-primary"
                            : "scale-y-100 bg-muted-foreground group-hover:bg-foreground",
                        )}
                      />
                    </span>
                  </button>

                  {/* `invisible` when closed, not just clipped: a 0fr grid row with
                      overflow-hidden still sits in the accessibility tree, so a
                      screen reader read every answer whatever was expanded. */}
                  <div
                    id={`faq-answer-${i}`}
                    role="region"
                    aria-labelledby={`faq-question-${i}`}
                    className={cn(
                      "grid transition-all duration-300 ease-out",
                      on ? "grid-rows-[1fr] pb-6 opacity-100" : "invisible grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <p className="max-w-[68ch] overflow-hidden text-sm leading-relaxed text-muted-foreground text-pretty">
                      {item.a}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
