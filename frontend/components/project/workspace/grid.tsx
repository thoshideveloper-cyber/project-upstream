"use client";

/**
 * The workspace register: one column template, three kinds of row.
 *
 * This is a CSS grid, not a `<table>`, and the swap is load-bearing rather than
 * cosmetic. The old workspace nested `<tbody>` fragments and capped each leaf at 40
 * rows behind a "show 40 more" button — which meant a group header could say 47 while
 * the list under it held 40, silently. Virtualizing removes the cap entirely, and a
 * virtualizer needs absolutely-positioned rows, which a table's row box will not give
 * you without fighting `display` on every element.
 *
 * What a table was carrying is kept explicitly: column alignment comes from one shared
 * `grid-template-columns` declared here and used by both the header and every row, and
 * the semantics come from real `role="grid"` / `row` / `gridcell` markup rather than
 * being inherited by accident.
 */

import Link from "next/link";
import { ChevronRight, Plus, UserPlus } from "lucide-react";

import { AddCompanyDialog } from "@/components/features/add-company";
import { NextTouch, RowActions } from "@/components/project/company-row";
import { HealthBar } from "@/components/project/health-bar";
import { Button } from "@/components/ui/button";
import {
  AWAITING_DOT,
  AWAITING_INK,
  DEAL_TYPE_SHORT,
  DEAL_TYPE_STYLE,
  INK_LINK,
  LABEL,
  LATE_TOKEN,
  MONO,
  STATUS_META,
} from "@/lib/design";
import { priorityOf } from "@/lib/project-views";
import type { WorkspaceNode } from "@/lib/project";
import type { CompanyRowItem, GroupRow } from "@/lib/workspace-rows";
import { cn } from "@/lib/utils";
import type { Company, MandateType } from "@/types";

/**
 * The column template, once — and sized against the *register*, not the viewport.
 *
 * Container queries rather than `md:` / `lg:`: the register shares its row with the
 * peek panel, so opening a company takes ~26rem off the table's width while the window
 * stays exactly as wide as it was. Viewport breakpoints cannot see that, which is how
 * a seven-column table ends up crushed into two-thirds of the space still insisting it
 * has room. `@container` measures the thing that actually changed.
 *
 * Columns drop from the right in reverse order of how much they matter to the decision
 * the row exists for. Company / next touch / actions survive to the narrowest width,
 * because "who, when, and do it" is the row's irreducible content.
 */
export const GRID_COLS =
  // Narrowest (a phone, or a very squeezed register): who and when only. The actions
  // column is hover-revealed, which a touch screen cannot do, so it joins at @md.
  "grid grid-cols-[24px_minmax(0,1fr)_112px] " +
  "@md:grid-cols-[28px_minmax(0,1fr)_128px_120px] " +
  "@xl:grid-cols-[28px_minmax(0,1fr)_128px_128px_120px] " +
  "@3xl:grid-cols-[28px_minmax(0,1fr)_128px_128px_minmax(120px,160px)_120px] " +
  "@5xl:grid-cols-[28px_minmax(0,1fr)_minmax(140px,0.5fr)_128px_128px_minmax(120px,160px)_120px]";

export const ROW_H = { comfortable: 44, compact: 32 } as const;
export const GROUP_H = { engagement: 44, sub: 32 } as const;

/* ── Checkbox ──────────────────────────────────────────────────────────────── */

function Tick({
  checked,
  indeterminate,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
  className?: string;
}) {
  const on = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        "grid h-4 w-4 place-items-center rounded-[4px] border bg-card shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        on ? "border-foreground bg-foreground" : "border-border-strong hover:border-ink-500",
        className,
      )}
    >
      {indeterminate ? (
        <span className="h-0.5 w-2 rounded-full bg-background" aria-hidden />
      ) : (
        checked && (
          <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-background" aria-hidden>
            <path
              d="M1.5 5.2 4 7.5 8.5 2.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )
      )}
    </button>
  );
}

/* ── Header ────────────────────────────────────────────────────────────────── */

export function GridHeader({
  allChecked,
  someChecked,
  onToggleAll,
  showSignal,
}: {
  allChecked: boolean;
  someChecked: boolean;
  onToggleAll: () => void;
  showSignal: boolean;
}) {
  return (
    <div
      role="row"
      className={cn(
        GRID_COLS,
        "sticky top-0 z-30 h-9 items-center gap-x-3 border-b border-border bg-muted px-3",
      )}
    >
      <span role="columnheader" className="flex items-center">
        <Tick
          checked={allChecked}
          indeterminate={!allChecked && someChecked}
          onChange={onToggleAll}
          label="Select every visible company"
        />
      </span>
      <span role="columnheader" className={LABEL}>
        Company
      </span>
      <span role="columnheader" className={cn(LABEL, "hidden @5xl:block")}>
        {showSignal ? "Why now" : "Signal"}
      </span>
      <span role="columnheader" className={cn(LABEL, "hidden @xl:block")}>
        Status
      </span>
      <span role="columnheader" className={LABEL}>
        Next touch
      </span>
      <span role="columnheader" className={cn(LABEL, "hidden @3xl:block")}>
        Contact
      </span>
      <span role="columnheader" className="sr-only">
        Actions
      </span>
    </div>
  );
}

/* ── Group rows ────────────────────────────────────────────────────────────── */

/**
 * What a group says about itself, chosen by what the group *is*.
 *
 * An engagement is a book with a strategy, so it reports conversion and load. A band or
 * a category is a slice, so it reports size and whatever is wrong inside it. Printing
 * every metric at every level was the old header's failure: five figures on a category
 * containing four companies is noise pretending to be a dashboard.
 */
function GroupVitals({
  node,
  showRate,
  strong = false,
}: {
  node: WorkspaceNode;
  showRate: boolean;
  /** An engagement header carries its late count as a chip; a band or category as ink. */
  strong?: boolean;
}) {
  // A reply rate computed over a filtered subset is a number about the filter, not
  // about the book: "0% replied, 0/10" under a view that excludes replies is true and
  // useless. The caller suppresses it whenever anything is narrowing the list.
  const { late, awaiting, noContact, contacted, replied, replyRate } = node.vitals;
  const parts: React.ReactNode[] = [];

  if (late > 0) {
    parts.push(
      strong ? (
        <span key="late" className={LATE_TOKEN}>
          {late} overdue
        </span>
      ) : (
        <span key="late" className="inline-flex items-center gap-1 font-medium text-danger-ink">
          <span className="size-1.5 rounded-full bg-danger" aria-hidden />
          {late} overdue
        </span>
      ),
    );
  }
  if (awaiting > 0) {
    parts.push(
      <span key="aw" className={cn("inline-flex items-center gap-1", AWAITING_INK)}>
        <span className={AWAITING_DOT} aria-hidden />
        {awaiting} intro pending
      </span>,
    );
  }
  if (noContact > 0 && late === 0) {
    parts.push(
      <span key="nc" className="text-muted-foreground" title="Nobody to email">
        {noContact} no contact
      </span>,
    );
  }
  if (showRate && contacted > 0) {
    parts.push(
      <span key="rate" className="text-muted-foreground">
        <span className="font-medium text-foreground">{Math.round(replyRate * 100)}%</span> replied ·{" "}
        {replied}/{contacted}
      </span>,
    );
  }

  if (parts.length === 0) return null;
  return (
    <span className="flex min-w-0 items-center gap-3 truncate text-xs" style={MONO}>
      {parts}
    </span>
  );
}

function Twisty({ open }: { open: boolean }) {
  return (
    <ChevronRight
      className={cn(
        "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
        open && "rotate-90",
      )}
      aria-hidden
    />
  );
}

export function EngagementHeaderRow({
  row,
  scaleTo,
  showRate,
  focused,
  onToggle,
  onFocus,
  selected,
  someSelected,
  onToggleSelect,
}: {
  row: GroupRow;
  scaleTo: number;
  /** False while a filter is narrowing the book — see GroupVitals. */
  showRate: boolean;
  focused: boolean;
  onToggle: () => void;
  onFocus: () => void;
  selected: boolean;
  someSelected: boolean;
  onToggleSelect: () => void;
}) {
  const node = row.node;
  const eng = node.engagement!;

  return (
    <div
      role="row"
      className="flex h-full items-center gap-x-3 border-b border-border bg-subtle px-3"
      data-testid="workspace-engagement"
    >
      <Tick
        checked={selected}
        indeterminate={!selected && someSelected}
        onChange={onToggleSelect}
        label={`Select every company in ${eng.name}`}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={row.open}
        className="flex min-w-0 shrink items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Twisty open={row.open} />
        <span
          className={cn(
            "shrink-0 rounded-[3px] px-1 text-[10px] leading-4",
            DEAL_TYPE_STYLE[eng.type],
          )}
        >
          {DEAL_TYPE_SHORT[eng.type]}
        </span>
        <span className="truncate text-sm font-semibold text-foreground">{node.label}</span>
        <span
          className="shrink-0 rounded-[4px] bg-card px-1.5 text-[11px] font-medium leading-[18px] text-muted-foreground ring-1 ring-inset ring-border"
          style={MONO}
        >
          {node.vitals.total}
        </span>
      </button>

      <GroupVitals node={node} showRate={showRate} strong />

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <span className="mr-2 hidden w-32 @3xl:block">
          <HealthBar vitals={node.vitals} scaleTo={scaleTo} />
        </span>
        <button
          type="button"
          onClick={onFocus}
          aria-pressed={focused}
          className={cn(
            "h-7 rounded-md px-2 text-xs font-medium transition-colors",
            focused
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
          title={focused ? "Show every engagement again" : "Show only this engagement"}
        >
          {focused ? "Show all" : "Focus"}
        </button>
        <AddCompanyDialog
          mandateId={eng.id}
          mandateName={eng.name}
          mandateType={eng.type}
          exchangeRate={null}
          trigger={
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <Plus aria-hidden /> Add
            </Button>
          }
        />
      </div>
    </div>
  );
}

export function SubGroupHeaderRow({
  row,
  mandate,
  onToggle,
  selected,
  someSelected,
  onToggleSelect,
}: {
  row: GroupRow;
  mandate: { id: number; name: string; type: MandateType } | null;
  onToggle: () => void;
  selected: boolean;
  someSelected: boolean;
  onToggleSelect: () => void;
}) {
  const node = row.node;
  const indent = 12 + row.depth * 18;

  return (
    <div
      role="row"
      className="group/grp flex h-full items-center gap-x-3 border-b border-border bg-card pr-3"
      style={{ paddingLeft: indent }}
    >
      <Tick
        checked={selected}
        indeterminate={!selected && someSelected}
        onChange={onToggleSelect}
        label={`Select every company in ${node.label}`}
        className="opacity-0 transition-opacity group-hover/grp:opacity-100 focus-visible:opacity-100 aria-checked:opacity-100"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={row.open}
        className="flex min-w-0 shrink items-center gap-1.5 rounded-sm text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Twisty open={row.open} />
        <span
          className={cn(
            "truncate text-xs text-foreground",
            row.depth === 1 ? "font-semibold" : "font-medium",
          )}
        >
          {node.label}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground" style={MONO}>
          {node.vitals.total}
        </span>
      </button>

      <GroupVitals node={node} showRate={false} />

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span className="hidden w-20 @4xl:block">
          <HealthBar vitals={node.vitals} size="sm" />
        </span>
        {mandate && (
          <AddCompanyDialog
            mandateId={mandate.id}
            mandateName={mandate.name}
            mandateType={mandate.type}
            exchangeRate={null}
            defaultSourcingLayerId={node.layerId ?? undefined}
            defaultCategoryId={node.categoryId ?? undefined}
            trigger={
              <button
                className="grid size-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/grp:opacity-100 focus-visible:opacity-100"
                title={`Add a company to ${node.label}`}
                aria-label={`Add a company to ${node.label}`}
                data-testid={`inline-add-${node.path}`}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
              </button>
            }
          />
        )}
      </div>
    </div>
  );
}

/* ── Company row ───────────────────────────────────────────────────────────── */

/**
 * The top priority reason, as the row's "why now".
 *
 * Only ever a restatement of a field the server computed — "72 days overdue" is
 * `days_remaining`, read aloud. There is no score on screen and no invented signal;
 * the panel behind the row lists every reason with the same wording.
 */
function Signal({ company, verbose }: { company: Company; verbose: boolean }) {
  const reasons = priorityOf(company).reasons;
  // In a structural view the column stays nearly empty on purpose: lateness and a
  // pending intro are already what the Next-touch cell says, and repeating "52 days
  // overdue" in red beside a red "52d late" doubles the alarm on every row. The one
  // thing a row cannot otherwise tell you — somebody answered — earns a mark here.
  // Sorting by priority is the user asking for the whole reasoning, so then all of it
  // shows.
  const top = verbose ? reasons[0] : reasons.find((r) => r.tone === "positive");
  if (!top) return null;
  const ink =
    top.tone === "danger"
      ? "font-medium text-danger-ink"
      : top.tone === "awaiting"
        ? AWAITING_INK
        : top.tone === "positive"
          ? "font-medium text-success-ink"
          : "text-muted-foreground";
  return (
    <span className={cn("block truncate text-xs", ink)} title={top.label}>
      {top.label}
    </span>
  );
}

export function CompanyGridRow({
  row,
  dense,
  cursor,
  showSignal,
  selected,
  peeked,
  onToggleSelect,
  onPeek,
}: {
  row: CompanyRowItem;
  dense: boolean;
  /** The keyboard cursor is on this row. */
  cursor: boolean;
  showSignal: boolean;
  selected: boolean;
  peeked: boolean;
  onToggleSelect: () => void;
  onPeek: () => void;
}) {
  const c = row.company;
  const status = STATUS_META[c.status] ?? STATUS_META.NOT_CONTACTED;
  const indent = 12 + row.depth * 18;

  // The engagement, not the band. A flat view mixes books, and the same company can
  // legitimately sit in two of them — "Acumen" twice with nothing to tell them apart
  // reads as a duplicate-data bug rather than as one target in two engagements.
  const meta = [
    row.showEngagement ? (row.engagementLabel ?? null) : null,
    c.hq ?? null,
    row.showCategory ? (c.category_name ?? null) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      role="row"
      id={`wsrow-${row.key}`}
      aria-selected={selected}
      onClick={onPeek}
      className={cn(
        GRID_COLS,
        "group h-full cursor-pointer items-center gap-x-3 border-b border-border pr-3 transition-colors",
        selected ? "bg-accent" : peeked ? "bg-muted" : "hover:bg-subtle",
        // An inset ring rather than an outline: the rows sit flush against each other,
        // and an outline would be clipped by the row below it.
        cursor && "ring-[1.5px] ring-inset ring-ring",
      )}
      style={{ paddingLeft: indent }}
      data-testid="grid-company-row"
    >
      <span role="gridcell" className="flex items-center">
        <Tick
          checked={selected}
          onChange={onToggleSelect}
          label={`Select ${c.company_name}`}
          className={cn(
            "transition-opacity focus-visible:opacity-100 group-hover:opacity-100",
            selected ? "opacity-100" : "opacity-0",
          )}
        />
      </span>

      <span role="gridcell" className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">
          {c.company_name}
        </span>
        {/* An em-dash on a row with nothing to say is a column of em-dashes; the
            second line simply does not render when there is no second line. */}
        {!dense && meta && (
          <span className="block truncate text-xs text-muted-foreground">{meta}</span>
        )}
      </span>

      <span role="gridcell" className="hidden min-w-0 @5xl:block">
        <Signal company={c} verbose={showSignal} />
      </span>

      <span role="gridcell" className="hidden min-w-0 @xl:block">
        <span className={cn("inline-flex items-center gap-1.5 truncate text-xs", status.ink)}>
          <span className={status.dot} aria-hidden />
          {status.label}
        </span>
      </span>

      <span role="gridcell" className="min-w-0 whitespace-nowrap">
        <NextTouch c={c} />
      </span>

      <span role="gridcell" className="hidden min-w-0 text-xs @3xl:block">
        {c.primary_contact ? (
          <span className="block truncate text-foreground" title={c.primary_contact.email ?? undefined}>
            {c.primary_contact.contact_person}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 truncate text-muted-foreground">
            <UserPlus className="h-3 w-3 shrink-0" aria-hidden />
            No contact
          </span>
        )}
      </span>

      {/* Actions stop the click from opening the panel underneath them — a menu that
          also peeks the row is a menu that always fires twice. */}
      <span
        role="gridcell"
        className="hidden justify-end @md:flex"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <RowActions company={c} />
        </span>
      </span>
    </div>
  );
}

/* ── Empty group ───────────────────────────────────────────────────────────── */

export function EmptyGroupRow({
  depth,
  mandate,
}: {
  depth: number;
  mandate: { id: number; name: string; type: MandateType } | null;
}) {
  return (
    <div
      role="row"
      className="flex h-full items-center border-b border-border pr-3"
      style={{ paddingLeft: 12 + (depth + 1) * 18 }}
    >
      {/*
        "This book is empty" is only true when the book really is.
        Under a search or a filter the caller passes no mandate, because the group has
        no *matches* — offering to add the first company to a book that already holds
        two hundred is telling the user something false about their own data.
      */}
      {mandate ? (
        <p className="text-xs text-muted-foreground">
          This book is empty.{" "}
          <AddCompanyDialog
            mandateId={mandate.id}
            mandateName={mandate.name}
            mandateType={mandate.type}
            exchangeRate={null}
            trigger={<button className={INK_LINK}>Add the first company</button>}
          />{" "}
          or{" "}
          <Link href="/sourcing" className={INK_LINK}>
            discover targets
          </Link>
          .
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Nothing in this book matches.</p>
      )}
    </div>
  );
}
