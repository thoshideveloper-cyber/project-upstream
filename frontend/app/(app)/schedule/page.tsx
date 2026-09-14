"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Flame,
  FlaskConical,
  Focus as FocusIcon,
  Inbox,
  Keyboard,
  Mail,
  NotebookPen,
  PhoneCall,
  Reply,
  Search,
  Settings2,
  Snowflake,
  Sparkles,
  Sun,
  Unplug,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useConfirm } from "@/components/features/confirm-dialog";

import {
  useDueQueue,
  useNeedsInitialQueue,
  useScheduleStats,
  useBulkLogEvents,
  type ScheduleRow,
  type QueueBand,
  type QueueSort,
} from "@/hooks/use-schedule";
import { useMandates } from "@/hooks/use-mandates";
import { useDisconnectEmail, useEmailAccount } from "@/hooks/use-email";
import { LogOutreachDialog } from "@/components/features/log-outreach-dialog";
import { TaskDialog } from "@/components/features/task-dialog";
import { ComposeEmailSheet } from "@/components/features/compose-email-sheet";
import { EmailConnectPanel, GmailGlyph, OutlookGlyph } from "@/components/features/email-connect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableSkeleton } from "@/components/features/table-skeleton";
import {
  decodeState,
  encodeQuery,
  enumParam,
  stringParam,
  type ParamCodec,
  type ParamSpec,
} from "@/lib/table-url-state";
import {
  DEAL_TYPE_LABEL,
  DEAL_TYPE_SHORT,
  DEAL_TYPE_STYLE,
  DISPLAY,
  MONO,
  PAGE_TITLE,
  PAGE_TITLE_STYLE,
  SELECT_CLS,
  STATUS_META,
} from "@/lib/design";
import { cn } from "@/lib/utils";
import type { CompanyStatus, MandateType } from "@/types";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Type, controls, deal-type tags and status dots all come from the shared
// vocabulary (lib/design.ts) — this page defines none of its own.

// ── Upstream Intelligence — HONEST derived signals ─────────────────────────────
// Nothing here is a fabricated prediction. Temperature is a re-read of the real
// company status; priority is a deterministic heuristic over real cadence fields.
// No reply-likelihood %, no email-open tracking (no backend signal exists for those).

type Temp = "hot" | "warm" | "cold" | "new";

const TEMP_META: Record<
  Temp,
  { label: string; Icon: typeof Flame; text: string; chip: string; note: string }
> = {
  hot: {
    label: "Hot",
    Icon: Flame,
    // Temperature in the state colours: hot (they replied) is green, warm (in
    // conversation) blue, cold recedes to grey, new is a dashed outline — nothing has
    // been sent, so nothing about it has started yet.
    text: "text-success-ink",
    chip: "border-success-line bg-success-soft text-success-ink",
    note: "engaged — move fast",
  },
  warm: {
    label: "Warm",
    Icon: Sun,
    text: "text-info-ink",
    chip: "border-info-line bg-info-soft text-info-ink",
    note: "in conversation",
  },
  cold: {
    label: "Cold",
    Icon: Snowflake,
    text: "text-muted-foreground",
    chip: "border-border bg-muted text-muted-foreground",
    note: "no reply yet",
  },
  new: {
    label: "New",
    Icon: Sparkles,
    text: "text-foreground",
    chip: "border-dashed border-border-strong bg-card text-foreground",
    note: "not yet contacted",
  },
};

/** Read the outreach "temperature" straight off the real status — a restyling of
 *  what the analyst already knows, not a prediction. */
function temperatureOf(row: ScheduleRow): Temp {
  if (row.schedule_status === "AWAITING_INITIAL") return "new";
  switch (row.company_status) {
    case "RESPONDED":
    case "INTERESTED":
      return "hot";
    case "CONTACTED":
      return "warm";
    default:
      return "cold";
  }
}

/** Deterministic priority heuristic (0–100) over real fields: how late, how due,
 *  how warm. Used only to pick the lead row and to order the focus flow —
 *  never presented as a probability. */
function priorityScore(row: ScheduleRow): number {
  let s = 0;
  const dr = row.days_remaining;
  if (row.schedule_status === "AWAITING_INITIAL") s += 18;
  else if (dr == null) s += 8;
  else if (dr < 0) s += Math.min(55, 26 + Math.abs(dr)); // overdue: base + days late
  else if (dr === 0) s += 30; // due today
  else s += Math.max(4, 22 - dr); // sooner is higher
  const t = temperatureOf(row);
  if (t === "hot") s += 30;
  else if (t === "warm") s += 14;
  else if (t === "new") s += 6;
  return Math.min(100, Math.round(s));
}

/** One plain-language line explaining why this touch matters now. */
function whyLine(row: ScheduleRow): string {
  const dr = row.days_remaining;
  if (row.schedule_status === "AWAITING_INITIAL") return "First outreach — the clock hasn't started";
  if (dr == null) return "No next date set";
  if (dr < 0) return `${Math.abs(dr)} ${Math.abs(dr) === 1 ? "day" : "days"} overdue`;
  if (dr === 0) return "Due today";
  return `Due in ${dr} ${dr === 1 ? "day" : "days"}`;
}

/** Compact human date: "1 Jun". */
function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return iso;
  return `${d} ${MONTH[m - 1]}`;
}

/** Local date shifted by `offset` days from today. */
function dayFromOffset(offset: number) {
  const dt = new Date();
  dt.setDate(dt.getDate() + offset);
  return { weekday: WEEKDAY[dt.getDay()], day: dt.getDate(), month: MONTH[dt.getMonth()] };
}

function bandOf(dr: number | null): "overdue" | "today" | "upcoming" {
  if (dr === null) return "upcoming";
  if (dr < 0) return "overdue";
  if (dr === 0) return "today";
  return "upcoming";
}

// ── Motion primitives ───────────────────────────────────────────────────────────

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** Eased count-up. Animates from its previous value on change (0 on mount) with an
 *  ease-out-cubic curve; snaps instantly when reduced-motion is requested. */
function AnimatedNumber({
  value,
  delay = 0,
  className,
  style,
}: {
  value: number;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const to = value;
    const from = fromRef.current;
    if (reduced || from === to) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }
    const duration = 460;
    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now + delay;
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delay, reduced]);

  return (
    <span className={className} style={style}>
      {display}
    </span>
  );
}

// ── Temperature chip — the honest hot/warm/cold read ────────────────────────────

function TempChip({ temp, size = "sm" }: { temp: Temp; size?: "sm" | "lg" }) {
  const m = TEMP_META[temp];
  const Icon = m.Icon;
  return (
    <span
      title={`${m.label} · ${m.note}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-[4px] border font-medium",
        m.chip,
        size === "lg" ? "px-2.5 py-1 text-xs" : "px-1.5 py-0.5 text-[11px]",
      )}
    >
      <Icon className={size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3"} aria-hidden />
      {m.label}
    </span>
  );
}

// ── Due token — Upstream's urgency language: no bar, no box. Colour + a compact,
//    fixed-width monospaced count. Overdue is the only loud tone; everything else
//    recedes so the eye scans company names and only overdue days pull focus. ────

type RailTone = "overdue" | "today" | "week" | "initial";

const RAIL_TONE: Record<RailTone, { text: string }> = {
  overdue: { text: "text-danger-ink" },
  today: { text: "text-warning-ink" },
  week: { text: "text-muted-foreground" },
  initial: { text: "text-secondary-foreground" },
};

// No row wash: the red count already marks a late row, and tinting sixty late rows
// red turns the whole queue into one alarm. Every row takes the same hover.
const ROW_TINT: Record<RailTone, string> = {
  overdue: "hover:bg-subtle",
  today: "hover:bg-subtle",
  week: "hover:bg-subtle",
  initial: "hover:bg-subtle",
};

function railFor(row: ScheduleRow): { tone: RailTone; num?: number; text?: string; small: string } {
  if (row.schedule_status === "AWAITING_INITIAL")
    return { tone: "initial", text: "new", small: "awaiting first email" };
  const dr = row.days_remaining;
  if (dr === null) return { tone: "week", text: "—", small: "no date" };
  if (dr < 0) return { tone: "overdue", num: Math.abs(dr), small: `${Math.abs(dr)} days overdue` };
  if (dr === 0) return { tone: "today", text: "today", small: "due today" };
  return { tone: "week", num: dr, small: `due in ${dr} days` };
}

/** The due token: a fixed-width, right-aligned monospaced count, colour-coded, that
 *  sits inline with the company name — one visual unit, no separate gutter column. */
function DueToken({ row, index = 0, size = "sm" }: { row: ScheduleRow; index?: number; size?: "sm" | "lg" }) {
  const r = railFor(row);
  const t = RAIL_TONE[r.tone];
  return (
    <span
      title={r.small}
      className={cn(
        "shrink-0 self-center text-right font-semibold tabular-nums",
        size === "lg" ? "w-12 text-[15px]" : "w-11 text-[13px]",
        t.text,
      )}
      style={MONO}
    >
      {r.num != null ? (
        <>
          <AnimatedNumber value={r.num} delay={Math.min(index, 12) * 20} className="tabular-nums" style={MONO} />d
        </>
      ) : (
        r.text
      )}
    </span>
  );
}

// ── Horizon rail — the page's signature instrument ───────────────────────────────
// One slim tape: All · Late · Today · the next six days ┊ New. Each cell is a mono
// count over a load-proportional underbar, so the strip reads the whole horizon at
// a glance — and clicking a cell scopes the queue. It replaces three former
// controls (band filter row, Queue/Week toggle, 132px workload histogram) with one
// element whose every pixel encodes something true: count, distribution, urgency
// colour, and the current scope.

/** What the analyst is looking at: the whole queue, one urgency band, one day
 *  ahead (1–6), or the not-yet-started lane. */
type Seg = "all" | "late" | "today" | "new" | number;

// Load underbars carry urgency in the state colours: late is red, today amber, the
// week ahead neutral ink, and the not-yet-started lane a lighter grey.
const SEG_STYLE = {
  all: { count: "text-foreground", bar: "bg-ink-200" },
  late: { count: "font-semibold text-danger-ink", bar: "bg-danger" },
  today: { count: "text-warning-ink", bar: "bg-warning" },
  day: { count: "text-foreground", bar: "bg-ink-400" },
  new: { count: "text-foreground", bar: "bg-ink-300" },
} as const;

function HorizonCell({
  label,
  count,
  tone,
  active,
  wide,
  barPct,
  delay,
  onClick,
}: {
  label: string;
  count: number | null;
  tone: keyof typeof SEG_STYLE;
  active: boolean;
  wide?: boolean;
  barPct: number;
  delay: number;
  onClick: () => void;
}) {
  const s = SEG_STYLE[tone];
  const quiet = count === 0;
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-w-[56px] flex-col gap-1 rounded-md px-2 py-1.5 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
        wide ? "flex-none" : "flex-1",
        active ? "bg-card shadow-sm ring-1 ring-border" : "hover:bg-card/60",
      )}
    >
      <span
        className={cn(
          "truncate text-xs font-medium",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span
        className={cn("text-[13px] font-semibold leading-none tabular-nums", quiet ? "text-muted-foreground" : s.count)}
        style={MONO}
      >
        {count ?? "—"}
      </span>
      <span className="h-[3px] w-full overflow-hidden rounded-full bg-accent">
        <span
          className={cn("horizon-load block h-full rounded-full", !quiet && barPct > 0 && s.bar)}
          style={{ width: `${quiet || barPct <= 0 ? 0 : Math.max(8, barPct)}%`, "--load-delay": `${delay}ms` } as CSSProperties}
        />
      </span>
    </button>
  );
}

function HorizonRail({
  total,
  late,
  today,
  days,
  fresh,
  seg,
  onSeg,
}: {
  total: number | null;
  late: number | null;
  today: number | null;
  days: { offset: number; count: number }[];
  fresh: number | null;
  seg: Seg;
  onSeg: (s: Seg) => void;
}) {
  const peak = Math.max(1, late ?? 0, today ?? 0, fresh ?? 0, ...days.map((d) => d.count));
  const pct = (n: number | null) => ((n ?? 0) / peak) * 100;
  return (
    <div
      role="group"
      aria-label="Queue horizon — scope by urgency or day"
      className="flex items-stretch gap-0.5 overflow-x-auto rounded-lg bg-muted p-1 ring-1 ring-inset ring-border"
    >
      {/* "All" is a scope, not a load — no underbar: totals aren't on the day scale. */}
      <HorizonCell label="All" count={total} tone="all" wide active={seg === "all"} barPct={0} delay={0} onClick={() => onSeg("all")} />
      <div className="mx-0.5 w-px shrink-0 self-stretch bg-border/70" aria-hidden />
      <HorizonCell label="Late" count={late} tone="late" wide active={seg === "late"} barPct={pct(late)} delay={40} onClick={() => onSeg("late")} />
      <HorizonCell label="Today" count={today} tone="today" wide active={seg === "today"} barPct={pct(today)} delay={80} onClick={() => onSeg("today")} />
      {days.map((d, i) => {
        const info = dayFromOffset(d.offset);
        return (
          <HorizonCell
            key={d.offset}
            label={`${info.weekday} ${info.day}`}
            count={d.count}
            tone="day"
            active={seg === d.offset}
            barPct={pct(d.count)}
            delay={120 + i * 30}
            onClick={() => onSeg(d.offset)}
          />
        );
      })}
      <div className="mx-0.5 w-px shrink-0 self-stretch bg-border/70" aria-hidden />
      <HorizonCell label="New" count={fresh} tone="new" wide active={seg === "new"} barPct={pct(fresh)} delay={320} onClick={() => onSeg("new")} />
    </div>
  );
}

// ── Section header (one band of the unified queue) ──────────────────────────────

function SectionHeader({
  dot,
  tone,
  label,
  sub,
  count,
  icon,
  onSelectAll,
  allSelected,
}: {
  dot: string;
  tone: string;
  label: string;
  sub?: string;
  count?: number;
  icon?: React.ReactNode;
  /** Present on selectable (due) sections: selects/clears every loaded row in it. */
  onSelectAll?: () => void;
  allSelected?: boolean;
}) {
  return (
    <div className="sticky top-0 z-10 flex h-9 items-center gap-2 border-b border-border bg-muted px-4">
      {icon ?? <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden />}
      <span className={cn("text-xs font-semibold", tone)}>{label}</span>
      {count != null && (
        <span className="rounded-[4px] bg-card px-1.5 text-[11px] font-medium leading-[18px] tabular-nums text-muted-foreground ring-1 ring-inset ring-border">
          {count}
        </span>
      )}
      {sub && <span className="text-xs text-muted-foreground">· {sub}</span>}
      {onSelectAll && (
        <button
          onClick={onSelectAll}
          className="ml-auto rounded text-[11px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {allSelected ? "Clear selection" : "Select all"}
        </button>
      )}
    </div>
  );
}

// ── Row actions — contextual primary + quick outcomes ───────────────────────────

function RowActions({
  row,
  logIndex,
  lead,
  emailReady,
  onCompose,
  onLogged,
}: {
  row: ScheduleRow;
  logIndex?: number;
  /** Lead-row treatment: the primary action is filled and full-height. */
  lead?: boolean;
  /** Mailbox connected → the primary action composes a real email. */
  emailReady?: boolean;
  onCompose?: () => void;
  onLogged?: () => void;
}) {
  const [taskOpen, setTaskOpen] = useState(false);
  const awaiting = row.schedule_status === "AWAITING_INITIAL";
  const [quickType, setQuickType] = useState<string | null>(null);

  const primaryLabel = lead
    ? awaiting ? "Send intro" : emailReady ? "Send follow-up" : "Log follow-up"
    : awaiting ? "Send intro" : "Follow-up";
  const primary =
    emailReady && onCompose ? (
      lead ? (
        <Button
          size="sm"
          className="h-9 gap-1.5 rounded-r-none px-4 text-[13px] font-medium"
          data-log-index={logIndex}
          onClick={onCompose}
        >
          <Mail className="h-3.5 w-3.5" aria-hidden />
          {primaryLabel}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="h-7 rounded-r-none pr-2.5 text-xs font-normal transition-colors group-hover:border-border-strong group-hover:bg-primary group-hover:text-primary-foreground"
          data-log-index={logIndex}
          onClick={onCompose}
        >
          {primaryLabel}
        </Button>
      )
    ) : (
      <LogOutreachDialog
        companyId={row.company_id}
        companyName={row.company_name}
        defaultEventType={awaiting ? "INITIAL_EMAIL" : "FOLLOW_UP"}
        onLogged={onLogged}
        trigger={
          lead ? (
            <Button size="sm" className="h-9 gap-1.5 rounded-r-none px-4 text-[13px] font-medium" data-log-index={logIndex}>
              {primaryLabel}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-r-none pr-2.5 text-xs font-normal transition-colors group-hover:border-border-strong group-hover:bg-primary group-hover:text-primary-foreground"
              data-log-index={logIndex}
            >
              {primaryLabel}
            </Button>
          )
        }
      />
    );

  // One merged control — primary + outcomes read as a single action cluster, quiet
  // until the row is hovered/focused (then the primary fills amber).
  return (
    <div className="flex shrink-0 items-center">
      {primary}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            lead ? (
              <Button size="sm" variant="outline" className="-ml-px h-9 w-7 rounded-l-none px-0" aria-label="More outcomes" />
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="-ml-px h-7 w-6 rounded-l-none px-0 transition-colors group-hover:border-border-strong"
                aria-label="More outcomes"
              />
            )
          }
        >
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {emailReady && (
            <>
              <DropdownMenuItem onClick={() => setQuickType(awaiting ? "INITIAL_EMAIL" : "FOLLOW_UP")}>
                <NotebookPen className="h-4 w-4 text-muted-foreground" aria-hidden /> Log without sending
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => setQuickType("RESPONSE")}>
            <Reply className="h-4 w-4 text-foreground" aria-hidden /> Mark replied
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setQuickType("BOUNCE")}>
            <XCircle className="h-4 w-4 text-destructive-ink" aria-hidden /> Mark bounced
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setQuickType("CALL")}>
            <PhoneCall className="h-4 w-4 text-muted-foreground" aria-hidden /> Log call
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setQuickType("MEETING")}>
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden /> Log meeting
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setTaskOpen(true)}>
            <CheckSquare className="h-4 w-4 text-muted-foreground" aria-hidden /> Add task
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Pre-attached to this company — "chase them Thursday" filed from the queue. */}
      <TaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        defaults={{ title: "", company_id: row.company_id }}
      />
      {quickType !== null && (
        <LogOutreachDialog
          key={quickType}
          companyId={row.company_id}
          companyName={row.company_name}
          defaultEventType={quickType}
          open
          onOpenChange={(o) => !o && setQuickType(null)}
          onLogged={onLogged}
          trigger={null}
        />
      )}
    </div>
  );
}

// ── Queue row ──────────────────────────────────────────────────────────────────

function QueueRow({
  row,
  dealName,
  dealType,
  logIndex,
  index = 0,
  focused,
  clearing,
  selectable,
  selected,
  anySelected,
  emailReady,
  onCompose,
  onToggleSelect,
  onLogged,
}: {
  row: ScheduleRow;
  dealName?: string;
  dealType?: MandateType;
  logIndex?: number;
  index?: number;
  focused?: boolean;
  clearing?: boolean;
  selectable?: boolean;
  selected?: boolean;
  /** While a selection exists, every checkbox stays visible (discoverability). */
  anySelected?: boolean;
  emailReady?: boolean;
  onCompose?: () => void;
  onToggleSelect?: () => void;
  onLogged?: () => void;
}) {
  const awaiting = row.schedule_status === "AWAITING_INITIAL";
  const tone = railFor(row).tone;
  const status = STATUS_META[row.company_status as CompanyStatus] ?? STATUS_META.NOT_CONTACTED;
  const contact = row.primary_contact;

  return (
    <div
      data-row-index={logIndex}
      className={cn(
        "cv-row group flex min-h-[52px] items-center gap-2.5 py-2 pl-3 pr-2 transition-colors duration-150 sm:pr-3",
        ROW_TINT[tone],
        focused && "queue-row-focused",
        clearing && "row-clear",
      )}
      style={{ contain: "layout" }}
    >
      {selectable && (
        <button
          onClick={onToggleSelect}
          aria-label={selected ? "Deselect" : "Select"}
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all",
            selected
              ? "border-foreground bg-foreground text-background"
              : cn(
                  "border-input hover:border-border-strong focus-visible:opacity-100",
                  anySelected ? "opacity-60" : "opacity-0 group-hover:opacity-100",
                ),
          )}
        >
          {selected && <CheckCircle2 className="h-3 w-3" strokeWidth={3} aria-hidden />}
        </button>
      )}

      {/* Due token sits inline with the company — one unit — and the metadata below
          it is naturally indented past the token, breaking the perfect grid. */}
      <DueToken row={row} index={index} />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          {/* A real link, so middle-click / ctrl-click open the dossier in a tab. */}
          <Link
            href={`/companies/${row.company_id}`}
            title={row.regarding ?? undefined}
            className="truncate rounded text-left text-sm font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {row.company_name}
          </Link>
          {dealType && (
            <span
              title={DEAL_TYPE_LABEL[dealType]}
              aria-label={DEAL_TYPE_LABEL[dealType]}
              className={cn(
                "hidden shrink-0 rounded px-1.5 py-px text-[11px] font-medium sm:inline",
                DEAL_TYPE_STYLE[dealType],
              )}
            >
              {DEAL_TYPE_SHORT[dealType]}
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs font-normal text-muted-foreground">
          {dealName && <span>{dealName}</span>}
          {/* Who the touch goes to — the Contacts page surfacing inside the desk. */}
          {contact && (
            <>
              {dealName && <span aria-hidden> · </span>}
              <span title={contact.email ?? undefined}>
                {contact.name}
                {contact.email ? "" : " (no email)"}
              </span>
            </>
          )}
          {(dealName || contact) && (row.last_event_date || awaiting) && <span aria-hidden> · </span>}
          {row.last_event_date ? (
            <span>Last touch {fmtDate(row.last_event_date)}</span>
          ) : awaiting ? (
            <span>Not yet contacted</span>
          ) : null}
        </div>
      </div>

      {/* Quiet status + merged action cluster. */}
      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:inline-flex">
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} aria-hidden />
          {status.label}
        </span>
        <RowActions row={row} logIndex={logIndex} emailReady={emailReady} onCompose={onCompose} onLogged={onLogged} />
      </div>
    </div>
  );
}

// ── Lead row — the queue's own first item, typographically elevated ─────────────
// Not a hero card: the answer to "what first?" is the top of the list itself, set
// like a newspaper lead story. Nothing is duplicated below it.

function LeadRow({
  row,
  dealName,
  dealType,
  logIndex,
  focused,
  clearing,
  emailReady,
  onCompose,
  onLogged,
}: {
  row: ScheduleRow;
  dealName?: string;
  dealType?: MandateType;
  logIndex?: number;
  focused?: boolean;
  clearing?: boolean;
  emailReady?: boolean;
  onCompose?: () => void;
  onLogged?: () => void;
}) {
  const temp = temperatureOf(row);
  const r = railFor(row);
  // Context adds information the due token doesn't already carry: the token shows
  // the day count, so the sub-line only spells urgency out when the token can't
  // ("new", "—"), then who it goes to, deal, and recency.
  const context: string[] = [];
  if (r.num == null) context.push(whyLine(row));
  if (row.primary_contact) {
    context.push(
      row.primary_contact.designation
        ? `${row.primary_contact.name} · ${row.primary_contact.designation}`
        : row.primary_contact.name,
    );
  }
  if (dealName) context.push(dealName);
  if (row.last_event_date) context.push(`Last touch ${fmtDate(row.last_event_date)}`);
  else if (row.schedule_status === "AWAITING_INITIAL") context.push("Not yet contacted");

  return (
    <div
      data-row-index={logIndex}
      className={cn(
        "group flex flex-wrap items-center gap-x-2.5 gap-y-2 py-3.5 pl-3 pr-2 transition-colors duration-150 sm:pr-3",
        ROW_TINT[r.tone],
        focused && "queue-row-focused",
        clearing && "row-clear",
      )}
    >
      <DueToken row={row} size="lg" />
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <Link
            href={`/companies/${row.company_id}`}
            title={row.regarding ?? undefined}
            className="max-w-full truncate rounded text-left text-base font-semibold leading-tight text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring sm:text-lg"
            style={{ ...DISPLAY, letterSpacing: "-0.02em" }}
          >
            {row.company_name}
          </Link>
          <TempChip temp={temp} />
          {dealType && (
            <span className={cn("shrink-0 rounded px-1.5 py-px text-[11px] font-medium", DEAL_TYPE_STYLE[dealType])}>
              {DEAL_TYPE_SHORT[dealType]}
            </span>
          )}
        </div>
        {context.length > 0 && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{context.join(" · ")}</p>
        )}
      </div>
      <div className="ml-auto">
        <RowActions row={row} lead logIndex={logIndex} emailReady={emailReady} onCompose={onCompose} onLogged={onLogged} />
      </div>
    </div>
  );
}

// ── Focus Mode — the room dims, one company at a time, keyboard-driven ──────────

function FocusMode({
  rows,
  deals,
  emailReady,
  onClose,
  onLogged,
}: {
  rows: ScheduleRow[];
  deals: Map<number, { name: string; type: MandateType }>;
  /** Mailbox connected → the primary focus action sends a real email. */
  emailReady?: boolean;
  onClose: () => void;
  onLogged: () => void;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(0);
  // The inner log dialog / compose sheet are CONTROLLED so the keyboard handler
  // knows, reliably, when to stand down (open) vs. own Esc/S (closed).
  const [logOpen, setLogOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const total = rows.length;
  const row = rows[idx];

  const advance = useCallback(() => {
    setIdx((i) => Math.min(rows.length, i + 1));
  }, [rows.length]);

  const skip = useCallback(() => {
    setIdx((i) => Math.min(rows.length, i + 1));
  }, [rows.length]);

  // Keyboard: Esc closes focus mode, S skips — but only while the log dialog and
  // compose sheet are shut (open, they own the keyboard for typing + Esc-to-close).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (logOpen || composeOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        skip();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, skip, logOpen, composeOpen]);

  const complete = idx >= total || !row;

  return (
    <div
      className="focus-scrim fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4"
      onClick={(e) => {
        // Click on the dim backdrop (not the card) exits focus mode.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="focus-card w-full max-w-lg rounded-lg bg-card p-6 shadow-lg ring-1 ring-border sm:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-primary-ink">
            <FocusIcon className="h-3.5 w-3.5" aria-hidden /> Focus mode
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Exit focus mode"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* progress */}
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground transition-[width] duration-300 ease-out"
              style={{ width: `${total ? (Math.min(idx, total) / total) * 100 : 100}%` }}
            />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground" style={MONO}>
            {Math.min(idx + (complete ? 0 : 1), total)} / {total}
          </span>
        </div>

        {complete ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" strokeWidth={1.75} aria-hidden />
            <p className="text-lg font-semibold" style={DISPLAY}>
              Queue cleared.
            </p>
            <p className="text-sm text-muted-foreground">
              You worked through {done} {done === 1 ? "company" : "companies"} in focus. Enjoy the quiet.
            </p>
            <Button className="mt-2" onClick={onClose}>
              Back to the desk
            </Button>
          </div>
        ) : (
          <div key={idx} className="focus-advance">
            <div className="mt-7 flex items-center gap-2">
              <TempChip temp={temperatureOf(row)} size="lg" />
              {(() => {
                const deal = deals.get(row.mandate_id);
                return deal ? (
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[11px] font-medium",
                      DEAL_TYPE_STYLE[deal.type],
                    )}
                  >
                    {DEAL_TYPE_LABEL[deal.type]}
                  </span>
                ) : null;
              })()}
            </div>

            <button
              onClick={() => router.push(`/companies/${row.company_id}`)}
              className="mt-2.5 block max-w-full truncate text-left text-2xl font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              style={{ ...DISPLAY, letterSpacing: "-0.02em" }}
            >
              {row.company_name}
            </button>

            <p className="mt-2 text-sm text-muted-foreground">
              {whyLine(row)}
              {deals.get(row.mandate_id)?.name ? ` · ${deals.get(row.mandate_id)!.name}` : ""}
              {row.last_event_date ? ` · Last touch ${fmtDate(row.last_event_date)}` : ""}
            </p>

            {row.primary_contact && (
              <p className="mt-1 text-xs text-muted-foreground">
                {row.primary_contact.name}
                {row.primary_contact.designation ? ` · ${row.primary_contact.designation}` : ""}
                {row.primary_contact.email ? (
                  <span style={MONO}> · {row.primary_contact.email}</span>
                ) : (
                  " · no email on file"
                )}
              </p>
            )}

            <div className="mt-7 flex items-center gap-2">
              {emailReady ? (
                <>
                  <Button
                    size="lg"
                    className="h-11 flex-1 gap-1.5 text-sm font-medium"
                    onClick={() => setComposeOpen(true)}
                  >
                    <Mail className="h-4 w-4" aria-hidden />
                    {row.schedule_status === "AWAITING_INITIAL" ? "Send intro" : "Send follow-up"}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-11 px-4 text-sm"
                    onClick={() => setLogOpen(true)}
                    title="Log the touch without sending an email"
                  >
                    Log only
                  </Button>
                </>
              ) : (
                <Button
                  size="lg"
                  className="h-11 flex-1 gap-1.5 text-sm font-medium"
                  onClick={() => setLogOpen(true)}
                >
                  {row.schedule_status === "AWAITING_INITIAL" ? "Send intro" : "Log follow-up"}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              )}
              <Button variant="outline" size="lg" className="h-11 px-4 text-sm" onClick={skip} title="Skip (S)">
                Skip
              </Button>
              <LogOutreachDialog
                key={row.company_id}
                companyId={row.company_id}
                companyName={row.company_name}
                defaultEventType={row.schedule_status === "AWAITING_INITIAL" ? "INITIAL_EMAIL" : "FOLLOW_UP"}
                open={logOpen}
                onOpenChange={setLogOpen}
                onLogged={() => {
                  setLogOpen(false);
                  setDone((d) => d + 1);
                  onLogged();
                  advance();
                }}
                trigger={null}
              />
              {composeOpen && (
                <ComposeEmailSheet
                  key={`c-${row.company_id}`}
                  row={row}
                  dealName={deals.get(row.mandate_id)?.name}
                  dealType={deals.get(row.mandate_id)?.type}
                  open={composeOpen}
                  onOpenChange={setComposeOpen}
                  onSent={() => {
                    setDone((d) => d + 1);
                    onLogged();
                    advance();
                  }}
                />
              )}
            </div>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              <kbd className="rounded border bg-muted px-1 tabular-nums">S</kbd> skip ·{" "}
              <kbd className="rounded border bg-muted px-1 tabular-nums">Esc</kbd> exit
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sender chip — the connected mailbox as a quiet instrument in the tools row ──

function SenderChip() {
  const { data: account } = useEmailAccount();
  const disconnect = useDisconnectEmail();
  const confirm = useConfirm();
  const [connectOpen, setConnectOpen] = useState(false);

  if (!account) return null;

  if (!account.connected) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs"
          onClick={() => setConnectOpen(true)}
          title="Connect Gmail or Outlook — send real emails from the desk"
        >
          <Mail className="h-3.5 w-3.5" aria-hidden /> Connect email
        </Button>
        <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Send from your own mailbox</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              Write, send, and log outreach in one step — every email goes out from your
              real account.
            </p>
            <EmailConnectPanel onConnected={() => setConnectOpen(false)} />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const glyph =
    account.provider === "GOOGLE" ? (
      <GmailGlyph className="h-3.5 w-3.5" />
    ) : account.provider === "MICROSOFT" ? (
      <OutlookGlyph className="h-3.5 w-3.5" />
    ) : (
      <FlaskConical className="h-3.5 w-3.5 text-foreground" aria-hidden />
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-9 max-w-56 gap-1.5 text-xs font-normal"
            title={`Sending as ${account.email_address} · ${account.sends_today}/${account.daily_send_limit} today`}
          />
        }
      >
        {glyph}
        <span className="hidden truncate sm:inline">{account.email_address}</span>
        <span className="tabular-nums text-muted-foreground" style={MONO}>
          {account.sends_today}/{account.daily_send_limit}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{account.email_address}</p>
          <p className="text-xs text-muted-foreground">
            {account.provider === "SANDBOX"
              ? "Sandbox — sends are simulated"
              : account.provider === "GOOGLE"
                ? "Gmail · sends from your mailbox"
                : "Outlook · sends from your mailbox"}
            {" · "}
            <span className="tabular-nums">
              {account.sends_today}/{account.daily_send_limit}
            </span>{" "}
            today
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<Link href="/settings" />}
        >
          <Settings2 className="h-4 w-4 text-muted-foreground" aria-hidden /> Signature & limits
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
                    const ok = await confirm({
              title: "Disconnect this mailbox?",
              description:
                "Sending returns to log-only — you keep logging touches by hand until a mailbox is reconnected. Nothing already sent or logged is affected.",
              confirmLabel: "Disconnect",
              tone: "destructive",
            });
            if (!ok) return;
            disconnect.mutate(undefined, {
              onSuccess: () => toast.success("Mailbox disconnected"),
            });
          }}
        >
          <Unplug className="h-4 w-4 text-muted-foreground" aria-hidden /> Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Section metadata — honest bands, no artificial splits ───────────────────────

type SectionKey = "overdue" | "today" | "upcoming";

const SECTION: Record<SectionKey, { label: string; sub?: string; dot: string; tone: string }> = {
  overdue: { label: "Overdue", dot: "bg-destructive", tone: "text-destructive-ink" },
  today: { label: "Due today", sub: "clear these next", dot: "bg-primary", tone: "text-primary-ink" },
  upcoming: { label: "Coming up", dot: "bg-ink-400", tone: "text-muted-foreground" },
};

// ── URL-persisted desk state (P2 DataTable pattern, desk idiom) ─────────────────
// The horizon segment mixes string bands and numeric day-offsets (1–6), so it needs
// a custom codec; search + sort reuse the shared ones. The mandate stays on its
// existing ?deal deep-link. Foreign params are preserved on every write.
const segParam: ParamCodec<Seg> = {
  fallback: "all",
  decode: (raw) => {
    if (raw === "late" || raw === "today" || raw === "new") return raw;
    const n = Number(raw);
    return n >= 1 && n <= 6 ? n : "all";
  },
  encode: (v) => (v === "all" ? null : String(v)),
};

const SCHEDULE_SPEC = {
  seg: segParam,
  q: stringParam(""),
  sort: enumParam(["urgency", "name", "deal"] as const, "urgency"),
} satisfies ParamSpec;

/** Seed the desk's scope/search/sort from the URL (client only, SSR-safe). */
function bootSchedule(): { seg: Seg; q: string; sort: QueueSort } {
  if (typeof window === "undefined") return { seg: "all", q: "", sort: "urgency" };
  const s = decodeState(SCHEDULE_SPEC, window.location.search);
  return { seg: s.seg, q: s.q, sort: s.sort };
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [seg, setSeg] = useState<Seg>(() => bootSchedule().seg);
  // Deep link from a deal room's "Work queue →" (?deal=N) scopes to that engagement.
  const [mandateId, setMandateId] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number(new URLSearchParams(window.location.search).get("deal")) || 0;
  });
  const [searchInput, setSearchInput] = useState(() => bootSchedule().q);
  const [q, setQ] = useState(() => bootSchedule().q);
  const [sort, setSort] = useState<QueueSort>(() => bootSchedule().sort);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [focusIdx, setFocusIdx] = useState(-1);
  const [logged, setLogged] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [clearing, setClearing] = useState<Set<number>>(new Set());
  const [compose, setCompose] = useState<ScheduleRow | null>(null);
  const loggedRef = useRef<HTMLSpanElement>(null);

  const { data: emailAccount } = useEmailAccount();
  const emailReady = !!emailAccount?.connected;

  // Debounce search into the query param.
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Mirror scope/search/sort into the URL — shareable + reload-stable — while
  // preserving foreign params (?deal, the OAuth landing flags).
  useEffect(() => {
    const qs = encodeQuery(SCHEDULE_SPEC, { seg, q, sort }, window.location.search);
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [seg, q, sort]);

  // OAuth landing — the provider redirected back here with a status flag.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const ok = sp.get("email_connected");
    const err = sp.get("email_error");
    if (ok) {
      toast.success(
        ok === "google"
          ? "Gmail connected — sends now come from your mailbox"
          : "Outlook connected — sends now come from your mailbox",
      );
    }
    if (err) toast.error(`Email connection failed: ${err}`);
    if (ok || err) {
      sp.delete("email_connected");
      sp.delete("email_error");
      const qs = sp.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  const { data: mandates } = useMandates();
  const deals = useMemo(() => {
    const m = new Map<number, { name: string; type: MandateType }>();
    for (const d of mandates?.items ?? []) m.set(d.id, { name: d.client_name || d.name, type: d.type });
    return m;
  }, [mandates]);

  // The horizon segment maps onto the server's band/day vocabulary.
  const band: QueueBand = seg === "late" ? "overdue" : seg === "today" ? "today" : "all";
  const dayOffset = typeof seg === "number" ? seg : null;

  const queue = useDueQueue({
    window: 7,
    mandateId: mandateId || undefined,
    q: q || undefined,
    band,
    dayOffset,
    sort,
  });
  const needs = useNeedsInitialQueue({ mandateId: mandateId || undefined, q: q || undefined });
  const { data: stats } = useScheduleStats();
  const bulkLog = useBulkLogEvents();

  const firstPage = queue.data?.pages[0];
  const counts = firstPage?.counts;
  const byDay = firstPage?.by_day ?? [];
  const dueItems = useMemo(() => queue.data?.pages.flatMap((p) => p.items) ?? [], [queue.data]);
  const dueTotal = firstPage?.total ?? 0;

  const needsItems = useMemo(() => needs.data?.pages.flatMap((p) => p.items) ?? [], [needs.data]);
  const needsTotal = needs.data?.pages[0]?.total ?? 0;

  const showDue = seg !== "new";
  const showNeeds = seg === "all" || seg === "new";
  const grouped = sort === "urgency" && seg === "all";

  const overdueCount = counts?.overdue ?? 0;
  const dueTodayCount = counts?.due_today ?? 0;
  const actionable = overdueCount + dueTodayCount + needsTotal;

  // Progress psychology — the desk fills up as you clear it.
  const clearedDenom = logged + actionable;
  const progressPct = clearedDenom > 0 ? Math.round((logged / clearedDenom) * 100) : 100;
  const estMinutes = Math.max(1, Math.round(actionable * 0.5));

  // The actionable backlog ranked by the honest priority heuristic — the first item
  // is the lead row, and the same order drives Focus Mode. Overdue + today + first-touch.
  const focusRows = useMemo(() => {
    const rows = [
      ...dueItems.filter((r) => (r.days_remaining ?? 99) <= 0),
      ...(showNeeds ? needsItems : []),
    ];
    return rows.sort((a, b) => priorityScore(b) - priorityScore(a));
  }, [dueItems, needsItems, showNeeds]);

  // The lead shows only on the unscoped, urgency-ordered desk: once the analyst
  // narrows (a segment, a search, another sort), they've chosen their own path.
  const lead = seg === "all" && !q && sort === "urgency" && !queue.isLoading ? (focusRows[0] ?? null) : null;
  const leadFromNeeds = lead?.schedule_status === "AWAITING_INITIAL";
  const leadBand: SectionKey | null = lead && !leadFromNeeds ? bandOf(lead.days_remaining) : null;

  // Nothing repeats: the lead is removed from the lanes below it.
  const visibleDue = useMemo(
    () => (lead && !leadFromNeeds ? dueItems.filter((r) => r.company_id !== lead.company_id) : dueItems),
    [dueItems, lead, leadFromNeeds],
  );
  const visibleNeeds = useMemo(
    () => (lead && leadFromNeeds ? needsItems.filter((r) => r.company_id !== lead.company_id) : needsItems),
    [needsItems, lead, leadFromNeeds],
  );

  // Consecutive band grouping over the urgency-sorted list (the server sorts by
  // urgency, so bands arrive contiguous) — sections encode real bands, nothing else.
  const dueSections = useMemo(() => {
    if (!grouped) return null;
    const out: { key: SectionKey; rows: ScheduleRow[] }[] = [];
    for (const row of visibleDue) {
      const b = bandOf(row.days_remaining);
      const last = out[out.length - 1];
      if (last && last.key === b) last.rows.push(row);
      else out.push({ key: b, rows: [row] });
    }
    return out;
  }, [grouped, visibleDue]);

  // Keyboard-navigable rows in exact render order: lead → due lanes → needs lane.
  const navRows = useMemo(
    () => [
      ...(lead ? [lead] : []),
      ...(showDue ? visibleDue : []),
      ...(showNeeds ? visibleNeeds : []),
    ],
    [lead, showDue, visibleDue, showNeeds, visibleNeeds],
  );
  const needsNavStart = (lead ? 1 : 0) + (showDue ? visibleDue.length : 0);

  // Overdue vitals for the section header (from the loaded page).
  const overdueLoaded = useMemo(() => visibleDue.filter((r) => (r.days_remaining ?? 0) < 0), [visibleDue]);
  const overdueOldest = overdueLoaded.reduce((m, r) => Math.max(m, Math.abs(r.days_remaining ?? 0)), 0);
  const overdueAvg = overdueLoaded.length
    ? Math.round(overdueLoaded.reduce((s, r) => s + Math.abs(r.days_remaining ?? 0), 0) / overdueLoaded.length)
    : 0;
  const overdueSub = overdueLoaded.length ? `oldest ${overdueOldest}d · avg ${overdueAvg}d` : undefined;

  const bump = () => {
    setLogged((n) => n + 1);
    loggedRef.current?.classList.remove("count-pop");
    void loggedRef.current?.offsetWidth;
    loggedRef.current?.classList.add("count-pop");
  };

  // A logged row collapses out of the queue (satisfying) before the refetch drops it.
  const clearRow = useCallback((companyId: number) => {
    setClearing((prev) => new Set(prev).add(companyId));
    window.setTimeout(() => {
      setClearing((prev) => {
        const next = new Set(prev);
        next.delete(companyId);
        return next;
      });
    }, 600);
  }, []);

  const loggedFor = (companyId: number) => {
    bump();
    clearRow(companyId);
  };

  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Select every loaded row of a due section (or clear them if all are in). */
  const toggleSelectSection = (rows: ScheduleRow[]) =>
    setSelected((prev) => {
      const ids = rows.map((r) => r.company_id);
      const all = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of ids) {
        if (all) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  const chooseSeg = (s: Seg) => {
    setSeg((cur) => (cur === s ? "all" : s));
    setFocusIdx(-1);
  };

  // Keyboard: j/k move, l/Enter log, x select, f focus-mode, Esc clear, ? help.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Focus Mode is a modal flow — it owns the keyboard while open.
      if (focusMode) return;
      const t = e.target as HTMLElement | null;
      if (e.key === "Escape") {
        setSelected(new Set());
        return;
      }
      const typing =
        t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (typing || document.querySelector('[role="dialog"]')) return;
      if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }
      if (e.key === "f") {
        if (focusRows.length > 0) {
          e.preventDefault();
          setFocusMode(true);
        }
        return;
      }
      const n = navRows.length;
      if (n === 0) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx((i) => Math.min(n - 1, i + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx((i) => (i < 0 ? 0 : Math.max(0, i - 1)));
      } else if (e.key === "l" || e.key === "Enter") {
        e.preventDefault();
        (document.querySelector(`[data-log-index="${focusIdx}"]`) as HTMLElement | null)?.click();
      } else if (e.key === "x") {
        e.preventDefault();
        const row = navRows[focusIdx];
        // Only due rows are bulk-selectable (a bulk touch is always a FOLLOW_UP), and
        // the lead row carries no checkbox — selecting it invisibly would confuse.
        if (row && row !== lead && row.schedule_status !== "AWAITING_INITIAL") toggleSelect(row.company_id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navRows, focusIdx, focusRows.length, focusMode, lead]);

  useEffect(() => {
    if (focusIdx < 0) return;
    (document.querySelector(`[data-row-index="${focusIdx}"]`) as HTMLElement | null)?.scrollIntoView({
      block: "nearest",
    });
  }, [focusIdx]);

  const bulkClear = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const res = await bulkLog.mutateAsync(
      ids.map((companyId) => ({
        companyId,
        payload: { event_type: "FOLLOW_UP", occurred_on: today },
      })),
    );
    const cleared = res.total - res.failed;
    setLogged((n) => n + cleared);
    setSelected(new Set());
    setFocusIdx(-1);
    const { toast } = await import("sonner");
    if (res.failed > 0) toast.warning(`Logged ${cleared}, ${res.failed} failed`);
    else toast.success(`Logged follow-ups for ${cleared} ${cleared === 1 ? "company" : "companies"}`);
  };

  // Horizon rail numbers — full-set truths from the server, independent of paging.
  const dayCount = (o: number) => byDay.find((b) => b.offset === o)?.count ?? 0;
  const railDays = Array.from({ length: 6 }, (_, i) => ({ offset: i + 1, count: dayCount(i + 1) }));
  const railTotal = counts ? counts.overdue + counts.due_today + counts.upcoming + needsTotal : null;

  // Empty-state routing.
  const dueEmpty = visibleDue.length === 0 && !lead;
  const needsEmpty = visibleNeeds.length === 0 && !(lead && leadFromNeeds);
  const nothing = seg === "new" ? needsEmpty : showNeeds ? dueEmpty && needsEmpty : dueEmpty;
  const scoped = seg !== "all";
  const loadError = showDue ? queue.isError : needs.isError;

  // Section header count reflects exactly the set listed under it. Under a search
  // the full-band totals no longer describe the filtered list, so fall back to
  // what's actually loaded rather than mislead.
  const sectionCount = (key: SectionKey, loadedLen: number): number => {
    if (q) return loadedLen;
    const fullBand = key === "overdue" ? overdueCount : key === "today" ? dueTodayCount : counts?.upcoming ?? loadedLen;
    return Math.max(loadedLen, fullBand - (leadBand === key ? 1 : 0));
  };

  // Scoped single-header metadata (one honest header when the rail narrows the queue).
  const scopedHeader = (() => {
    if (seg === "late") return { ...SECTION.overdue, sub: overdueSub, count: overdueCount };
    if (seg === "today") return { ...SECTION.today, count: dueTodayCount };
    if (typeof seg === "number") {
      const d = dayFromOffset(seg);
      return { label: `${d.weekday} ${d.day} ${d.month}`, sub: "scheduled that day", dot: "bg-ink-400", tone: "text-muted-foreground", count: dayCount(seg) };
    }
    return null;
  })();

  let nav = lead ? 1 : 0; // running keyboard index across every rendered lane

  return (
    <div className="flex flex-col gap-4">
      {/* ── Command line — load, momentum, tools: one stratum, no scenery ── */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className={PAGE_TITLE} style={PAGE_TITLE_STYLE}>
            Outreach desk
          </h1>

          {/* Progress module — today's outreach, at a calm glance. */}
          <div className="mt-2 w-full max-w-md sm:w-[26rem]" aria-live="polite">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-xs font-medium text-muted-foreground">
                Today&rsquo;s outreach
              </span>
              {actionable === 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  {logged > 0 ? `Cleared — ${logged} done` : "All clear"}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  <span ref={loggedRef} className="font-semibold tabular-nums text-foreground">
                    {logged}
                  </span>
                  <span className="tabular-nums"> / {clearedDenom}</span> done ·{" "}
                  <span className="tabular-nums">~{estMinutes} min left</span>
                </span>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-2.5">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/50 transition-[width] duration-500 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {logged >= 3 && actionable > 0 && (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-foreground">
                  <Flame className="h-3.5 w-3.5" aria-hidden />
                  {logged}
                </span>
              )}
            </div>
          </div>

          {stats && (
            <p className="mt-2 text-xs text-muted-foreground">
              This week · <span className="font-medium tabular-nums text-foreground">{stats.sent_this_week}</span> sent ·{" "}
              <span className="font-medium tabular-nums text-foreground">{stats.responses_this_week}</span>{" "}
              {stats.responses_this_week === 1 ? "reply" : "replies"} ·{" "}
              <span className="font-medium tabular-nums text-primary-ink">{Math.round(stats.response_rate * 100)}%</span> rate
            </p>
          )}
        </div>

        {/* Tools — search & narrowing are peers of the work, not heroes above it. */}
        <div className="flex flex-wrap items-center gap-2">
          <SenderChip />
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              autoComplete="off"
              spellCheck={false}
              aria-label="Search companies"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search…"
              className="h-9 w-36 pl-8 transition-[width] focus:w-56 sm:w-40"
            />
          </div>
          <select
            value={mandateId}
            onChange={(e) => setMandateId(Number(e.target.value))}
            className={SELECT_CLS}
            aria-label="Filter by deal"
          >
            <option value={0}>All deals</option>
            {mandates?.items.map((m) => (
              <option key={m.id} value={m.id}>
                {m.client_name || m.name}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as QueueSort)}
            className={SELECT_CLS}
            aria-label="Sort"
          >
            <option value="urgency">Sort: Urgency</option>
            <option value="name">Sort: Name</option>
            <option value="deal">Sort: Deal</option>
          </select>
          {focusRows.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs"
              onClick={() => setFocusMode(true)}
              title="Focus mode — clear the queue one company at a time (F)"
            >
              <FocusIcon className="h-3.5 w-3.5" aria-hidden /> Focus
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
            aria-label="Keyboard shortcuts (?)"
            title="Keyboard shortcuts (?)"
            onClick={() => setShowShortcuts(true)}
          >
            <Keyboard className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      {/* ── Horizon rail — workload, distribution, and scope in one instrument ── */}
      <HorizonRail
        total={railTotal}
        late={counts ? overdueCount : null}
        today={counts ? dueTodayCount : null}
        days={railDays}
        fresh={needs.data ? needsTotal : null}
        seg={seg}
        onSeg={chooseSeg}
      />

      {/* ── The queue ── */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {loadError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <AlertTriangle className="h-5 w-5 text-foreground" aria-hidden />
            <p className="text-sm font-medium">Couldn&rsquo;t load the queue.</p>
            <button
              onClick={() => {
                queue.refetch();
                needs.refetch();
              }}
              className="text-xs font-medium text-primary-ink hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (showDue ? queue.isLoading && dueItems.length === 0 : needs.isLoading && needsItems.length === 0) ? (
          <div className="p-4">
            <TableSkeleton cols={2} rows={7} />
          </div>
        ) : nothing ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            {q ? (
              <>
                <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">No companies match &ldquo;{q}&rdquo;.</p>
                <button onClick={() => setSearchInput("")} className="text-xs text-primary-ink hover:underline">
                  Clear search
                </button>
              </>
            ) : typeof seg === "number" ? (
              <>
                <CheckCircle2 className="h-8 w-8 text-foreground" aria-hidden />
                <p className="text-sm font-medium">
                  You&rsquo;re clear for {dayFromOffset(seg).weekday} {dayFromOffset(seg).day}.
                </p>
                {overdueCount > 0 ? (
                  <button
                    onClick={() => setSeg("late")}
                    className="text-xs font-medium text-primary-ink hover:underline"
                  >
                    Get ahead — work the late queue →
                  </button>
                ) : (
                  <p className="text-xs text-muted-foreground">Nothing scheduled that day.</p>
                )}
              </>
            ) : scoped ? (
              <>
                <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">
                  {seg === "late"
                    ? "Nothing overdue."
                    : seg === "today"
                      ? "Nothing due today."
                      : "No companies waiting on a first email."}
                </p>
                <button onClick={() => setSeg("all")} className="text-xs text-primary-ink hover:underline">
                  Show the full queue
                </button>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-8 w-8 text-foreground" aria-hidden />
                <p className="text-sm font-medium">Desk clear.</p>
                <p className="text-xs text-muted-foreground">No outreach due in the next 7 days.</p>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Lead — the desk's one answer to "what first?", set like a lead story. */}
            {lead && (
              <>
                <SectionHeader
                  dot="bg-primary"
                  tone="text-foreground"
                  label="Now"
                  sub="your highest priority"
                  icon={<Flame className="h-3.5 w-3.5 text-primary-ink" aria-hidden />}
                />
                <LeadRow
                  row={lead}
                  dealName={deals.get(lead.mandate_id)?.name}
                  dealType={deals.get(lead.mandate_id)?.type}
                  logIndex={0}
                  focused={focusIdx === 0}
                  clearing={clearing.has(lead.company_id)}
                  emailReady={emailReady}
                  onCompose={() => setCompose(lead)}
                  onLogged={() => loggedFor(lead.company_id)}
                />
              </>
            )}

            {/* Scoped single header — the rail narrowed the queue to one honest slice. */}
            {showDue && scopedHeader && visibleDue.length > 0 && (
              <SectionHeader
                dot={scopedHeader.dot}
                tone={scopedHeader.tone}
                label={scopedHeader.label}
                sub={scopedHeader.sub}
                count={scopedHeader.count}
                onSelectAll={() => toggleSelectSection(visibleDue)}
                allSelected={visibleDue.every((r) => selected.has(r.company_id))}
              />
            )}

            {/* Due lanes */}
            {showDue &&
              (dueSections ?? [{ key: null as SectionKey | null, rows: visibleDue }]).map((section, si) => (
                <Fragment key={section.key ?? `flat-${si}`}>
                  {section.key && (
                    <SectionHeader
                      dot={SECTION[section.key].dot}
                      tone={SECTION[section.key].tone}
                      label={SECTION[section.key].label}
                      sub={section.key === "overdue" ? overdueSub : SECTION[section.key].sub}
                      count={sectionCount(section.key, section.rows.length)}
                      onSelectAll={() => toggleSelectSection(section.rows)}
                      allSelected={section.rows.every((r) => selected.has(r.company_id))}
                    />
                  )}
                  {section.rows.map((row, i) => {
                    const deal = deals.get(row.mandate_id);
                    const idx = nav++;
                    return (
                      <QueueRow
                        key={row.company_id}
                        row={row}
                        dealName={deal?.name}
                        dealType={deal?.type}
                        logIndex={idx}
                        index={i}
                        focused={focusIdx === idx}
                        clearing={clearing.has(row.company_id)}
                        selectable
                        selected={selected.has(row.company_id)}
                        anySelected={selected.size > 0}
                        emailReady={emailReady}
                        onCompose={() => setCompose(row)}
                        onToggleSelect={() => toggleSelect(row.company_id)}
                        onLogged={() => loggedFor(row.company_id)}
                      />
                    );
                  })}
                </Fragment>
              ))}
            {showDue && queue.hasNextPage && (
              <div className="p-3 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => queue.fetchNextPage()}
                  disabled={queue.isFetchingNextPage}
                  className="text-xs"
                >
                  {queue.isFetchingNextPage ? "Loading…" : `Load more (${dueItems.length} of ${dueTotal})`}
                </Button>
              </div>
            )}

            {/* Not-yet-started lane */}
            {showNeeds && visibleNeeds.length > 0 && (
              <>
                <SectionHeader
                  dot="bg-card ring-1 ring-inset ring-foreground"
                  tone="text-foreground"
                  label="Ready to introduce"
                  sub="first outreach — clock hasn't started"
                  count={Math.max(visibleNeeds.length, needsTotal - (leadFromNeeds ? 1 : 0))}
                />
                {visibleNeeds.map((row, i) => {
                  const deal = deals.get(row.mandate_id);
                  const idx = needsNavStart + i;
                  return (
                    <QueueRow
                      key={`n-${row.company_id}`}
                      row={row}
                      dealName={deal?.name}
                      dealType={deal?.type}
                      logIndex={idx}
                      index={i}
                      focused={focusIdx === idx}
                      clearing={clearing.has(row.company_id)}
                      emailReady={emailReady}
                      onCompose={() => setCompose(row)}
                      onLogged={() => loggedFor(row.company_id)}
                    />
                  );
                })}
                {needs.hasNextPage && (
                  <div className="p-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => needs.fetchNextPage()}
                      disabled={needs.isFetchingNextPage}
                      className="text-xs"
                    >
                      {needs.isFetchingNextPage ? "Loading…" : `Load more (${needsItems.length} of ${needsTotal})`}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Shortcut hint — one quiet line under the work, not chrome above it. */}
      <p className="hidden text-center text-[11px] text-muted-foreground lg:block">
        <kbd className="rounded border bg-muted px-1 tabular-nums">j</kbd>/<kbd className="rounded border bg-muted px-1 tabular-nums">k</kbd> move ·{" "}
        <kbd className="rounded border bg-muted px-1 tabular-nums">l</kbd> log ·{" "}
        <kbd className="rounded border bg-muted px-1 tabular-nums">x</kbd> select ·{" "}
        <kbd className="rounded border bg-muted px-1 tabular-nums">f</kbd> focus ·{" "}
        <kbd className="rounded border bg-muted px-1 tabular-nums">?</kbd> all shortcuts
      </p>

      {/* ── Bulk action bar ── */}
      {selected.size > 0 && (
        <div className="bar-rise fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border-strong bg-card px-4 py-2 shadow-lg shadow-primary/5">
          <span className="text-sm font-medium tabular-nums">{selected.size} selected</span>
          <Button size="sm" className="h-7 text-xs" onClick={bulkClear} disabled={bulkLog.isPending}>
            {bulkLog.isPending ? "Logging…" : "Log follow-up for all"}
          </Button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {/* ── Focus Mode overlay ── */}
      {focusMode && focusRows.length > 0 && (
        <FocusMode
          rows={focusRows}
          deals={deals}
          emailReady={emailReady}
          onClose={() => setFocusMode(false)}
          onLogged={bump}
        />
      )}

      {/* ── Compose sheet (queue + lead rows; Focus Mode mounts its own) ── */}
      {compose && (
        <ComposeEmailSheet
          key={compose.company_id}
          row={compose}
          dealName={deals.get(compose.mandate_id)?.name}
          dealType={deals.get(compose.mandate_id)?.type}
          open
          onOpenChange={(o) => {
            if (!o) setCompose(null);
          }}
          onSent={() => loggedFor(compose.company_id)}
        />
      )}

      {/* ── Keyboard shortcuts overlay ── */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
          </DialogHeader>
          <dl className="mt-1 space-y-2 text-sm">
            {[
              ["j / ↓", "Move down the queue"],
              ["k / ↑", "Move up the queue"],
              ["L / Enter", "Email or log the focused row"],
              ["x", "Select / deselect the focused row"],
              ["f", "Enter focus mode"],
              ["Esc", "Clear selection"],
              ["?", "Show this help"],
            ].map(([keys, desc]) => (
              <div key={keys} className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{desc}</span>
                <kbd className="shrink-0 rounded border bg-muted px-1.5 py-0.5 tabular-nums text-xs">{keys}</kbd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  );
}
