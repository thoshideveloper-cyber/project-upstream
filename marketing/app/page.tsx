import { MotionConfig } from "motion/react";

import { Closing } from "@/components/site/closing";
import { Cost, Turn } from "@/components/site/cost";
import { Depth } from "@/components/site/depth";
import { Desk } from "@/components/site/desk";
import { Hero } from "@/components/site/hero";
import { Mechanism } from "@/components/site/mechanism";
import { Questions } from "@/components/site/questions";
import { Record } from "@/components/site/record";
import { SiteFooter } from "@/components/site/footer";
import { SiteNav } from "@/components/site/nav";

/**
 * The argument, as one descent.
 *
 *   hero       THE FILM      the current, scrubbed, settling into the queue
 *   cost       THE LOSSES    four things that happened, and how late you heard
 *   turn       THE BREATH    one line: they are all the same failure
 *   mechanism  THE ACT       the reader logs one email and watches four
 *                            consequences derive themselves
 *   desk       THE PROOF     three real screens, held while you read them
 *   record     THE DEPTH     the page goes under: one name, two mandates
 *   depth      THE SEAL      who can see the book, and why a URL cannot argue
 *   questions  THE OBJECTION the first one is the one they are all thinking
 *   closing    THE MOUTH     back to the surface, one call to action
 *
 * Three things about this order are deliberate.
 *
 * **The mechanism sits before the screenshots.** The usual move is to show the
 * product first and explain second. But the claim this product lives or dies on
 * is that the record maintains itself, and a reader who has performed that with
 * their own hand reads the three screenshots afterwards as evidence rather than
 * as pictures.
 *
 * **The page changes ground exactly once.** The record and access folds are
 * underwater. That is the only dark stretch, it is two folds long, and it lands
 * on the two subjects that are actually about what is hidden. A page that flips
 * ground every second fold is a page where the flip means nothing.
 *
 * **Density alternates.** Dense, quiet, dense. The turn is one sentence on a
 * mostly empty band between the two heaviest folds on the page, because a page
 * that is uniformly dense is exhausting and this product is dense.
 */
export default function LandingPage() {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.62 }}>
      <div className="min-h-screen">
        <SiteNav />
        <main id="content" tabIndex={-1} className="outline-none">
          <Hero />
          <Cost />
          <Turn />
          <Mechanism />
          <Desk />
          <Record />
          <Depth />
          <Questions />
          <Closing />
        </main>
        <SiteFooter />
      </div>
    </MotionConfig>
  );
}
