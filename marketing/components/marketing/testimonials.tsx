import type { CSSProperties } from "react";
import { Quote as QuoteMark } from "lucide-react";

import {
  DISPLAY_FEATURED_REVIEWS as FEATURED_REVIEWS,
  DISPLAY_REVIEWS as REVIEWS,
  SHOW_REVIEWS_SECTION,
  type FeaturedReview,
  type Review,
} from "@/content/site";
import { Container, Panel, Readout, Section, SectionHead } from "./primitives";

/** Cards per column before the marquee has enough height to be worth looping. */
const MARQUEE_MIN = 3;
const COLUMNS = 3;

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("");
}

/**
 * Squircle, not a circle. Every avatar on every SaaS page is a circle; a rounded
 * square costs nothing and stops the caption row looking like a stock component.
 */
function Avatar({ name }: { name: string }) {
  return (
    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 font-mono text-[11px] font-medium text-primary-ink">
      {initials(name)}
    </span>
  );
}

function Attribution({ q }: { q: Review }) {
  return (
    <figcaption className="mt-5 flex items-center gap-3">
      <Avatar name={q.name} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{q.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {q.role} · {q.org}
        </span>
      </span>
    </figcaption>
  );
}

/** A review given the room to say something specific. */
function FeaturedCard({ q }: { q: FeaturedReview }) {
  return (
    <Panel as="figure" className="relative md:p-7">
      <QuoteMark
        aria-hidden
        strokeWidth={1.5}
        className="absolute top-6 right-6 size-7 text-primary/15 md:top-7 md:right-7"
      />

      {/* Optional, so a deployment can supply a plain quote and still get a
          correct card — persona/driver and the outcome line each stand alone. */}
      {(q.persona || q.driver) && (
        <div className="flex items-center gap-2">
          {q.persona && <Readout tone="signal">{q.persona}</Readout>}
          {q.persona && q.driver && (
            <span aria-hidden className="text-muted-foreground/40">
              /
            </span>
          )}
          {q.driver && <Readout>{q.driver}</Readout>}
        </div>
      )}

      <blockquote
        className={`mkt-subhead text-xl leading-snug font-semibold text-foreground ${
          q.persona || q.driver ? "mt-5" : ""
        }`}
      >
        &ldquo;{q.quote}&rdquo;
      </blockquote>

      {q.outcome && (
        <p className="mt-6 border-t border-border pt-5 text-sm font-medium text-foreground/90">
          {q.outcome}
        </p>
      )}

      <Attribution q={q} />
    </Panel>
  );
}

function Card({ q }: { q: Review }) {
  return (
    /* Compact variant of the shell: these scroll past in a masked band, so the
       standard p-5/p-6 would show fewer of them per screen. */
    <figure className="rounded-xl border border-border bg-card/40 p-5">
      <blockquote className="text-sm leading-relaxed text-foreground/90">
        &ldquo;{q.quote}&rdquo;
      </blockquote>
      <Attribution q={q} />
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
        <SectionHead variant="split" title="Teams that stopped losing the thread.">
          In their words, with their names on it.
        </SectionHead>

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
            <Readout className="mt-14 block text-center">More from the teams using it</Readout>

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
