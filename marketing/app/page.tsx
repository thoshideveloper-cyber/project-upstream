import { Reveal } from "@/components/reveal";
import { CadenceDemo } from "@/components/marketing/cadence";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Integrations } from "@/components/marketing/integrations";
import { LogoCloud } from "@/components/marketing/logo-cloud";
import { Memory } from "@/components/marketing/memory";
import { Personas } from "@/components/marketing/personas";
import { Problem } from "@/components/marketing/problem";
import { Reach } from "@/components/marketing/reach";
import { ReadingChrome } from "@/components/marketing/reading-chrome";
import { Scope } from "@/components/marketing/scope";
import { Security } from "@/components/marketing/security";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";
import { Stats } from "@/components/marketing/stats";
import { Testimonials } from "@/components/marketing/testimonials";

/**
 * The argument, in the order a deal desk would actually ask for it.
 *
 *   hero        the promise, over a real queue
 *   loop        the four words the product is
 *   problem     four failures, each pointing at the section that answers it
 *   integrations does it fit the way we already send mail
 *   modules     the three sheets, as three screens
 *   cadence     the follow-up clock, running, not asserted
 *   memory      the moat: what the second mandate knows
 *   personas    the two people who both have to say yes
 *   scope       what it refuses to do, and where that puts it
 *   how         days to live, and what week one is
 *   security    the buyer list is the secret
 *   reach       one clock, many markets
 *   faq         objections, none of them restating the above
 *   closing     one mandate, beside the sheet
 *
 * The problem section links forward to `#memory` and `#cadence` rather than
 * answering itself, which is what stopped the middle of the page restating the
 * same six claims four times each. Each claim now has exactly one home; the
 * ledger is in content/site.ts.
 *
 * <Reveal> is on four sections, not on all of them. Nine identical entrances
 * stop reading as motion and start reading as a slideshow, so it is kept where a
 * section has items worth staggering or a drawn element that needs a trigger.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <ReadingChrome />
      <main id="content" tabIndex={-1} className="outline-none">
        <Hero />
        <Stats />
        <Reveal>
          <Problem />
        </Reveal>
        <LogoCloud />
        <Integrations />
        <Features />
        <CadenceDemo />
        <Reveal>
          <Memory />
        </Reveal>
        <Personas />
        <Reveal>
          <Scope />
        </Reveal>
        <Reveal>
          <HowItWorks />
        </Reveal>
        <Security />
        <Reach />
        <Testimonials />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}
