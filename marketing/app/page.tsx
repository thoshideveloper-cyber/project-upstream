import { Choreography } from "@/components/motion/primitives";
import { Clock } from "@/components/marketing/clock";
import { Closing } from "@/components/marketing/closing";
import { Desk } from "@/components/marketing/desk";
import { Faq } from "@/components/marketing/faq";
import { Hero } from "@/components/marketing/hero";
import { Ledger, LedgerTurn } from "@/components/marketing/ledger";
import { ReadingChrome } from "@/components/marketing/reading-chrome";
import { Record } from "@/components/marketing/record";
import { Secret } from "@/components/marketing/secret";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";

/**
 * The argument, as a film.
 *
 *   hero      OPEN        the promise, over a real queue
 *   ledger    SETUP       four failures, stated as losses already taken
 *   turn      BREATH      the one thing all four have in common
 *   desk      DISCOVERY   what it actually is, in screenshots
 *   clock     BUILD       the mechanism, running, operable, not asserted
 *   record    PAYOFF      the moat: what the second mandate knows
 *   secret    ASSURANCE   the buyer list is the secret, so who can see it
 *   faq       OBJECTIONS  what is left after all of that
 *   closing   RESOLUTION  one mandate, beside the sheet
 *
 * Two things about this order are worth defending.
 *
 * **The desk sits third, not last.** A previous cut ran hero → problem →
 * cadence → memory → security → faq → cta and never showed the product, on the
 * reasoning that mechanism beats screenshots. It does, for a reader who has
 * already decided the thing is real. Nobody at fold three has. The screenshots
 * do the work that no amount of prose does, which is to let an analyst picture
 * a Tuesday morning inside it, and everything after them is read differently
 * because of it.
 *
 * **Density alternates.** Dense fold, quiet fold, dense fold. The ledger and
 * the desk are heavy; the turn between them is one sentence on a mostly empty
 * band; the record opens on a statement before it gets to work. A page that is
 * uniformly dense is exhausting and a page that is uniformly airy says nothing,
 * and this product is dense, so the rhythm has to earn the quiet.
 */
export default function LandingPage() {
  return (
    <Choreography>
      <div className="min-h-screen">
        <SiteNav />
        <ReadingChrome />
        <main id="content" tabIndex={-1} className="outline-none">
          <Hero />
          <Ledger />
          <LedgerTurn />
          <Desk />
          <Clock />
          <Record />
          <Secret />
          <Faq />
          <Closing />
        </main>
        <SiteFooter />
      </div>
    </Choreography>
  );
}
