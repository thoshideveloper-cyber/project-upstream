import { Reveal } from "@/components/reveal";
import { CadenceDemo } from "@/components/marketing/cadence";
import { Capabilities } from "@/components/marketing/capabilities";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Integrations } from "@/components/marketing/integrations";
import { LogoCloud } from "@/components/marketing/logo-cloud";
import { Personas } from "@/components/marketing/personas";
import { Problem } from "@/components/marketing/problem";
import { Reach } from "@/components/marketing/reach";
import { ReadingChrome } from "@/components/marketing/reading-chrome";
import { Replaces } from "@/components/marketing/replaces";
import { Security } from "@/components/marketing/security";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";
import { Stats } from "@/components/marketing/stats";
import { Testimonials } from "@/components/marketing/testimonials";

/**
 * The argument, in order.
 *
 *   the loop            what this thing does, in four words
 *   the problem         the week you recognise
 *   what it plugs into  does it fit how we already work
 *   the modules         three real screens
 *   the cadence demo    the one mechanic, running, not asserted
 *   the surface         everything the screens don't show
 *   who it's for        the two people who have to both say yes
 *   what changes        the comparison a buyer is already running
 *   how you start       and how quickly
 *   the guarantees      security, one clock
 *   objections          the FAQ
 *   the ask             the close
 *
 * The demo sits directly after the modules on purpose: the tabs have just shown
 * an outreach queue full of computed dates, and the obvious next question is
 * whether the computing is real. Answering it there is worth more than another
 * paragraph claiming it later.
 *
 * <Reveal> is on four sections, not on all of them. It used to wrap every one,
 * which turned the same 20px rise into the page's dominant rhythm; a reader
 * scrolling past nine identical entrances stops reading them as motion and
 * starts reading them as a slideshow. It's kept where a section has items worth
 * staggering or a drawn element that needs a trigger.
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
          <Capabilities />
        </Reveal>
        <Personas />
        <Reveal>
          <Replaces />
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
