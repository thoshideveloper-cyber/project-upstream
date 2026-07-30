import { PERSONAS } from "@/content/site";
import { Card, CardTitle, CheckItem, Container, Section, SectionIntro } from "./primitives";

/**
 * The two people the product has to win separately (product brief §3): the person
 * who lives in it daily, and the person who answers for the whole book. They want
 * opposite things from the same record, and the page has to say so — one of them
 * won't adopt it and the other won't pay for it otherwise.
 */
export function Personas() {
  return (
    <Section id="teams">
      <Container>
        <SectionIntro eyebrow="Both sides of the team" title="One record. Two very different jobs.">
          The person doing the outreach needs speed. The person accountable for it needs certainty.
        </SectionIntro>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {PERSONAS.map((p) => (
            <Card key={p.label}>
              <span className="font-mono text-[11px] tracking-[0.2em] text-primary-ink uppercase">
                {p.label}
              </span>
              <CardTitle className="mt-4">{p.title}</CardTitle>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground text-pretty">
                {p.blurb}
              </p>
              <ul className="mt-5 space-y-3 border-t border-border/60 pt-5">
                {p.points.map((point) => (
                  <CheckItem key={point}>{point}</CheckItem>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
