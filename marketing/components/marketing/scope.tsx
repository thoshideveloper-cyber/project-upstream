import { DOES, DOES_NOT, LANES } from "@/content/site";
import { Container, Marker, Readout, Section, SectionHead, Subhead } from "./primitives";

/**
 * What it does, what it refuses to do, and where that puts it.
 *
 * This replaces a 3×2 grid of identical capability cards: icon chip, title,
 * blurb, hairline, three bullets, six times. That grid was the most generic
 * thing on the page, and on a section arguing "we are not one module" it made
 * the opposite argument by giving six things identical weight.
 *
 * What is here instead comes straight out of the brief. §5.1 is a two-column
 * "we ARE solving / we are NOT doing" table and §8 is an explicit out-of-scope
 * list, and both are more persuasive than another capability claim. Everyone
 * evaluating software has been told that everything is possible; the page that
 * names its own limits is the one that gets believed. The "when" column turns
 * the refusals into a roadmap rather than a list of gaps.
 *
 * The lanes underneath describe the competitive map by category rather than by
 * company, which keeps internal research out of a public claim about someone
 * else's product.
 */
export function Scope() {
  return (
    <Section id="scope">
      <Container>
        <SectionHead variant="statement" title="Narrow on purpose." />
        <p className="mt-6 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground text-pretty md:text-base">
          Upstream does the upstream stage of a mandate and stops. That is a decision, not a
          gap, and it is the reason the thing is fast enough that an analyst will actually use
          it on a Tuesday.
        </p>

        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2">
          <div className="flex flex-col bg-card/40 p-6 md:p-8">
            <Readout tone="signal" className="block">
              What it does
            </Readout>
            <ul className="mt-6 space-y-3.5">
              {DOES.map((d) => (
                <Marker key={d}>{d}</Marker>
              ))}
            </ul>
            {/* Also load-bearing for the layout: the refusals column carries a
                "when" line under each item and runs taller, so this closes the
                height gap with a sentence worth reading rather than padding. */}
            <p className="mt-auto pt-8 text-xs leading-relaxed text-muted-foreground text-pretty">
              Four lines. That is the whole surface, which is why an analyst can learn it between
              two calls instead of between two quarters.
            </p>
          </div>

          <div className="bg-background p-6 md:p-8">
            <Readout className="block">What it does not</Readout>
            <ul className="mt-6 space-y-4">
              {DOES_NOT.map((d) => (
                <li key={d.item}>
                  {/* Struck through, because the point is that these are refused
                      rather than missing. The "when" underneath is what turns
                      the refusal into a position instead of an apology. */}
                  <p className="text-sm leading-relaxed text-muted-foreground line-through decoration-muted-foreground/40">
                    {d.item}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground/70">{d.when}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* The competitive map, by lane */}
        <div className="mt-16">
          <Readout className="block">Where that puts it</Readout>

          <ul className="mt-6">
            {LANES.map((l, i) => {
              const ours = i === LANES.length - 1;
              return (
                <li
                  key={l.lane}
                  className={`grid gap-x-8 gap-y-2 border-t border-border py-7 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,1fr)] ${
                    ours ? "border-t-primary/30" : ""
                  }`}
                >
                  <Subhead className={ours ? "text-primary-ink" : "text-foreground/70"}>
                    {l.lane}
                  </Subhead>
                  <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                    {l.what}
                  </p>
                  <p
                    className={`text-sm leading-relaxed text-pretty ${
                      ours ? "font-medium text-foreground/90" : "text-muted-foreground"
                    }`}
                  >
                    {l.gap}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
