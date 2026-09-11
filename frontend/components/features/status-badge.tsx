import { CHIP, CHIP_TONE, STATUS_META, type ChipTone } from "@/lib/design";
import { cn } from "@/lib/utils";
import type { CompanyStatus } from "@/types";

/**
 * The status chip: the status glyph and its name on one neutral chip. The glyph is the
 * same one every register draws beside a row (fill = progress, colour = kind), so a chip
 * and a row can never disagree. The chip itself stays neutral; the glyph carries state.
 */
export function StatusBadge({
  status,
  className,
}: {
  status: CompanyStatus;
  className?: string;
}) {
  const meta = STATUS_META[status] ?? STATUS_META.NOT_CONTACTED;
  return (
    <span
      className={cn(
        CHIP,
        CHIP_TONE.outline,
        "gap-1.5",
        status === "NOT_CONTACTED" && "text-muted-foreground",
        status === "BOUNCED" && "text-danger-ink",
        className,
      )}
    >
      <span className={meta.dot} aria-hidden />
      {meta.label}
    </span>
  );
}

export type CadenceState =
  | "needs_initial"
  | "overdue"
  | "due_soon"
  | "upcoming"
  | "stopped";

/**
 * Cadence, in the product's state colours: overdue is red, due soon amber, a first
 * outreach not yet sent is a dashed outline (nothing has started), and a quiet or
 * stopped cadence recedes onto a grey chip.
 */
const CADENCE_CONFIG: Record<CadenceState, { label: string; tone: ChipTone; extra?: string }> = {
  needs_initial: { label: "Needs first outreach", tone: "outline", extra: "ring-0 border border-dashed border-border-strong" },
  overdue: { label: "Overdue", tone: "danger" },
  due_soon: { label: "Due soon", tone: "warning" },
  upcoming: { label: "Upcoming", tone: "neutral" },
  stopped: { label: "Stopped", tone: "neutral", extra: "text-muted-foreground" },
};

export function CadenceBadge({
  state,
  label,
  className,
}: {
  state: CadenceState;
  label?: string;
  className?: string;
}) {
  const cfg = CADENCE_CONFIG[state];
  return (
    <span className={cn(CHIP, CHIP_TONE[cfg.tone], cfg.extra, className)}>
      {label ?? cfg.label}
    </span>
  );
}

export function cadenceStateFromSchedule(args: {
  scheduleStatus: "AWAITING_INITIAL" | "ACTIVE" | "STOPPED";
  daysRemaining: number | null;
  window?: number;
}): CadenceState {
  const { scheduleStatus, daysRemaining, window = 7 } = args;
  if (scheduleStatus === "AWAITING_INITIAL") return "needs_initial";
  if (scheduleStatus === "STOPPED") return "stopped";
  if (daysRemaining === null) return "upcoming";
  if (daysRemaining < 0) return "overdue";
  if (daysRemaining <= window) return "due_soon";
  return "upcoming";
}
