import { Reveal } from "@/components/reveal";
import { CadenceDemo } from "@/components/marketing/cadence";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { Faq } from "@/components/marketing/faq";
import { Hero } from "@/components/marketing/hero";
import { Memory } from "@/components/marketing/memory";
import { Problem } from "@/components/marketing/problem";
import { ReadingChrome } from "@/components/marketing/reading-chrome";
import { Security } from "@/components/marketing/security";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";

/**
 * The argument, in seven beats instead of fourteen.
 *
 *   hero      the promise, over a real queue
 *   problem   four failures, human first, each pointing at its answer
 *   cadence   the follow-up clock, running, not asserted
 *   memory    the moat: what the second mandate knows
 *   security  the buyer list is the secret
 *   faq       the objections that actually come up
 *   closing   one mandate, beside the sheet
 *
 * A prior version ran to fourteen sections (modules, personas, scope, a
 * migration guide, a reach line) that mostly restated hero, problem, cadence
 * and memory in a second register. Cutting them did not remove an argument,
 * it removed the second telling of one. What is left is the shape a person
 * actually reads: a promise, the pain it answers, proof it computes correctly,
 * why the record compounds, why it is safe to hold, and what stops someone
 * from starting.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <ReadingChrome />
      <main id="content" tabIndex={-1} className="outline-none">
        <Hero />
        <Reveal>
          <Problem />
        </Reveal>
        <CadenceDemo />
        <Reveal>
          <Memory />
        </Reveal>
        <Security />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}
