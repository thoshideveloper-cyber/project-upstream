import { CalendarX2, Copy, DoorOpen, TrendingDown, type LucideIcon } from "lucide-react";

import { FAILURES, type Failure } from "@/content/site";
import { Container, IconChip, Panel, Section, SectionHead, Subhead } from "./primitives";

const ICONS: Record<Failure["icon"], LucideIcon> = {
  copy: Copy,
  calendar: CalendarX2,
  trending: TrendingDown,
  door: DoorOpen,
};

/**
 * The four failures, and nothing else.
 *
 * These used to be an "Instead" table explaining how Upstream fixed each one,
 * which meant every mechanism on the page was introduced here and explained
 * properly two sections later. A card states the pain, then points at the
 * section that owns the answer. The reader gets a working table of contents
 * for the argument, and each claim gets explained exactly once.
 *
 * Four cards on a 2-up grid, not a stacked list: it is the one place on the
 * page where the reader should feel the weight of all four at once, side by
 * side, rather than scrolling past them one at a time.
 */
export function Problem() {
  return (
    <Section id="problem">
      <Container>
        <SectionHead variant="split" title="Four ways a mandate quietly costs you money.">
          None of these are hypothetical. They are the failures the desk this was built for
          hit often enough to go and build something.
        </SectionHead>

        <ul className="mkt-cascade mt-10 grid gap-4 sm:grid-cols-2">
          {FAILURES.map((f, i) => (
            <Panel key={f.pain} as="li" style={{ "--i": i } as React.CSSProperties} className="gap-4">
              <IconChip icon={ICONS[f.icon]} tone="muted" />
              <Subhead className="mt-1 text-lg">{f.pain}</Subhead>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground text-pretty">
                {f.detail}
              </p>
              {/* Points at the section that answers it, rather than answering
                  it here and again there. */}
              <a
                href={f.answer.href}
                className="group mt-4 inline-flex items-center gap-2 border-t border-border pt-4 text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                <span aria-hidden className="size-[3px] rounded-full bg-primary" />
                {f.answer.label}
                <span
                  aria-hidden
                  className="text-primary transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  &rarr;
                </span>
              </a>
            </Panel>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
