import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { PAGE_SUBTITLE, PAGE_TITLE, PAGE_TITLE_STYLE } from "@/lib/design";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: React.ReactNode;
  /** One sentence under the title — what this page is for, or what it found. */
  description?: React.ReactNode;
  /** Right-aligned actions. Put the page's single primary (filled) action last. */
  actions?: React.ReactNode;
  /** The trail above the title, for pages that sit under another (a record, a sub-view). */
  breadcrumbs?: Crumb[];
  /** Inline beside the title — a status chip, a count. */
  adornment?: React.ReactNode;
  /** Rendered under the header on its own row — page-level tabs or a toolbar. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * The header every page starts with: where you are (breadcrumb + title), what this is
 * (one sentence), what you can do (actions, primary last).
 *
 * The title is the same size on every top-level screen, so moving between Schedule,
 * Analytics and Settings never changes the size of the word in the corner.
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  adornment,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className={cn(PAGE_TITLE, "truncate")} style={PAGE_TITLE_STYLE}>
              {title}
            </h1>
            {adornment}
          </div>
          {description ? (
            <div className={cn("mt-1 max-w-3xl", PAGE_SUBTITLE)}>{description}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </header>
  );
}

/** The trail. Every crumb but the last is a link; the last is where you are. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className="truncate rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  className={cn("truncate", last && "font-medium text-foreground")}
                  aria-current={last ? "page" : undefined}
                >
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight className="size-3 shrink-0 text-ink-300" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
