import { CAPABILITIES } from "@/content/site";
import { cn } from "@/lib/utils";
import { BandLabel, Container, Section } from "./primitives";

/**
 * The instrument-panel band under the hero: hairline-divided cells reading out the
 * loop the product runs — source, reach, track, remember.
 *
 * It used to count up four figures from a seeded demo database. Every organisation's
 * aggregates differ, so the band states the loop instead — same slot, same rhythm.
 */
export function Stats() {
  return (
    <Section band aria-label="How Upstream works">
      <Container>
        <BandLabel>One loop, one record</BandLabel>

        <dl className="mt-10 grid grid-cols-2 gap-y-10 sm:gap-x-8 lg:grid-cols-4">
          {CAPABILITIES.map((c, i) => (
            /* dt first, dd after — a <dl> may only hold properly-ordered term/
               description pairs. The label is the term, so DOM order already
               reads "Source · search one shared pool…" to a screen reader. */
            <div
              key={c.label}
              className={cn(
                "flex flex-col items-center px-4 text-center lg:items-start lg:text-left",
                // Hairline rules between cells — an instrument-panel readout.
                i > 0 && "lg:border-l lg:border-border",
              )}
            >
              <dt
                className="font-display text-2xl leading-tight font-medium tracking-tight text-foreground sm:text-3xl"
                style={{ letterSpacing: "-0.02em" }}
              >
                {c.label}
              </dt>
              <dd className="mt-3 max-w-[15rem] text-sm leading-relaxed text-muted-foreground text-pretty">
                {c.context}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </Section>
  );
}
