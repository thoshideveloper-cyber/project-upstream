import { QUEUE } from "@/content/site";
import { cn } from "@/lib/utils";

/**
 * The queue the canvas resolves into at the settle.
 *
 * This is the product's actual argument in one panel: the ordering is not
 * chosen by the reader and not typed by anyone, it is the cadence engine's
 * output, sorted by how late each row is. So the panel leads with the lateness
 * and puts the company second, which is the opposite of how a CRM list is
 * usually built and is the whole point.
 *
 * It is labelled a demo book on its own face, because putting a firm's queue
 * on a marketing page without saying whose it is is the one thing a page like
 * this cannot do. The rows are the seeded book's real ones, badly behind and
 * left that way: a desk seventy-five days late is what the fold above this is
 * about, and tidying it up for the photograph would be arguing the other side.
 */
export function Queue({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "u-elev overflow-hidden rounded-lg border border-hair bg-[color:var(--raised)]",
        className,
      )}
    >
      <div className="flex items-baseline justify-between border-b border-hair px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="u-subhead text-[0.9375rem]">Outreach desk</span>
          <span className="u-mono text-[0.6875rem] text-fg-muted">today</span>
        </div>
        <span className="u-mono rounded-full border border-hair px-2 py-0.5 text-[0.625rem] tracking-wider text-fg-muted uppercase">
          Demo book
        </span>
      </div>

      <ul className="divide-y divide-[color:var(--hair)]">
        {QUEUE.map((row, i) => {
          const overdue = row.due < 0;
          const today = row.due === 0;
          // Exactly one row is promoted, and it is the latest one. The product
          // does the same thing: start here, then the next.
          const promoted = i === 0;
          return (
            <li
              key={row.company}
              className={cn(
                "grid grid-cols-[3.25rem_minmax(0,1fr)] items-baseline gap-x-3 px-4 py-2.5",
                promoted && "bg-[color:color-mix(in_oklab,var(--late)_7%,transparent)]",
              )}
            >
              <span
                className={cn(
                  "u-mono justify-self-start rounded px-1.5 py-0.5 text-[0.6875rem] font-medium",
                  overdue
                    ? "bg-[color:color-mix(in_oklab,var(--late)_14%,transparent)] text-[color:var(--late-ink)]"
                    : today
                      ? "text-accent"
                      : "text-fg-muted",
                  promoted && "u-pulse",
                )}
              >
                {overdue ? `${-row.due}d late` : today ? "today" : `+${row.due}d`}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[0.875rem] font-medium">{row.company}</span>
                <span className="u-mono block truncate text-[0.6875rem] text-fg-muted">
                  {row.contact} · {row.touch}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="u-mono border-t border-hair px-4 py-2.5 text-[0.6875rem] text-fg-muted">
        Ordered by the cadence engine. Nobody sorts this list and nothing falls off it.
      </p>
    </div>
  );
}
