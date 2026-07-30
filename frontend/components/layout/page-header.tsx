import { PAGE_SUBTITLE, PAGE_TITLE, PAGE_TITLE_STYLE } from "@/lib/design";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

/**
 * The command line every page starts with.
 *
 * Analytics, Companies, Settings and the Sourcing sub-pages route through here;
 * the dense pages (Outreach desk, Master List, Sourcing, Projects, Contacts) hand-
 * roll the same row because they interleave live figures into it. Both spell the
 * title with PAGE_TITLE, so the word in the top-left corner is the same size on
 * every screen — it used to be 30px here and 20px there.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className={PAGE_TITLE} style={PAGE_TITLE_STYLE}>
          {title}
        </h1>
        {description ? <p className={`mt-1 ${PAGE_SUBTITLE}`}>{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
