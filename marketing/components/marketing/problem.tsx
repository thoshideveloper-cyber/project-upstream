import { CalendarX2, Copy, DoorOpen, TrendingDown, type LucideIcon } from "lucide-react";

import { Container, IconChip, Readout, Section, SectionHead, Subhead } from "./primitives";

type Pain = {
  icon: LucideIcon;
  /** The status-quo failure — named concretely so the reader recognises their week. */
  pain: string;
  detail: string;
  /** The relief line — the single amber beat per row. */
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
    fix: "The clock is computed and surfaced, so overdue can't hide.",
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

/**
 * A defect log, not a card grid.
 *
 * These four failures used to be four identical bordered rectangles in a 2×2 —
 * the same shell the two sections after this one also used, which is how the
 * middle of the page turned into one repeated card. A ruled ledger suits the
 * content better anyway: each row states what breaks on the left and what
 * replaces it on the right, and the reader can scan one column or the other.
 */
export function Problem() {
  return (
    <Section id="problem">
      <Container>
        <SectionHead variant="split" title="The one that slips is invisible until it's gone.">
          Spreadsheets, inboxes, and what people happen to remember. The cost isn&apos;t messy
          files. It&apos;s the opportunity you never saw leave.
        </SectionHead>

        <ul className="mt-2">
          {PAINS.map(({ icon, pain, detail, fix }, i) => (
            <li
              key={pain}
              className="mkt-stagger grid items-start gap-x-5 gap-y-4 border-b border-border py-8 md:grid-cols-[auto_minmax(0,1.15fr)_minmax(0,1fr)] md:gap-x-10 md:py-9"
              style={{ "--i": i } as React.CSSProperties}
            >
              {/* Muted glyph: these are the failures, not the features. */}
              <IconChip icon={icon} tone="muted" className="hidden md:inline-flex md:mt-0.5" />

              <div>
                <Subhead>{pain}</Subhead>
                <p className="mt-2.5 max-w-[52ch] text-sm leading-relaxed text-muted-foreground text-pretty">
                  {detail}
                </p>
              </div>

              <div className="md:pt-0.5">
                <Readout tone="signal" className="block">
                  Instead
                </Readout>
                <p className="mt-2 max-w-[42ch] text-sm leading-relaxed font-medium text-foreground/90 text-pretty">
                  {fix}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
