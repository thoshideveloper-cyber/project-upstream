import type { CSSProperties } from "react";

import { REVIEWS, SHOW_REVIEWS_SECTION, type Review } from "@/content/site";
import { Container, Section, SectionHead } from "./primitives";

/**
 * Customer quotes, in three columns that scroll past at different speeds.
 *
 * The scrolling treatment is back, and the honesty rule is unchanged: it renders
 * only real quotes. `REVIEWS` in content/site.ts is empty, so today this section
 * does not exist at all. Fill it and the columns start moving on their own.
 *
 * What is NOT coming back is the eleven placeholder cards reading "To be
 * reviewed" from "Jane Doe at Organisation A" that used to keep the section
 * standing while empty. The effect is worth having; inventing content to
 * demonstrate the effect is not.
 *
 * Two rules the previous marquee got right and are kept:
 *  - The loop needs the list rendered twice to be seamless, which is only honest
 *    once a column has enough real cards to repeat. Below MARQUEE_MIN the same
 *    cards sit still, in full, and nothing is duplicated to fill space.
 *  - The static fallback never *hides* a column (`hidden lg:block` would
 *    silently drop cards); it reflows them into fewer columns instead.
 */
const MARQUEE_MIN = 3;
const COLUMNS = 3;
const COLUMN_DURATION = ["46s", "58s", "51s"];
const COLUMN_VISIBILITY = ["", "hidden sm:block", "hidden lg:block"];
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};
const STATIC_MEASURE: Record<number, string> = { 1: "max-w-md", 2: "max-w-3xl" };

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 font-mono text-[11px] font-medium text-primary-ink">
      {initials}
    </span>
  );
}

function Quote({ q }: { q: Review }) {
  return (
    <figure className="rounded-xl border border-border bg-card/40 p-5">
      <blockquote className="text-sm leading-relaxed text-foreground/90 text-pretty">
        &ldquo;{q.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-4 flex items-center gap-3 border-t border-border pt-4">
        <Avatar name={q.name} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{q.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {q.role} · {q.firm}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

/** One scrolling column. Pauses on hover so a quote can actually be read. */
function Column({ items, dur, className }: { items: Review[]; dur: string; className?: string }) {
  if (items.length === 0) return null;
  return (
    <div className={`mkt-marquee-group h-full overflow-hidden ${className ?? ""}`}>
      <div className="mkt-marquee flex flex-col gap-3" style={{ "--dur": dur } as CSSProperties}>
        {[...items, ...items].map((q, i) => (
          <div key={`${q.name}-${i}`} aria-hidden={i >= items.length}>
            <Quote q={q} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Deal the reviews into up to three piles so the columns interleave. */
function intoColumns(items: Review[], count: number): Review[][] {
  const cols: Review[][] = Array.from({ length: Math.min(count, items.length) }, () => []);
  items.forEach((q, i) => cols[i % cols.length].push(q));
  return cols;
}

export function Testimonials() {
  if (!SHOW_REVIEWS_SECTION) return null;

  const cols = intoColumns(REVIEWS, COLUMNS);
  const marquee = cols.some((c) => c.length >= MARQUEE_MIN);

  return (
    <Section id="customers" motion>
      <Container>
        <SectionHead variant="split" title="Desks that stopped losing the thread.">
          In their words, with their names on them.
        </SectionHead>

        {marquee ? (
          <div
            className={`relative mt-12 grid h-[32rem] gap-3 overflow-hidden ${GRID_COLS[cols.length]}`}
            style={{
              maskImage: "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
            }}
          >
            {cols.map((items, i) => (
              <Column key={i} items={items} dur={COLUMN_DURATION[i]} className={COLUMN_VISIBILITY[i]} />
            ))}
          </div>
        ) : (
          <div
            className={`mx-auto mt-12 grid gap-3 ${GRID_COLS[Math.min(COLUMNS, REVIEWS.length)]} ${
              STATIC_MEASURE[REVIEWS.length] ?? ""
            }`}
          >
            {REVIEWS.map((q, i) => (
              <Quote key={`${q.name}-${i}`} q={q} />
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
