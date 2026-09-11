/**
 * TEMPORARY. A bench for judging the reimagined hero before any footage is
 * bought: four beats of the proposed two-column cold open, stacked so they can
 * be photographed in one pass. Delete once the direction is settled.
 */
import { BANDS, HERO_CTA, QUEUE } from "@/content/site";

const PLATES = ["/mock/plate1.jpg", "/mock/plate2.jpg", "/mock/plate3.jpg", "/mock/plate4.jpg"];

export default function Mock() {
  return (
    <main className="bg-canvas">
      {BANDS.map((band, i) => (
        <section key={band.id} className="relative flex h-screen items-stretch overflow-hidden">
          {/* the copy column: clean canvas, so the type runs at full ink */}
          <div className="relative flex w-[46%] shrink-0 flex-col justify-center px-[clamp(2rem,5vw,5.5rem)]">
            {band.eyebrow ? (
              <p className="mb-6 font-[family-name:var(--font-data)] text-[0.68rem] uppercase tracking-[0.18em] text-fg-muted">
                {band.eyebrow}
              </p>
            ) : null}
            <h1 className="text-balance font-[family-name:var(--font-display)] text-[clamp(2.1rem,3.5vw,3.15rem)] font-semibold leading-[1.06] tracking-[-0.022em] text-fg">
              {band.head}
            </h1>
            <p className="mt-5 max-w-[34ch] text-[1.02rem] leading-[1.55] text-fg-muted">{band.sub}</p>

            {i === BANDS.length - 1 ? (
              <div className="mt-9 flex flex-wrap gap-3">
                <span className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-[color:var(--paper)]">
                  {HERO_CTA.primary}
                </span>
                <span className="rounded-md border border-hair px-5 py-2.5 text-sm font-medium text-fg">
                  {HERO_CTA.secondary}
                </span>
              </div>
            ) : null}

            {/* the descent marker, anchored to the foot of the column: four
                rules that fill as the water closes. It counts the same four
                beats the film does, so the reader can see how far in they are. */}
            <div className="absolute bottom-[clamp(2rem,5vh,3.5rem)] left-[clamp(2rem,5vw,5.5rem)] flex items-center gap-2.5">
              {BANDS.map((b, j) => (
                <span
                  key={b.id}
                  className="h-px w-9"
                  style={{ background: j <= i ? "var(--accent)" : "var(--hair)" }}
                />
              ))}
              <span className="ml-2 font-[family-name:var(--font-data)] text-[0.64rem] tracking-[0.14em] text-fg-muted">
                {String(i + 1).padStart(2, "0")} / 04
              </span>
            </div>
          </div>

          {/* the plate: the film, uncovered, at full contrast, one hairline off
              the copy. It fades only at the very top, where the nav crosses it. */}
          <div className="relative w-[54%] border-l border-hair">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${PLATES[i]})` }}
            />
            <div
              className="absolute inset-x-0 top-0 h-20"
              style={{ background: "linear-gradient(to bottom, color-mix(in oklab, var(--canvas) 85%, transparent), transparent)" }}
            />

            {/* the payoff resolves out of the water on the last beat */}
            {i === BANDS.length - 1 ? (
              <div className="absolute right-[clamp(1.5rem,3vw,3rem)] bottom-[clamp(2rem,7vh,4.5rem)] w-[clamp(19rem,26vw,23rem)] rounded-lg border border-hair bg-surface p-4 shadow-[0_18px_50px_-24px_rgba(11,26,28,0.45)]">
                <div className="mb-3 flex items-baseline justify-between border-b border-hair pb-2.5">
                  <span className="text-[0.82rem] font-medium text-fg">Outreach desk</span>
                  <span className="font-[family-name:var(--font-data)] text-[0.6rem] uppercase tracking-[0.14em] text-fg-muted">
                    Demo book
                  </span>
                </div>
                {QUEUE.slice(0, 4).map(row => (
                  <div key={row.company} className="flex gap-3 py-[0.42rem]">
                    <span
                      className="w-11 shrink-0 font-[family-name:var(--font-data)] text-[0.6rem] leading-tight"
                      style={{ color: row.due < 0 ? "var(--late-text)" : "var(--fg-muted)" }}
                    >
                      {row.due < 0 ? `${-row.due}d late` : "today"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.78rem] leading-tight text-fg">{row.company}</span>
                      <span className="block truncate font-[family-name:var(--font-data)] text-[0.6rem] leading-tight text-fg-muted">
                        {row.contact} · {row.touch}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ))}
    </main>
  );
}
