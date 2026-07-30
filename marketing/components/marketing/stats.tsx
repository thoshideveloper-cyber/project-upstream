import { LOOP } from "@/content/site";
import { Container, Readout, Section } from "./primitives";

/**
 * The band under the hero: the loop the product runs — source, reach, track,
 * remember — as one continuous rail rather than four columns of text.
 *
 * It used to count up four figures from a seeded demo database. Every
 * organisation's aggregates differ, so quoting any is a claim we can't stand
 * behind; the band states the mechanism instead. Drawing the rail through the
 * four nodes is the part that earns the space — the copy already says "loop",
 * and four hairline-separated columns said "list".
 */
export function Stats() {
  return (
    <Section rhythm="tight" aria-label="How Upstream works">
      <Container>
        <Readout className="block text-center">Source · reach · track · remember</Readout>

        <ol className="relative mt-10 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4 lg:gap-x-8">
          {/* The rail the nodes sit on. Drawn once behind them, so the four read
              as stages of one movement instead of four separate facts. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-[0.4rem] hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block"
          />

          {LOOP.map((c, i) => (
            <li key={c.label} className="relative">
              <span
                aria-hidden
                className="relative z-10 mb-6 hidden size-[0.8rem] items-center justify-center rounded-full border border-primary/40 bg-background lg:flex"
              >
                <span className="size-1 rounded-full bg-primary" />
              </span>
              <h3 className="mkt-display text-2xl font-semibold text-foreground sm:text-[1.75rem]">
                {c.label}
              </h3>
              <p className="mt-2.5 max-w-[30ch] text-sm leading-relaxed text-muted-foreground text-pretty">
                {c.context}
              </p>
              {/* The fourth feeds the first. That is the whole claim. */}
              {i === LOOP.length - 1 && (
                <Readout tone="signal" className="mt-4 hidden lg:block">
                  ↻ back to source
                </Readout>
              )}
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
