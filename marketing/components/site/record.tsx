import { RECORD, RECORD_ITEMS, RECORD_TRACE } from "@/content/site";
import { Fold } from "./fold";
import { Plate } from "./plate";
import { Lit, Reveal, Stagger, StaggerItem, Stamp } from "./primitives";

/**
 * The record: the fold where the page goes under.
 *
 * This is the differentiator, and the brief is unusually direct about why it
 * matters: it is the source of the long-term lock-in and it has to be designed
 * in from the start rather than added later. So it gets a whole fold, and the
 * page's one change of ground: the surface ends here and the reader is in deep
 * water for this fold and the next. The channel forks in the margin at exactly
 * this point, which is the argument drawn rather than asserted.
 *
 * The two panels are the proof. One name, two mandates, six months apart, and
 * the right-hand column is nothing but the left-hand column read back.
 */
export function Record() {
  return (
    <Fold
      id="record"
      variant="fork"
      stamp="9 Apr · follow-up 2"
      deep
      bleed
      className="py-28 lg:py-40"
      // Two plumes of silt braiding into one. The fold's whole argument is
      // that two mandates become one record, and this is that, underwater.
      plate={<Plate name="record" opacity={0.5} mask="full" scrim position="center 40%" />}
    >
      <Reveal className="max-w-[40rem]">
        <Stamp>The record</Stamp>
        <h2 className="u-display u-narrow mt-4 text-[clamp(1.875rem,3.8vw,3.25rem)] leading-[1.04]">
          {RECORD.head}
        </h2>
        <p className="mt-6 max-w-[52ch] leading-relaxed text-fg-muted">{RECORD.lede}</p>
      </Reveal>

      {/* ── One name, twice ─────────────────────────────────────────────── */}
      <Reveal delay={0.08} className="mt-14">
        <div className="grid gap-px overflow-hidden rounded-lg border border-hair bg-[color:var(--hair)] md:grid-cols-2">
          {[RECORD_TRACE.first, RECORD_TRACE.second].map((side, i) => (
            <div key={side.label} className="bg-[color:var(--surface)] p-6 lg:p-8">
              <div className="flex items-baseline justify-between gap-4">
                <Stamp className="text-fg">{side.label}</Stamp>
                <span className="u-mono text-[0.6875rem] text-fg-muted">{side.role}</span>
              </div>
              <p className="u-subhead mt-4 text-[1.375rem]">{RECORD_TRACE.company}</p>
              <ul className="mt-5 space-y-2.5">
                {side.events.map((e) => (
                  <li key={e} className="u-mono flex gap-3 text-[0.8125rem] text-fg-muted">
                    <span
                      aria-hidden
                      className={
                        i === 0
                          ? "mt-[0.45em] block h-1 w-1 shrink-0 rounded-full bg-[color:var(--fg-muted)]"
                          : "mt-[0.45em] block h-1 w-1 shrink-0 rounded-full bg-accent"
                      }
                    />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="u-mono mt-3 text-[0.75rem] text-fg-muted">{RECORD_TRACE.note}</p>
      </Reveal>

      {/* ── Why it holds ────────────────────────────────────────────────── */}
      <Stagger as="ul" className="mt-16 grid gap-px bg-[color:var(--hair)] sm:grid-cols-2">
        {RECORD_ITEMS.map((item) => (
          <StaggerItem key={item.n} as="li" className="bg-[color:var(--canvas)]">
            <Lit className="h-full rounded-none p-6 lg:p-8">
              <span className="u-mono text-[0.75rem] text-accent">{item.n}</span>
              <h3 className="u-subhead mt-3 text-[1.0625rem]">{item.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-fg-muted">{item.detail}</p>
            </Lit>
          </StaggerItem>
        ))}
      </Stagger>
    </Fold>
  );
}
