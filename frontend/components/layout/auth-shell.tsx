import { UpstreamMark } from "@/components/brand/logo";

/**
 * The frame for signing in and signing up.
 *
 * The left panel is the same dark ground as the navigation rail, so the first screen a
 * person sees already has the product's shape: a dark frame, a white place to work. It
 * says what the product is in plain words — three facts, no slogan — and disappears
 * below `lg`, where the form alone is the page.
 *
 * The brand lockup is the page's `<h1>`, drawn in whichever place is visible: the dark
 * panel on wide screens, above the form on narrow ones. Only one is ever rendered to the
 * accessibility tree (the other is `display: none`), so there is always exactly one.
 */
function Lockup({ className }: { className?: string }) {
  return (
    <h1 className={className}>
      <UpstreamMark size={20} />
      <span className="text-[15px] font-semibold tracking-[-0.01em]">Upstream</span>
    </h1>
  );
}

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="app-rail hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Lockup className="flex items-center gap-2.5 [&>svg]:box-content [&>svg]:rounded-md [&>svg]:bg-sidebar-foreground [&>svg]:p-1.5 [&>svg]:text-sidebar" />

        <div className="max-w-md">
          <p className="text-2xl font-semibold leading-snug tracking-[-0.02em]">
            Deal sourcing for advisory teams — the master list, the outreach schedule and the
            contact book in one place.
          </p>
          <dl className="mt-10 space-y-5 text-sm">
            <div>
              <dt className="font-medium text-sidebar-foreground">One book per engagement</dt>
              <dd className="mt-0.5 text-sidebar-muted">
                Targets, buyers and investors for each mandate, with every touch on the record.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-sidebar-foreground">A cadence that keeps itself</dt>
              <dd className="mt-0.5 text-sidebar-muted">
                Follow-ups are computed from the first email, so late means late.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-sidebar-foreground">Every figure opens its rows</dt>
              <dd className="mt-0.5 text-sidebar-muted">
                A count on any screen links to the companies behind it.
              </dd>
            </div>
          </dl>
        </div>

        <p className="text-xs text-sidebar-muted">
          Each firm is its own workspace. Nothing you import is visible to another firm.
        </p>
      </aside>

      <main className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[360px]">
          <Lockup className="mb-8 flex items-center gap-2 text-foreground lg:hidden" />
          <h2 className="text-xl font-semibold tracking-[-0.015em] text-foreground">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

/** An inline form error, announced when it appears. */
export function FormAlert({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-ink ring-1 ring-inset ring-danger-line"
    >
      {children}
    </p>
  );
}
