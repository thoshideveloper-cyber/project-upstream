import { CalendarX2, Copy, DoorOpen, TrendingDown, type LucideIcon } from "lucide-react";

import { Card, CardBeat, CardTitle, Container, IconChip, Section, SectionIntro } from "./primitives";

type Pain = {
  icon: LucideIcon;
  /** The status-quo failure — named concretely so the reader recognises their week. */
  pain: string;
  detail: string;
  /** The relief line — the single amber beat that closes each card. */
  fix: string;
};

const PAINS: Pain[] = [
  {
    icon: Copy,
    pain: "Two people reach the same name.",
    detail:
      "One sheet per project, and no way to check across them. So the same organisation hears from you twice.",
    fix: "Duplicates flagged across projects, before anyone sends.",
  },
  {
    icon: CalendarX2,
    pain: "A follow-up slips, unnoticed.",
    detail:
      "The date passes on a Tuesday and nobody has the schedule open. By the time anyone looks, the thread has gone cold.",
    fix: "Cadence is computed and surfaced — overdue can't hide.",
  },
  {
    icon: TrendingDown,
    pain: "Every project starts from scratch.",
    detail:
      "Someone here has worked this organisation before and knows how it went. That lives in a thread, in somebody's head.",
    fix: "What you learned once shows up on the next project.",
  },
  {
    icon: DoorOpen,
    pain: "Relationships leave with the person.",
    detail:
      "Someone moves on, and every note and half-built rapport in their inbox goes with them.",
    fix: "Every touch is on record, owned by the team, and stays.",
  },
];

export function Problem() {
  return (
    <Section id="problem">
      <Container>
        <SectionIntro eyebrow="The status quo" title="The one that slips is invisible — until it's gone.">
          Spreadsheets, inboxes, and what people happen to remember. The cost isn&apos;t messy
          files — it&apos;s the opportunity you never saw leave.
        </SectionIntro>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {PAINS.map(({ icon, pain, detail, fix }) => (
            <Card key={pain}>
              {/* Muted glyph: these are the failures, not the features. */}
              <IconChip icon={icon} tone="muted" />
              <CardTitle className="mt-5">{pain}</CardTitle>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
                {detail}
              </p>
              <CardBeat>{fix}</CardBeat>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
