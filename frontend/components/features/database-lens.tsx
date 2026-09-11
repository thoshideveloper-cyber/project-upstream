"use client";

import { useState } from "react";
import Link from "next/link";
import { History, Import, Sparkles } from "lucide-react";

import { UNCLASSIFIED_SECTOR, type PoolSegment, type RevBand } from "@/hooks/use-candidates";
import type { PoolFacets } from "@/hooks/use-sourcing-facets";
import { LABEL, MONO, SEGMENT_META } from "@/lib/design";
import { cn } from "@/lib/utils";

/**
 * The database lens — Discover's left instrument.
 *
 * It reads the firm's company database back to the analyst before a single query is
 * typed: how big it is, which side of the market it leans to, which sectors and cities
 * it covers, and — the part that matters on a firm's first day — how much of it is
 * actually filled in. Every row is simultaneously a readout and the filter it describes,
 * so narrowing the list is a consequence of understanding it rather than a separate act.
 *
 * Written for sparse data on purpose. A new firm's database has real names, cities and
 * domains but no financials, so a rail that rendered four empty revenue bands would look
 * broken on the exact screen a new user opens first. Groups with nothing in them say what
 * would fill them instead of showing zeros, and the coverage strip at the foot states the
 * gap outright.
 */

/** A lens row: label, count, share-of-database underbar. Clicking IS filtering. */
function LensRow({
  label,
  count,
  total,
  active,
  icon,
  accent,
  onClick,
  onHoverChange,
}: {
  label: string;
  count: number;
  total: number;
  active: boolean;
  icon?: React.ReactNode;
  /** Solid fill for the underbar — segments carry their own hue; everything else amber. */
  accent?: string;
  onClick: () => void;
  onHoverChange?: (hovering: boolean) => void;
}) {
  const share = total > 0 ? (count / total) * 100 : 0;
  const quiet = count === 0;
  return (
    <button
      onClick={onClick}
      onPointerEnter={() => onHoverChange?.(true)}
      onPointerLeave={() => onHoverChange?.(false)}
      onFocus={() => onHoverChange?.(true)}
      onBlur={() => onHoverChange?.(false)}
      aria-pressed={active}
      disabled={quiet && !active}
      title={
        quiet
          ? `${label} — none on file`
          : `${label} — ${count} of ${total} (${share < 1 ? "<1" : Math.round(share)}%)`
      }
      className={cn(
        "group/lens flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-subtle ring-1 ring-border-strong" : "hover:bg-muted/60",
        quiet && !active && "cursor-default opacity-45",
      )}
    >
      <span className="flex w-full items-baseline justify-between gap-2">
        <span
          className={cn(
            "flex min-w-0 items-center gap-1.5 truncate text-xs",
            active
              ? "font-medium text-foreground"
              : "text-muted-foreground group-hover/lens:text-foreground",
          )}
        >
          {icon}
          <span className="truncate">{label}</span>
        </span>
        <span
          key={count}
          className={cn(
            "count-pop shrink-0 text-[11px] font-semibold tabular-nums",
            active ? "text-primary-ink" : "text-secondary-foreground",
          )}
          style={MONO}
        >
          {count.toLocaleString("en-IN")}
        </span>
      </span>
      <span className="h-[2px] w-full overflow-hidden rounded-full bg-accent">
        <span
          className={cn(
            "horizon-load block h-full rounded-full",
            active ? "bg-primary" : (accent ?? "bg-foreground/25"),
          )}
          style={{ width: `${quiet ? 0 : Math.max(3, share)}%` }}
        />
      </span>
    </button>
  );
}

function LensGroup({
  title,
  children,
  aside,
}: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 px-2">
        <span className={LABEL}>{title}</span>
        {aside}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

/**
 * Coverage strip — one hairline per fact the database could carry.
 *
 * A readout, not a filter: "how much of what I'm searching is actually known" is
 * context for every other number in the rail, and on a fresh firm it is the honest
 * answer to why the size bands are empty.
 */
function CoverageBar({ label, filled, total }: { label: string; filled: number; total: number }) {
  const pct = total > 0 ? (filled / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-[52px] shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-accent">
        <span
          className={cn(
            "horizon-load block h-full rounded-full",
            pct === 0 ? "bg-transparent" : pct < 50 ? "bg-ink-400" : "bg-foreground",
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span
        className="w-[34px] shrink-0 text-right text-[11px] tabular-nums text-secondary-foreground"
        style={MONO}
      >
        {total > 0 ? `${Math.round(pct)}%` : "—"}
      </span>
    </div>
  );
}

export interface LensSelection {
  warmOnly: boolean;
  hasScore: boolean;
  segment: PoolSegment | "";
  sector: string;
  hq: string;
  band: RevBand | "";
  categoryId: number;
}

export function DatabaseLens({
  facets,
  selection,
  onChange,
  databaseMode,
}: {
  facets: PoolFacets | undefined;
  selection: LensSelection;
  onChange: <K extends keyof LensSelection>(key: K, value: LensSelection[K]) => void;
  /** No engagement selected — "scored for this deal" has nothing to count against. */
  databaseMode: boolean;
}) {
  // Hovering a Side row lights its band in the composition bar, and vice versa. The
  // legend and the chart are the same object; cross-highlighting says so.
  const [hoverSegment, setHoverSegment] = useState<PoolSegment | null>(null);

  if (!facets) {
    return (
      <aside className="hidden flex-col gap-4 rounded-lg bg-card p-3 ring-1 ring-border lg:flex">
        <div className="space-y-2 px-2">
          <div className="h-2 w-20 animate-pulse rounded bg-ink-100" />
          <div className="h-6 w-16 animate-pulse rounded bg-ink-100" />
          <div className="h-1.5 w-full animate-pulse rounded bg-ink-100" />
        </div>
        {[1, 2, 3].map((g) => (
          <div key={g} className="space-y-1.5 px-2">
            <div className="h-2 w-14 animate-pulse rounded bg-ink-100" />
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-5 animate-pulse rounded bg-ink-100" />
            ))}
          </div>
        ))}
      </aside>
    );
  }

  const total = facets.total;
  const segments = facets.by_segment.filter((s) => SEGMENT_META[s.segment]);
  const segmentTotal = segments.reduce((sum, s) => sum + s.count, 0);
  const unsegmented = Math.max(0, total - segmentTotal);
  const sizedTotal = facets.size_bands.reduce((sum, b) => sum + b.count, 0);

  return (
    <aside
      // Sticky, and never taller than the viewport: the rail scrolls itself rather than
      // pushing the page, which is what makes it usable once a real book grows the
      // sector and HQ groups past a screen.
      className="sticky top-4 hidden max-h-[calc(100vh-2rem)] flex-col gap-4 overflow-y-auto overscroll-contain rounded-lg bg-card p-3 ring-1 ring-border lg:flex"
      aria-label="Database composition"
    >
      {/* ── Header — the size of the database and its shape in one bar ── */}
      <div className="px-2">
        <div className={LABEL}>The database</div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span
            key={total}
            className="count-pop text-lg font-semibold leading-none tabular-nums"
            style={MONO}
          >
            {total.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {total === 1 ? "company" : "companies"}, firm-wide
          </span>
        </div>

        {segmentTotal > 0 && (
          <>
            <div
              className="mt-2 flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-accent"
              role="img"
              aria-label={segments
                .map((s) => `${s.count} ${SEGMENT_META[s.segment].plural.toLowerCase()}`)
                .join(", ")}
            >
              {segments.map((s) => (
                <span
                  key={s.segment}
                  className={cn(
                    "horizon-load h-full transition-opacity duration-200",
                    SEGMENT_META[s.segment].bar,
                    hoverSegment && hoverSegment !== s.segment ? "opacity-30" : "opacity-100",
                  )}
                  style={{ width: `${(s.count / total) * 100}%` }}
                />
              ))}
              {unsegmented > 0 && (
                <span
                  className="h-full bg-foreground/15"
                  style={{ width: `${(unsegmented / total) * 100}%` }}
                />
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              {segments.map((s) => (
                <span key={s.segment} className="inline-flex items-center gap-1">
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", SEGMENT_META[s.segment].bar)}
                    aria-hidden
                  />
                  <span className="tabular-nums" style={MONO}>
                    {s.count}
                  </span>
                  <span>{SEGMENT_META[s.segment].plural.toLowerCase()}</span>
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Coverage — the caveat on every count below, so it sits with the total ── */}
      {total > 0 && (
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2 px-2">
            <span className={LABEL}>Coverage</span>
            <Link
              href="/import"
              className="inline-flex items-center gap-1 text-[10px] font-medium text-primary-ink hover:underline"
            >
              <Import className="h-3 w-3" aria-hidden /> Enrich
            </Link>
          </div>
          <div className="space-y-1.5 px-2">
            <CoverageBar label="Domain" filled={facets.coverage.website} total={total} />
            <CoverageBar label="Revenue" filled={facets.coverage.revenue} total={total} />
            <CoverageBar label="Staff" filled={facets.coverage.headcount} total={total} />
          </div>
        </div>
      )}

      {/* ── Signals — prior work and AI coverage for the open deal ── */}
      <LensGroup title="Signals">
        <LensRow
          label="Worked before"
          icon={<History className="h-3 w-3 shrink-0 text-ink-400" aria-hidden />}
          count={facets.warm}
          total={total}
          active={selection.warmOnly}
          onClick={() => onChange("warmOnly", !selection.warmOnly)}
        />
        {!databaseMode && (
          <LensRow
            label="Scored for this deal"
            icon={<Sparkles className="h-3 w-3 shrink-0 text-ink-400" aria-hidden />}
            count={facets.scored}
            total={total}
            active={selection.hasScore}
            onClick={() => onChange("hasScore", !selection.hasScore)}
          />
        )}
      </LensGroup>

      {/* ── Side of the market — profile-level, so it works on an empty book ── */}
      {segments.length > 0 && (
        <LensGroup title="Side">
          {segments.map((s) => {
            const meta = SEGMENT_META[s.segment];
            const active = selection.segment === s.segment;
            return (
              <LensRow
                key={s.segment}
                label={meta.plural}
                count={s.count}
                total={total}
                active={active}
                accent={meta.bar}
                onHoverChange={(on) => setHoverSegment(on ? s.segment : null)}
                onClick={() => onChange("segment", active ? "" : s.segment)}
              />
            );
          })}
        </LensGroup>
      )}

      {/* ── Sector — the research bucket, including the honest remainder ── */}
      {facets.by_sector.length > 0 && (
        <LensGroup title="Sector">
          {facets.by_sector.map((s) => {
            const active = selection.sector === s.sector;
            return (
              <LensRow
                key={s.sector}
                label={s.label}
                count={s.count}
                total={total}
                active={active}
                onClick={() => onChange("sector", active ? "" : s.sector)}
              />
            );
          })}
        </LensGroup>
      )}

      {/* ── Category — a placement's classification, so it exists only once a book does ── */}
      {facets.by_category.length > 0 && (
        <LensGroup title="Category">
          {facets.by_category.slice(0, 8).map((cat) => {
            const active = selection.categoryId === cat.id;
            return (
              <LensRow
                key={cat.id}
                label={cat.name}
                count={cat.count}
                total={total}
                active={active}
                onClick={() => onChange("categoryId", active ? 0 : cat.id)}
              />
            );
          })}
        </LensGroup>
      )}

      {facets.by_hq.length > 0 && (
        <LensGroup title="HQ">
          {facets.by_hq.slice(0, 6).map((h) => {
            const active = selection.hq.toLowerCase() === h.hq.toLowerCase();
            return (
              <LensRow
                key={h.hq}
                label={h.hq}
                count={h.count}
                total={total}
                active={active}
                onClick={() => onChange("hq", active ? "" : h.hq)}
              />
            );
          })}
        </LensGroup>
      )}

      {/* Size only exists where revenue does. With none on file the group says what would
          fill it — four bands reading 0 would look like a broken instrument. */}
      {sizedTotal > 0 ? (
        <LensGroup
          title="Size"
          aside={
            sizedTotal < total ? (
              <span className="text-[10px] tabular-nums text-muted-foreground" style={MONO}>
                {sizedTotal}/{total}
              </span>
            ) : undefined
          }
        >
          {facets.size_bands.map((b) => {
            const active = selection.band === b.key;
            return (
              <LensRow
                key={b.key}
                label={b.label}
                count={b.count}
                total={total}
                active={active}
                onClick={() => onChange("band", active ? "" : b.key)}
              />
            );
          })}
        </LensGroup>
      ) : (
        total > 0 && (
          <LensGroup title="Size">
            <p className="px-2 text-[11px] leading-relaxed text-muted-foreground">
              No revenue on file yet.{" "}
              <Link
                href="/import"
                className="font-medium text-primary-ink underline-offset-2 hover:underline"
              >
                Import a workbook
              </Link>{" "}
              to size these companies.
            </p>
          </LensGroup>
        )
      )}
    </aside>
  );
}

/** Re-exported so the page and the rail agree on the sentinel without importing twice. */
export { UNCLASSIFIED_SECTOR };
