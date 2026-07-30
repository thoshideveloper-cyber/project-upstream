import type { CSSProperties } from "react";
import { Quote as QuoteMark } from "lucide-react";

import {
  DISPLAY_FEATURED_REVIEWS as FEATURED_REVIEWS,
  DISPLAY_REVIEWS as REVIEWS,
  SHOW_REVIEWS_SECTION,
  type FeaturedReview,
  type Review,
} from "@/content/site";
import { BandLabel, Container, Section, SectionIntro } from "./primitives";

/** Cards per column before the marquee has enough height to be worth looping. */
const MARQUEE_MIN = 3;
const COLUMNS = 3;

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("");
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 font-mono text-[11px] font-medium text-primary-ink">
      {initials(name)}
    </span>
  );
}

/** A review given the room to say something specific. */
function FeaturedCard({ q }: { q: FeaturedReview }) {
  return (
    <figure className="hover-lift relative flex flex-col rounded-2xl border border-border bg-card/40 p-6 md:p-7">
      <QuoteMark
        aria-hidden
        className="absolute top-6 right-6 size-8 text-primary/15 md:top-7 md:right-7"
      />

      {/* Optional, so a deployment can supply a plain quote and still get a
          correct card — persona/driver and the outcome line each stand alone. */}
      {(q.persona || q.driver) && (
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase">
          {q.persona && <span className="text-primary-ink">{q.persona}</span>}
          {q.persona && q.driver && (
            <span aria-hidden className="text-muted-foreground/40">
              /
            </span>
          )}
          {q.driver && <span className="text-muted-foreground">{q.driver}</span>}
        </div>
      )}

      <blockquote
        className={`font-display text-xl leading-snug font-medium text-balance text-foreground ${
          q.persona || q.driver ? "mt-5" : ""
        }`}
      >
        &ldquo;{q.quote}&rdquo;
      </blockquote>

      {q.outcome && (
        <p className="mt-6 flex items-start gap-2.5 border-t border-border/60 pt-5 text-sm font-medium text-foreground/90">
          <span aria-hidden className="mt-[0.15rem] font-mono text-xs text-primary">
            →
          </span>
          {q.outcome}
        </p>
      )}

      <figcaption className="mt-5 flex items-center gap-3">
        <Avatar name={q.name} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{q.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {q.role} · {q.org}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

function Card({ q }: { q: Review }) {
  return (
    /* Compact variant of the shell: these scroll past in a masked band, so the
       standard p-6/p-7 would show fewer of them per screen. */
    <figure className="rounded-2xl border border-border bg-card/40 p-5">
      <blockquote className="text-sm leading-relaxed text-foreground/90">&ldquo;{q.quote}&rdquo;</blockquote>
      <figcaption className="mt-4 flex items-center gap-3 border-t border-border/60 pt-4">
        <Avatar name={q.name} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{q.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {q.role} · {q.org}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * One scrolling column. The loop needs the list rendered twice to be seamless,
 * which is only honest once the column has real content to repeat — see the
 * marquee/static decision in Testimonials.
 */
function Column({
  items,
  dur,
  className,
}: {
  items: Review[];
  dur: string;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className={`mkt-marquee-group h-full overflow-hidden ${className ?? ""}`}>
      <div className="mkt-marquee flex flex-col gap-4" style={{ "--dur": dur } as CSSProperties}>
        {[...items, ...items].map((q, i) => (
          <div key={`${q.name}-${i}`} aria-hidden={i >= items.length}>
            <Card q={q} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Deal the reviews into up to three piles, so the columns interleave as before. */
function intoColumns(items: Review[], count: number): Review[][] {
  const cols: Review[][] = Array.from({ length: Math.min(count, items.length) }, () => []);
  items.forEach((q, i) => cols[i % cols.length].push(q));
  return cols;
}

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

/**
 * Hold the static grid to a card-width measure at low counts, so one or two
 * reviews read as cards rather than stretching the full page width.
 */
const STATIC_MEASURE: Record<number, string> = { 1: "max-w-md", 2: "max-w-3xl" };

/**
 * The marquee drops columns it has no room for, as it always has — a narrow
 * viewport gets one scrolling column of the set. The static grid never hides
 * anything: it reflows the same cards into fewer columns instead.
 */
const COLUMN_VISIBILITY = ["", "hidden sm:block", "hidden lg:block"];
const COLUMN_DURATION = ["42s", "52s", "46s"];

export function Testimonials() {
  if (!SHOW_REVIEWS_SECTION) return null;

  const cols = intoColumns(REVIEWS, COLUMNS);
  // Loop only when a column is tall enough to overflow the masked band. Below
  // that the same cards sit still, in full — nothing duplicated to fill space.
  const marquee = cols.some((c) => c.length >= MARQUEE_MIN);

  return (
    <Section id="customers" motion>
      <Container>
        <SectionIntro eyebrow="Customers" title="Teams that stopped losing the thread.">
          In their words, with their names on it.
        </SectionIntro>

        {FEATURED_REVIEWS.length > 0 && (
          // Two cards make the row; a single one is centred instead of sitting
          // half-width against an empty column.
          <div
            className={`mt-12 grid gap-4 ${
              FEATURED_REVIEWS.length > 1 ? "md:grid-cols-2" : "mx-auto max-w-2xl"
            }`}
          >
            {FEATURED_REVIEWS.map((q) => (
              <FeaturedCard key={q.name} q={q} />
            ))}
          </div>
        )}

        {REVIEWS.length > 0 && (
          <>
            <BandLabel className="mt-14">More from the teams using it</BandLabel>

            {marquee ? (
              <div
                className={`relative mt-6 grid h-[30rem] gap-4 overflow-hidden ${GRID_COLS[cols.length]}`}
                style={{
                  maskImage:
                    "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
                }}
              >
                {cols.map((items, i) => (
                  <Column
                    key={i}
                    items={items}
                    dur={COLUMN_DURATION[i]}
                    className={COLUMN_VISIBILITY[i]}
                  />
                ))}
              </div>
            ) : (
              <div
                className={`mx-auto mt-6 grid gap-4 ${GRID_COLS[Math.min(COLUMNS, REVIEWS.length)]} ${
                  STATIC_MEASURE[REVIEWS.length] ?? ""
                }`}
              >
                {REVIEWS.map((q, i) => (
                  <Card key={`${q.name}-${i}`} q={q} />
                ))}
              </div>
            )}
          </>
        )}
      </Container>
    </Section>
  );
}
