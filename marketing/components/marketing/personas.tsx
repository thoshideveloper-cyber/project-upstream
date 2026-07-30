import { PERSONAS } from "@/content/site";
import { Container, Marker, Readout, Section, SectionHead, Subhead } from "./primitives";

/**
 * The two people, from the brief's own table (§3).
 *
 * The brief draws a hard line here: "the daily user and the economic buyer are
 * different people, and the product must serve both". The analyst adopts it or
 * nobody uses it; the partner signs for it or nobody buys it. They want opposite
 * things from the same record, and a page that blurs them into "teams" loses the
 * only insight in the section.
 *
 * A diptych with one rule down the middle, because the whole point is that these
 * are two halves of one record. Two bordered cards said: two products.
 */
export function Personas() {
  return (
    <Section id="teams" rhythm="loose">
      <Container>
        <SectionHead variant="split" title="Two people have to say yes, and they want opposite things.">
          The analyst is judged on speed. The partner is judged on nothing going wrong. The same
          record has to satisfy both or the rollout stalls in week three.
        </SectionHead>

        <div className="mkt-cascade mt-14 grid gap-12 md:grid-cols-2 md:gap-0">
          {PERSONAS.map((p, i) => (
            <div
              key={p.label}
              className={
                i === 0
                  ? "md:pr-12 lg:pr-16"
                  : "border-t border-border pt-12 md:border-t-0 md:border-l md:pt-0 md:pl-12 lg:pl-16"
              }
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Readout tone="signal">{p.label}</Readout>
                <span className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground">
                  {p.who}
                </span>
              </div>

              <Subhead className="mt-4 text-xl md:text-2xl">{p.title}</Subhead>
              <p className="mt-3 max-w-[48ch] text-sm leading-relaxed text-muted-foreground text-pretty">
                {p.blurb}
              </p>
              <ul className="mt-7 space-y-3 border-t border-border pt-6">
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
