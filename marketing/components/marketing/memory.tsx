import { MOAT } from "@/content/site";
import { Lit } from "./lit";
import { Container, Readout, Section, SectionHead, Subhead } from "./primitives";

/**
 * Cross-mandate memory, given its own fold.
 *
 * The brief (§6.4) is blunt about this one: "This is what makes Upstream more
 * than a prettier spreadsheet and is the source of long-term lock-in." It used
 * to be one card in a grid of six, sized and weighted exactly like Governance
 * and Oversight, which told the reader it mattered exactly as much as they do.
 *
 * The panel on the right is the moment the feature actually happens: an analyst
 * types a company that another desk is already working, and the system says so
 * before the email goes rather than after the target does. Showing the warning
 * is worth more than three bullets describing a warning.
 */
export function Memory() {
  return (
    <Section id="memory" rhythm="loose">
      <Container>
        <SectionHead
          variant="split"
          title="The second mandate should know what the first one learned."
        >
          One sheet per mandate means the firm forgets everything the moment a deal closes.
          Upstream keeps the record at the firm, so it compounds instead.
        </SectionHead>

        <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
          {/* The three beats, on a spine */}
          <ol className="mkt-cascade relative">
            <span
              aria-hidden
              className="absolute top-2 bottom-2 left-[3px] w-px bg-gradient-to-b from-primary/40 via-border to-transparent"
            />
            {MOAT.map((m, i) => (
              <li key={m.title} className="relative pb-10 pl-8 last:pb-0">
                <span
                  aria-hidden
                  className="absolute top-[0.45rem] left-0 size-[7px] rounded-full bg-primary ring-4 ring-background"
                />
                <Subhead className="text-lg md:text-xl">{m.title}</Subhead>
                <p className="mt-2.5 max-w-[56ch] text-sm leading-relaxed text-muted-foreground text-pretty">
                  {m.detail}
                </p>
                <span className="sr-only">{`Step ${i + 1} of ${MOAT.length}`}</span>
              </li>
            ))}
          </ol>

          {/* The moment itself */}
          <figure className="lg:sticky lg:top-28 lg:self-start">
            <Lit as="div" className="mkt-enter mkt-elev overflow-hidden rounded-xl border border-border bg-card/60">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <Readout tone="ink">Adding to mandate</Readout>
                <Readout>Project Kestrel</Readout>
              </div>

              <div className="px-4 py-4">
                <p className="text-[15px] font-medium text-foreground">Ardent Materials Pvt Ltd</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Speciality chemicals · Pune · Strategic buyer
                </p>
              </div>

              {/* The flag. Amber, because on this page amber means "look here". */}
              <div className="border-t border-primary/25 bg-primary/[0.07] px-4 py-4">
                <Readout tone="signal" className="block">
                  Already in play
                </Readout>
                <p className="mt-2.5 text-sm leading-relaxed text-foreground/90">
                  This buyer is live on <span className="font-medium">Project Halvorsen</span>,
                  owned by Priya Raghavan.
                </p>
                <dl className="mt-4 space-y-2 border-t border-primary/20 pt-3.5 text-xs">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Last touched</dt>
                    <dd className="font-mono text-foreground/80">14 Mar 2026</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Outcome</dt>
                    <dd className="font-mono text-foreground/80">Declined</dd>
                  </div>
                </dl>
                <p className="mt-3.5 border-t border-primary/20 pt-3.5 text-xs leading-relaxed text-muted-foreground">
                  &ldquo;Not looking at this sector again until FY27.&rdquo;
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                <Readout>Add anyway, or reassign</Readout>
                <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                  Advisory, not a block
                </span>
              </div>
            </Lit>

            <figcaption className="mt-3.5 text-xs leading-relaxed text-muted-foreground text-pretty">
              The check runs before the email, not after the buyer mentions it. Names and dates
              here are illustrative.
            </figcaption>
          </figure>
        </div>
      </Container>
    </Section>
  );
}
