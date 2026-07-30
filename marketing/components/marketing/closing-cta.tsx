import { ArrowRight } from "lucide-react";

import { SIGN_IN_URL } from "@/content/site";
import { Container, CTAGhost, CTAPrimary, DisplayHeading, Section } from "./primitives";

/**
 * The reassurance that makes clicking cheap — risk reversal, one line each. No
 * durations: how long a rollout takes depends on the team, so none is promised.
 */
const REASSURANCE = ["A live walkthrough", "Your sheets, imported live", "No migration project"];

export function ClosingCta() {
  return (
    <Section motion rule={false}>
      <Container>
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card/40 px-6 py-16 text-center md:px-8">
          <div aria-hidden className="mkt-grid pointer-events-none absolute inset-0 opacity-40" />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 size-[30rem] -translate-x-1/2 rounded-full"
            style={{ background: "radial-gradient(circle, oklch(0.72 0.16 58 / 0.18), transparent 65%)" }}
          />
          <div className="relative">
            <DisplayHeading className="mx-auto max-w-2xl">
              Get your team out of spreadsheets.
            </DisplayHeading>
            {/* One last loss-aversion beat, then the relief. */}
            <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground text-pretty">
              Somewhere on the list a follow-up is already late, and somewhere in an inbox is
              something the next project needs to know. Put both on one record.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <CTAPrimary href={SIGN_IN_URL} className="mkt-shimmer">
                Book a demo
                <ArrowRight className="size-4" />
              </CTAPrimary>
              <CTAGhost href={SIGN_IN_URL}>See the live demo</CTAGhost>
            </div>

            <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[11px] tracking-[0.15em] text-muted-foreground uppercase">
              {REASSURANCE.map((r) => (
                <li key={r} className="flex items-center gap-1.5">
                  <span aria-hidden className="size-1 rounded-full bg-primary" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </Section>
  );
}
