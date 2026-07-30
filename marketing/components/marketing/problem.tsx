import { CalendarX2, Copy, DoorOpen, TrendingDown, type LucideIcon } from "lucide-react";

import { FAILURES, type Failure } from "@/content/site";
import { Container, IconChip, Section, SectionHead, Subhead } from "./primitives";

const ICONS: Record<Failure["icon"], LucideIcon> = {
  copy: Copy,
  calendar: CalendarX2,
  trending: TrendingDown,
  door: DoorOpen,
};

/**
 * The four failures, and nothing else.
 *
 * These rows used to carry an "Instead" column explaining how Upstream fixed
 * each one, which meant every mechanism on the page was introduced here and then
 * explained properly two sections later. That is most of why the page read as
 * repetitive: the same six claims, stated in four places each.
 *
 * Now the row states the pain, and points at the section that owns the answer.
 * The reader gets a working table of contents for the argument, and each claim
 * gets explained exactly once.
 */
export function Problem() {
  return (
    <Section id="problem">
      <Container>
        <SectionHead variant="split" title="Four ways a mandate quietly costs you money.">
          None of these are hypothetical. They are the failures the desk this was built for
          hit often enough to go and build something.
        </SectionHead>

        <ul className="mt-2">
          {FAILURES.map((f, i) => (
            <li
              key={f.pain}
              className="mkt-stagger grid items-start gap-x-6 gap-y-3 border-b border-border py-8 md:grid-cols-[auto_minmax(0,20rem)_minmax(0,1fr)] md:gap-x-10 md:py-9"
              style={{ "--i": i } as React.CSSProperties}
            >
              <IconChip icon={ICONS[f.icon]} tone="muted" className="hidden md:mt-1 md:inline-flex" />

              <Subhead className="text-lg md:text-xl">{f.pain}</Subhead>

              <div>
                <p className="max-w-[58ch] text-sm leading-relaxed text-muted-foreground text-pretty">
                  {f.detail}
                </p>
                {/* Points at the section that answers it, rather than answering
                    it here and again there. */}
                <a
                  href={f.answer.href}
                  className="group mt-3.5 inline-flex items-center gap-2 text-sm font-medium text-foreground underline-offset-4 hover:underline"
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
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
