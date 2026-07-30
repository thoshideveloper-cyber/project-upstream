import { LOOP } from "@/content/site";
import { cn } from "@/lib/utils";
import { Container, Readout, Section } from "./primitives";

/**
 * The band under the hero: source, reach, track, remember.
 *
 * Back to hairline-divided cells. A previous pass hung the four stages off a
 * faint horizontal rail with dot nodes, which floated: the rail was a 7%-alpha
 * gradient carrying four 12px dots, so at a glance the band read as four
 * paragraphs that happened to be near each other. Vertical rules between cells
 * do the same job with more authority, and they match the instrument-panel
 * language the product's own stat rows use.
 *
 * The arrow between cells is what the rail was for, and it survives as a glyph
 * sitting in the rule itself. The fourth cell says the loop closes, because a
 * row of four columns otherwise reads as a list and this is a cycle.
 *
 * It used to count up four figures from a seeded demo database. Every firm's
 * aggregates differ, so the band states the mechanism instead.
 */
export function Stats() {
  return (
    <Section rhythm="tight" aria-label="How Upstream works">
      <Container>
        <Readout className="block text-center">Source · reach · track · remember</Readout>

        <ol className="mkt-cascade mt-10 grid grid-cols-1 gap-y-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-y-0">
          {LOOP.map((c, i) => (
            <li
              key={c.label}
              className={cn(
                "relative px-0 sm:px-6 lg:px-7",
                // The rule between stages. First cell in each row has none, so
                // the band never opens or closes on a hanging hairline.
                i > 0 && "sm:border-l sm:border-border",
                i === 2 && "lg:border-l sm:border-l-0 lg:border-border",
              )}
              style={{ "--i": i } as React.CSSProperties}
            >
              {/* The flow marker, sitting in the rule it follows. */}
              {i > 0 && (
                <span
                  aria-hidden
                  className="absolute -left-[7px] top-[0.55rem] hidden size-3.5 items-center justify-center rounded-full bg-background font-mono text-[10px] leading-none text-primary sm:flex"
                >
                  &rsaquo;
                </span>
              )}

              <h3 className="mkt-display text-2xl text-foreground sm:text-[1.7rem]">{c.label}</h3>
              <p className="mt-2.5 max-w-[32ch] text-sm leading-relaxed text-muted-foreground text-pretty">
                {c.context}
              </p>

              {i === LOOP.length - 1 && (
                <Readout tone="signal" className="mt-3.5 block">
                  ↻ and the next mandate starts here
                </Readout>
              )}
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
