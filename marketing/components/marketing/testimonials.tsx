import { REVIEWS, SHOW_REVIEWS_SECTION, type Review } from "@/content/site";
import { Container, Panel, Section, SectionHead } from "./primitives";

/**
 * Customer quotes, and nothing at all when there are none.
 *
 * This section used to render eleven placeholder cards ("To be reviewed" from
 * "Jane Doe, Outreach lead, Organisation A") scrolling past in three masked
 * marquee columns, behind a flag that kept it standing while empty. The reasoning
 * was that inventing praise is worse than admitting you have none, which is
 * correct, but it skipped the third option: don't ship the section.
 *
 * All of that machinery is gone. Fill `REVIEWS` in content/site.ts with quotes
 * you have written permission to print and this returns as a plain grid. Until
 * then the argument is carried by the comparison section, which says something
 * true about the product instead of holding space for something true about a
 * customer.
 */
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
    <Panel as="figure">
      <blockquote className="text-sm leading-relaxed text-foreground/90 text-pretty">
        &ldquo;{q.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-5">
        <Avatar name={q.name} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{q.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {q.role} · {q.firm}
          </span>
        </span>
      </figcaption>
    </Panel>
  );
}

export function Testimonials() {
  if (!SHOW_REVIEWS_SECTION) return null;

  return (
    <Section id="customers">
      <Container>
        <SectionHead variant="split" title="Teams that stopped losing the thread.">
          In their words, with their names on it.
        </SectionHead>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REVIEWS.map((q) => (
            <Quote key={`${q.name}-${q.firm}`} q={q} />
          ))}
        </div>
      </Container>
    </Section>
  );
}
