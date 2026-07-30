import { PERSONAS } from "@/content/site";
import { Container, Marker, Readout, Section, SectionHead, Subhead } from "./primitives";

/**
 * The two people the product has to win separately (product brief §3): the person
 * who lives in it daily, and the person who answers for the whole book. They want
 * opposite things from the same record, and the page has to say so — one of them
 * won't adopt it and the other won't pay for it otherwise.
 *
 * A diptych rather than two cards. The section's whole point is that these are
 * two halves of one record, and two bordered boxes side by side said the
 * opposite: two products. One rule down the middle, nothing around the edges.
 */
export function Personas() {
  return (
    <Section id="teams" rhythm="loose">
      <Container>
        <SectionHead variant="split" title="One record. Two very different jobs.">
          The person doing the outreach needs speed. The person accountable for it needs certainty.
        </SectionHead>

        <div className="mt-14 grid gap-12 md:grid-cols-2 md:gap-0">
          {PERSONAS.map((p, i) => (
            <div
              key={p.label}
              className={
                i === 0
                  ? "md:pr-12 lg:pr-16"
                  : "border-t border-border pt-12 md:border-t-0 md:border-l md:pt-0 md:pl-12 lg:pl-16"
              }
            >
              <Readout tone="signal">{p.label}</Readout>
              <Subhead className="mt-4 text-xl md:text-2xl">{p.title}</Subhead>
              <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-muted-foreground text-pretty">
                {p.blurb}
              </p>
              <ul className="mt-7 space-y-3">
                {p.points.map((point) => (
                  <Marker key={point}>{point}</Marker>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
