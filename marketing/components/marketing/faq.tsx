"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { FAQ as QA, CTA_HREF } from "@/content/site";
import { cn } from "@/lib/utils";
import { Container, DisplayHeading, Eyebrow, Section } from "./primitives";

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="faq">
      <Container>
        <div className="grid gap-12 md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Eyebrow>Answers</Eyebrow>
            <DisplayHeading className="mt-5">Questions, answered.</DisplayHeading>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
              Everything teams ask before moving off spreadsheets. Still curious?{" "}
              {/* Underlined at rest: amber against muted body copy is a 1.65:1
                  difference, so colour alone never marked this as a link. */}
              {/* Link, not a raw <a>: a bare href skips Next's basePath, which
                  breaks this one CTA on a sub-path deployment. */}
              <Link
                href={CTA_HREF}
                prefetch={false}
                className="text-primary-ink underline underline-offset-4 hover:no-underline"
              >
                Book a demo
              </Link>
              .
            </p>
          </div>

          <ul className="divide-y divide-border border-y border-border">
            {QA.map((item, i) => {
              const on = open === i;
              return (
                <li key={item.q}>
                  <button
                    type="button"
                    onClick={() => setOpen(on ? null : i)}
                    aria-expanded={on}
                    aria-controls={`faq-answer-${i}`}
                    id={`faq-question-${i}`}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left"
                  >
                    <span className="text-[15px] font-medium text-foreground">{item.q}</span>
                    <Plus
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform duration-300",
                        on && "rotate-45 text-primary",
                      )}
                    />
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
                      on ? "grid-rows-[1fr] pb-5 opacity-100" : "invisible grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <p className="overflow-hidden text-sm leading-relaxed text-muted-foreground">
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
