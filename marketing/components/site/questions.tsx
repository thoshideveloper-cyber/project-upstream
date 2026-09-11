import Link from "next/link";

import { CTA_HREF, FAQ, FAQ_HEAD } from "@/content/site";
import { Fold } from "./fold";
import { Reveal, Stamp } from "./primitives";

/**
 * What is left.
 *
 * Five questions, and the first one is the only one that matters: every desk
 * reading this has already bought a CRM that died because nobody updated it.
 * Answering that objection last, or not at all, is the same as not answering
 * it. Nothing here restates a fold above; the questions are the ones the page
 * has not already dealt with.
 *
 * Native disclosure elements, so a question opens with no JavaScript at all,
 * the browser handles the keyboard for free, and find-in-page reaches the
 * answers. The first is open on load so the fold never reads as five closed
 * doors.
 */
export function Questions() {
  return (
    <Fold id="questions" stamp="the objections" className="pt-28 pb-16 lg:pt-36 lg:pb-20">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-20">
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <Stamp>Straight answers</Stamp>
          <h2 className="u-display mt-4 text-[clamp(1.75rem,3.4vw,2.75rem)]">{FAQ_HEAD}</h2>
          {/* The column would otherwise be a heading and eight inches of
              nothing, and the one question this page cannot anticipate is the
              one worth answering in person. */}
          <p className="mt-6 max-w-[28ch] text-[0.9375rem] leading-relaxed text-fg-muted">
            If the thing your desk actually worries about is not here, it is
            probably specific to your book. Ask.
          </p>
          <Link
            href={CTA_HREF}
            prefetch={false}
            className="u-target u-mono mt-4 inline-block text-[0.8125rem] text-accent underline decoration-[color:color-mix(in_oklab,var(--accent)_40%,transparent)] underline-offset-4 hover:decoration-current"
          >
            Talk to us
          </Link>
        </Reveal>

        <Reveal delay={0.06} className="border-t border-hair">
          {FAQ.map((qa, i) => (
            <details
              key={qa.q}
              open={i === 0}
              className="group border-b border-hair py-5 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="u-target flex cursor-pointer list-none items-baseline justify-between gap-6 text-left">
                <span className="u-subhead text-[clamp(1rem,1.6vw,1.1875rem)]">{qa.q}</span>
                {/* A mark that turns, not an icon that swaps: one glyph, one
                    state change, and nothing to load. */}
                <span
                  aria-hidden
                  className="u-mono mt-1 shrink-0 text-[0.875rem] text-fg-muted transition-transform duration-300 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-[68ch] text-[0.9375rem] leading-relaxed text-fg-muted">
                {qa.a}
              </p>
            </details>
          ))}
        </Reveal>
      </div>
    </Fold>
  );
}
