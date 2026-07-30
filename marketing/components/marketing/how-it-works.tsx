import { Container, Readout, Section, SectionHead, Subhead } from "./primitives";

type Step = {
  /** Mono kicker — when this happens, so the three steps read as a timeline at a glance. */
  when: string;
  title: string;
  detail: string;
};

const STEPS: Step[] = [
  {
    when: "Week one",
    title: "We move the sheets, not you",
    detail:
      "Onboarding is the migration. Your columns get mapped, the duplicates already sitting in the files get shown to you, and one live mandate goes in first so you can hold it against the spreadsheet it came from.",
  },
  {
    when: "The same week",
    title: "One mandate runs on it",
    detail:
      "Not the whole book. One mandate, in parallel with the sheet, until the analyst on it stops opening the sheet. That usually takes a few days and it is the only adoption test that means anything.",
  },
  {
    when: "The mandate after",
    title: "The closed ones start paying",
    detail:
      "Load the mandates you have already closed. That is where the contact intelligence is, and it is what makes the cross-mandate check useful immediately rather than a year from now.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <Container>
        {/* One of the two numbered sequences on the page, and the only one where
            the numbers carry information: these three happen in this order. */}
        <SectionHead title="Days to live, not a quarter.">
          Enterprise deal platforms quote implementation in months because they have to be
          configured into a shape your firm recognises. This already is that shape.
        </SectionHead>

        <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {/* The rail the steps sit on — draws itself in as the section powers up. */}
          <span
            aria-hidden
            className="mkt-step-rail absolute inset-x-0 top-[1.375rem] hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
          />

          {STEPS.map((s, i) => (
            <li key={s.title} className="relative flex gap-5 md:block">
              {/* Mobile connector between consecutive nodes. */}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-11 -bottom-10 left-[1.375rem] w-px bg-border md:hidden"
                />
              )}

              {/* Amber lives in the chip's ring, not the numeral — amber-on-paper
                  can't hold 4.5:1 at 12px, so the figure itself is ink. */}
              <span className="relative z-10 inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-background font-mono text-xs font-medium tracking-[0.1em] text-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>

              <div className="min-w-0 md:mt-6">
                <Readout className="block text-[10px] tracking-[0.14em]">{s.when}</Readout>
                <Subhead className="mt-2.5 text-xl">{s.title}</Subhead>
                <p className="mt-2.5 max-w-[48ch] text-sm leading-relaxed text-muted-foreground text-pretty">
                  {s.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
