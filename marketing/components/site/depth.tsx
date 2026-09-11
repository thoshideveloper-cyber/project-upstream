import { DEPTH, QUEUE, SECURITY } from "@/content/site";
import { Fold } from "./fold";
import { Plate } from "./plate";
import { Reveal, Stagger, StaggerItem, Stamp } from "./primitives";

/**
 * Below the waterline: who can see what.
 *
 * Still in deep water, and quieter than the fold above it on purpose. The
 * record fold is two panels and a grid; this one is a single document with a
 * margin, because the security answer should read like a page from the thing
 * itself rather than like another feature block.
 *
 * The redacted panel is the argument. The names are not covered with a
 * rectangle, they are genuinely not in the markup: what an analyst on the wrong
 * mandate receives is a row that never loaded, and drawing it as a bar over
 * real text would be a lie about how it works.
 */
export function Depth() {
  return (
    <Fold
      id="depth"
      stamp="23 Apr · follow-up 3"
      deep
      bleed
      surfacing
      className="pt-40 pb-28 lg:pt-64 lg:pb-48"
      // Looking up at the underside of the surface from deep water. It runs as
      // a band across the top of the fold and is gone before the first line of
      // copy, because the measurement was blunt about it: pale body text on
      // that image's caustics read 1.90:1. So the reader passes through the
      // surface and then reads in the dark, which is what the fold is about.
      plate={<Plate name="access" opacity={0.72} mask="band" position="center 22%" />}
    >
      <div className="grid items-start gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-20">
        <div>
          <Reveal>
            <Stamp>Access</Stamp>
            <h2 className="u-display u-narrow mt-4 max-w-[20ch] text-[clamp(1.75rem,3.4vw,2.75rem)] leading-[1.06]">
              {DEPTH.head}
            </h2>
            <p className="mt-5 max-w-[52ch] leading-relaxed text-fg-muted">{DEPTH.lede}</p>
          </Reveal>

          <Stagger as="dl" className="mt-12 border-t border-hair" step={0.07}>
            {SECURITY.map((s) => (
              <StaggerItem
                key={s.term}
                className="grid gap-x-8 gap-y-1 border-b border-hair py-5 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]"
              >
                <dt className="u-subhead text-[1rem]">{s.term}</dt>
                <dd className="text-[0.9375rem] leading-relaxed text-fg-muted">{s.detail}</dd>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        {/* The redacted book. */}
        <Reveal delay={0.1} className="lg:sticky lg:top-24 lg:self-start">
          <div className="u-elev rounded-lg border border-hair bg-[color:var(--surface)] p-5">
            <Stamp className="text-fg">{DEPTH.redactHead}</Stamp>
            <ul className="mt-5 space-y-3">
              {QUEUE.map((row, i) => (
                <li key={row.company} className="flex items-center gap-3">
                  <span className="u-mono w-10 shrink-0 text-[0.6875rem] text-fg-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    aria-hidden
                    className="u-redact block h-3.5 rounded-[2px]"
                    style={{ width: `${44 + ((i * 37) % 46)}%` }}
                  />
                </li>
              ))}
            </ul>
            <p className="u-mono mt-6 border-t border-hair pt-4 text-[0.6875rem] leading-relaxed text-fg-muted">
              {DEPTH.redactNote}
            </p>
          </div>
        </Reveal>
      </div>
    </Fold>
  );
}
