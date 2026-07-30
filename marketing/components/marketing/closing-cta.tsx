import { ArrowRight } from "lucide-react";

import { CTA_HREF } from "@/content/site";
import {
  Container,
  CTAGhost,
  CTALink,
  CTAPrimary,
  Display,
  Dot,
  Readout,
  Section,
} from "./primitives";

/**
 * The reassurance that makes clicking cheap — risk reversal, one line each. No
 * durations: how long a rollout takes depends on the team, so none is promised.
 */
const REASSURANCE = ["A live walkthrough", "We migrate your sheets", "One mandate first"];

export function ClosingCta() {
  return (
    // id: ReadingChrome retires its floating CTA when this panel comes into
    // view, so the duplicate never sits on top of the real one.
    <Section id="closing" motion rule={false} rhythm="loose">
      <Container>
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 px-5 py-16 text-center sm:px-8 md:py-20">
          <div aria-hidden className="mkt-grid pointer-events-none absolute inset-0 opacity-40" />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 size-[34rem] -translate-x-1/2 rounded-full"
            style={{
              background: "radial-gradient(circle, oklch(0.72 0.16 58 / 0.18), transparent 65%)",
            }}
          />
          <div className="relative">
            <Display className="mx-auto max-w-3xl">
              Bring one mandate. Keep the spreadsheet open.
            </Display>
            {/* Risk reversal, not a slogan. The offer is deliberately small,
                because the brief's adoption plan is design partners, not
                self-serve, and a small first ask is how that starts. */}
            <p className="mx-auto mt-5 max-w-[54ch] text-[15px] leading-relaxed text-muted-foreground text-pretty md:text-base">
              We will migrate one live mandate and run it beside the sheet it came from. If the
              analyst on it still opens the sheet after a week, we have not earned the rest.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <CTAPrimary href={CTA_HREF} className="mkt-shimmer">
                Book a demo
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </CTAPrimary>
              <CTAGhost href={CTA_HREF}>See the live demo</CTAGhost>
            </div>
            {/* The quiet third option: not everyone at this point is ready to
                talk to someone, and the alternative to a demo is an answer. */}
            <CTALink href="#faq" className="mt-6 justify-center text-muted-foreground">
              Read the FAQ first
            </CTALink>

            <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-2.5 border-t border-border pt-7">
              {REASSURANCE.map((r) => (
                <li key={r} className="flex items-center gap-2">
                  <Dot />
                  <Readout>{r}</Readout>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </Section>
  );
}
