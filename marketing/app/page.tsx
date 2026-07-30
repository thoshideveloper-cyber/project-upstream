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

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main id="content" tabIndex={-1} className="outline-none">
        <Hero />
        <Reveal>
          <Problem />
        </Reveal>
        <LogoCloud />
        {/* Source → reach → track → remember, before any single module. */}
        <Stats />
        <Reveal>
          <Features />
        </Reveal>
        <Reveal>
          <Capabilities />
        </Reveal>
        <Reveal>
          <Personas />
        </Reveal>
        <Reveal>
          <HowItWorks />
        </Reveal>
        <Reveal>
          <Security />
        </Reveal>
        <Reveal>
          <Reach />
        </Reveal>
        {/* Testimonials guards itself too, but the wrapper has to go with it —
            an empty <Reveal> would leave the section's rhythm behind it. */}
        {SHOW_REVIEWS_SECTION && (
          <Reveal>
            <Testimonials />
          </Reveal>
        )}
        <Reveal>
          <Faq />
        </Reveal>
        <Reveal>
          <ClosingCta />
        </Reveal>
      </main>
      <SiteFooter />
    </div>
  );
}
