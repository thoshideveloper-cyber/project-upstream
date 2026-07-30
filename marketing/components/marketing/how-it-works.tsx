import { CardTitle, Container, Section, SectionIntro } from "./primitives";

type Step = {
  /** Mono kicker — when this happens, so the three steps read as a timeline at a glance. */
  when: string;
  title: string;
  detail: string;
};

const STEPS: Step[] = [
  {
    when: "The first session",
    title: "Bring your sheets across",
    detail:
      "A guided import maps your columns, previews the duplicates it found and applies the batch — reversibly. Same rows, same names, nothing to re-learn on Monday morning.",
  },
  {
    when: "The first send",
    title: "Reach the first name",
    detail:
      "Send it from your own mailbox and the touch records itself. That first message sets the anchor, and every follow-up date is computed from it — never before it actually goes out.",
  },
  {
    when: "Every project after",
    title: "The record starts working for you",
    detail:
      "The queue says who to chase and stops itself when they reply. Meanwhile every touch, contact and outcome joins the team's record — so the next project opens knowing what this one learned.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <Container>
        <SectionIntro eyebrow="How it works" title="Running on it the same day.">
          No migration project, no re-training, no new vocabulary. Import, reach out, and the
          record starts compounding from the first send.
        </SectionIntro>

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
              <span className="relative z-10 inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-background font-mono text-xs font-medium tracking-[0.1em] text-foreground tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>

              <div className="min-w-0 md:mt-6">
                <p className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                  {s.when}
                </p>
                <CardTitle className="mt-2">{s.title}</CardTitle>
                <p className="mt-2.5 max-w-md text-sm leading-relaxed text-muted-foreground text-pretty">
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
