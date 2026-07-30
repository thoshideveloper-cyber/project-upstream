import { Reveal } from "@/components/reveal";
import { Capabilities } from "@/components/marketing/capabilities";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { LogoCloud } from "@/components/marketing/logo-cloud";
import { Personas } from "@/components/marketing/personas";
import { Problem } from "@/components/marketing/problem";
import { Reach } from "@/components/marketing/reach";
import { Security } from "@/components/marketing/security";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";
import { Stats } from "@/components/marketing/stats";
import { Testimonials } from "@/components/marketing/testimonials";
import { SHOW_REVIEWS_SECTION } from "@/content/site";

/**
 * The argument, in order: the loop → what's broken → the loop again, named →
 * the modules → the rest of the surface → who it's for → how you start → the
 * guarantees → proof → objections → the ask.
 *
 * <Reveal> is on four sections, not on nine. It used to wrap every one of them,
 * which turned the same 24px rise into the page's dominant rhythm — a reader
 * scrolling past nine identical entrances stops reading them as motion and
 * starts reading them as a slideshow. It's kept where the section has internal
 * items worth staggering (the defect log, the bento, the numbered steps) or a
 * drawn element that needs a trigger (the how-it-works rail). The sections in
 * between simply arrive, which is what makes the four that move register at all.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main id="content" tabIndex={-1} className="outline-none">
        <Hero />
        <Stats />
        <Reveal>
          <Problem />
        </Reveal>
        <LogoCloud />
        <Features />
        <Reveal>
          <Capabilities />
        </Reveal>
        <Personas />
        <Reveal>
          <HowItWorks />
        </Reveal>
        <Security />
        <Reach />
        {/* Testimonials guards itself too, but the wrapper has to go with it —
            an empty section would leave the rhythm behind it. */}
        {SHOW_REVIEWS_SECTION && <Testimonials />}
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}
