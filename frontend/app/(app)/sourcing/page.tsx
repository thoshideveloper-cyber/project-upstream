"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Database,
  Download,
  History,
  Import,
  LineChart,
  Loader2,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CandidateRow } from "@/components/features/candidate-card";
import { DatabaseLens } from "@/components/features/database-lens";
import { PushToDialog } from "@/components/features/push-to-dialog";
import { SourcingKanban } from "@/components/features/sourcing-kanban";
import { api } from "@/lib/api";
import { useMandates } from "@/hooks/use-mandates";
import { useCategories } from "@/hooks/use-categories";
import {
  usePool,
  useAddCandidate,
  useBulkAddCandidates,
  buildPoolQS,
  UNCLASSIFIED_SECTOR,
  type PoolFilters,
  type PoolSegment,
  type RevBand,
} from "@/hooks/use-candidates";
import { useSourcingFacets } from "@/hooks/use-sourcing-facets";
import { useSourcingStages, useChangeCandidateStage } from "@/hooks/use-sourcing-stages";
import { useCreateSavedSearch, useDeleteSavedSearch, useSavedSearches } from "@/hooks/use-saved-searches";
import { useScoreCandidates, useScoreFeedback } from "@/hooks/use-scores";
import { useFunnelAnalytics } from "@/hooks/use-funnel-analytics";
import { useAuth } from "@/hooks/use-auth";
import { dealLabel, ENGAGEMENT_TYPE_LABEL, ENGAGEMENT_SIDE_HINT } from "@/lib/labels";
import {
  DEAL_TYPE_STYLE,
  DISPLAY,
  LABEL,
  MONO,
  PAGE_TITLE,
  PAGE_TITLE_STYLE,
  SEGMENT_META,
  SELECT_CLS,
} from "@/lib/design";
import { cn } from "@/lib/utils";
import type { MandateListItem, SourcingPoolItem, SourcingPoolResponse } from "@/types";

const PAGE_SIZE = 25;
const SCORE_CAP = 200; // server page cap — "Score matches" scores at most this many
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Criteria {
  q: string;
  hq: string;
  categoryId: number;
  /** Profile-level side of the market. Supersedes the placement-derived `type`. */
  segment: PoolSegment | "";
  sector: string;
  band: RevBand | "";
  revMin: string; // legacy saved-search passthrough — no dedicated input
  headcountMin: string;
  warmOnly: boolean;
  hasScore: boolean;
  sort: PoolFilters["sort"];
}
const EMPTY_CRITERIA: Criteria = {
  q: "",
  hq: "",
  categoryId: 0,
  segment: "",
  sector: "",
  band: "",
  revMin: "",
  headcountMin: "",
  warmOnly: false,
  hasScore: false,
  sort: "score",
};

// The left rail (components/features/database-lens.tsx) reads the firm database back to
// the analyst: its size, its shape by side of the market, sector and city mix, and how
// much of it is actually filled in — each row also being the filter it describes.
// Discovery starts by seeing what the firm already owns, not by typing into a blank box.
// The Outreach desk's rail reads TIME, the Master List's tape reads STATE; this reads the
// DATABASE.

// ── Engagement switch — the deal-context anchor in the command line ─────────────
// Fit scores, warm history, and pushes are all computed against this engagement;
// it reads as the page title so the context is never in doubt.

/**
 * The command line when there is no engagement yet.
 *
 * The pool is the firm's own company database — it is worth searching on day one, before
 * a single deal exists, which is why this screen no longer refuses to open. It says what
 * a deal would add rather than pretending there is nothing here.
 */
function DatabaseModeHeader({ total, isPartner }: { total?: number; isPartner: boolean }) {
  return (
    <div className="min-w-0">
      <h1 className={PAGE_TITLE} style={PAGE_TITLE_STYLE}>
        Company database
      </h1>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span data-testid="database-mode-note">
          {total != null
            ? `${total.toLocaleString("en-IN")} companies on file · no deal open`
            : "No deal open"}
        </span>
        <span aria-hidden>·</span>
        {isPartner ? (
          <span>
            <Link href="/projects" className="font-medium text-primary-ink hover:underline">
              Open a deal
            </Link>{" "}
            to score these against its thesis
          </span>
        ) : (
          <span>ask a partner to assign you a deal to score and push from here</span>
        )}
      </p>
    </div>
  );
}

function EngagementSwitch({
  mandates,
  current,
  onSelect,
}: {
  mandates: MandateListItem[];
  current: MandateListItem | undefined;
  onSelect: (id: number) => void;
}) {
  const label = current ? dealLabel(current.client_name, current.name) : { primary: "—", secondary: "" };
  return (
    // grow + a real flex-basis: the name takes the row's slack instead of
    // collapsing to its siblings' intrinsic width (which ellipsised it).
    <div className="min-w-0 grow basis-72">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Sourcing for</span>
        {current && (
          <span className={cn("rounded px-1.5 py-px text-[11px] font-medium", DEAL_TYPE_STYLE[current.type])}>
            {ENGAGEMENT_TYPE_LABEL[current.type]}
          </span>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="group -ml-1 mt-0.5 flex max-w-full items-center gap-2 rounded-lg px-1 py-0.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Change engagement"
        >
          <span
            className="min-w-0 truncate text-xl font-semibold tracking-tight sm:text-2xl"
            style={{ ...DISPLAY, letterSpacing: "-0.4px" }}
          >
            {label.primary}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[340px]" align="start">
          {mandates.map((m) => {
            const l = dealLabel(m.client_name, m.name);
            const active = m.id === current?.id;
            return (
              <DropdownMenuItem key={m.id} onClick={() => onSelect(m.id)} className="flex items-start gap-2 py-2">
                <Check className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-primary-ink" : "opacity-0")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{l.primary}</span>
                    <span className={cn("shrink-0 rounded px-1.5 py-px text-[10px] font-medium", DEAL_TYPE_STYLE[m.type])}>
                      {ENGAGEMENT_TYPE_LABEL[m.type]}
                    </span>
                  </span>
                  {l.secondary && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{l.secondary}</span>}
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <p className="mt-0.5 truncate text-sm text-muted-foreground">
        {label.secondary && <span className="text-secondary-foreground">{label.secondary}</span>}
        {label.secondary && current && " · "}
        {current && <span>{ENGAGEMENT_SIDE_HINT[current.type]}</span>}
      </p>
    </div>
  );
}

/**
 * Side of the market as a segmented control, not a select.
 *
 * Three values, each one of the highest-traffic narrowings on the page, and each carrying
 * a count worth seeing — that is a segmented control's exact job. A `<select>` would hide
 * both the options and their sizes behind a click.
 */
function SideSwitch({
  value,
  counts,
  onChange,
}: {
  value: PoolSegment | "";
  counts: Partial<Record<PoolSegment, number>>;
  onChange: (v: PoolSegment | "") => void;
}) {
  const present = (Object.keys(SEGMENT_META) as PoolSegment[]).filter((s) => counts[s]);
  if (present.length < 2) return null;
  return (
    <div
      role="group"
      aria-label="Side of the market"
      className="inline-flex h-8 items-center rounded-lg bg-muted p-[3px] text-xs"
    >
      {[{ key: "" as const, label: "All" }, ...present.map((s) => ({ key: s, label: SEGMENT_META[s].plural }))].map(
        (opt) => {
          const active = value === opt.key;
          return (
            <button
              key={opt.key || "all"}
              onClick={() => onChange(opt.key)}
              aria-pressed={active}
              className={cn(
                "inline-flex h-full items-center gap-1.5 rounded-md px-2.5 font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring/50",
                active
                  ? "bg-background text-foreground shadow-sm dark:bg-input/40"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.key && (
                <span
                  className={cn("h-1.5 w-1.5 rounded-full", SEGMENT_META[opt.key].bar)}
                  aria-hidden
                />
              )}
              {opt.label}
              {opt.key && (
                <span className="tabular-nums text-muted-foreground" style={MONO}>
                  {counts[opt.key]}
                </span>
              )}
            </button>
          );
        },
      )}
    </div>
  );
}

/** Criteria toggle chip — a pill that says exactly what it narrows to. */
function ToggleChip({
  label,
  active,
  icon,
  onClick,
}: {
  label: string;
  active: boolean;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
        active
          ? "border-border-strong bg-accent text-primary-ink"
          : "border-input text-muted-foreground hover:border-border-strong hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function SourcingPage() {
  const { user } = useAuth();
  const { data: mandates } = useMandates();
  const { data: categories } = useCategories();
  const [mandateId, setMandateId] = useState(0);
  const [c, setC] = useState<Criteria>(EMPTY_CRITERIA);
  const [qDebounced, setQDebounced] = useState("");
  const [page, setPage] = useState(1);
  // `sort` defaults to "score", which is meaningless with no deal open — the server
  // silently orders by name there, so the state follows the server rather than the label
  // claiming an order the list does not have.
  const [view, setView] = useState<"discover" | "funnel">("discover");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [focusIdx, setFocusIdx] = useState(-1);
  const [pushTarget, setPushTarget] = useState<SourcingPoolItem | null>(null);
  const [savingSearch, setSavingSearch] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [scoringMatches, setScoringMatches] = useState(false);

  const mandateList = mandates?.items ?? [];
  const effectiveMandate = mandateId || mandateList[0]?.id || 0;
  const currentDeal = mandateList.find((m) => m.id === effectiveMandate);
  /**
   * The pool is the firm's standing company database, not a per-deal list — so with no
   * engagement yet it still opens, searchable, in "database mode". What a deal *adds*
   * is the overlay: funnel stages, AI scores, and pushing a company onto a book.
   */
  const databaseMode = effectiveMandate === 0;

  useEffect(() => {
    const t = setTimeout(() => {
      setQDebounced(c.q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [c.q]);

  const set = <K extends keyof Criteria>(k: K, v: Criteria[K]) => {
    setC((prev) => ({ ...prev, [k]: v }));
    if (k !== "q") setPage(1);
  };

  /** The current query, minus paging — reused by results, CSV export, and Score matches. */
  const criteria = useMemo(
    () => ({
      mandate_id: effectiveMandate || undefined,
      q: qDebounced || undefined,
      hq: c.hq || undefined,
      category_id: c.categoryId || undefined,
      segment: c.segment || undefined,
      sector: c.sector || undefined,
      rev_min: c.revMin || undefined,
      rev_band: c.band || undefined,
      headcount_min: c.headcountMin ? Number(c.headcountMin) : undefined,
      has_score: c.hasScore || undefined,
      warm_only: c.warmOnly || undefined,
      sort: !effectiveMandate && c.sort === "score" ? "name" : c.sort,
    }),
    [effectiveMandate, qDebounced, c],
  );
  const filters: PoolFilters = useMemo(
    () => ({ ...criteria, page, page_size: PAGE_SIZE }),
    [criteria, page],
  );

  const pool = usePool(filters, view === "discover");
  const { data, isLoading, isFetching, isError } = pool;
  const { data: facets } = useSourcingFacets(effectiveMandate || undefined);
  const { data: coverage } = useFunnelAnalytics(effectiveMandate || undefined);
  const addCandidate = useAddCandidate();
  const bulkAdd = useBulkAddCandidates();
  const changeStage = useChangeCandidateStage();
  const { data: stagesData } = useSourcingStages();
  const savedSearches = useSavedSearches();
  const createSaved = useCreateSavedSearch();
  const deleteSaved = useDeleteSavedSearch();
  const scoreCandidates = useScoreCandidates();
  const scoreFeedback = useScoreFeedback();

  const items = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const poolTotal = facets?.total;
  const inFunnel = coverage?.pool_coverage.in_funnel;

  // Facet-derived shape of the database. These decide which controls are worth rendering:
  // the deck grows as the firm's data does, instead of shipping dead selects on day one.
  const segmentCounts = useMemo(
    () =>
      Object.fromEntries((facets?.by_segment ?? []).map((s) => [s.segment, s.count])) as Partial<
        Record<PoolSegment, number>
      >,
    [facets],
  );
  const sectorOptions = facets?.by_sector ?? [];
  const sizedTotal = useMemo(
    () => (facets?.size_bands ?? []).reduce((sum, b) => sum + b.count, 0),
    [facets],
  );

  /**
   * Every narrowing currently in force, as removable chips.
   *
   * The rail, the deck and the saved searches can all narrow the list, so without one
   * place that states the whole query an analyst can end up staring at 3 results and no
   * explanation. Each chip drops exactly the criterion it names.
   */
  const activeCriteria = useMemo(
    () =>
      [
        c.segment && {
          label: SEGMENT_META[c.segment].plural,
          clear: () => set("segment", "" as const),
        },
        c.sector && {
          label:
            c.sector === UNCLASSIFIED_SECTOR
              ? "Unclassified sector"
              : c.sector,
          clear: () => set("sector", ""),
        },
        c.categoryId && {
          label: categories?.items.find((x) => x.id === c.categoryId)?.name ?? "Category",
          clear: () => set("categoryId", 0),
        },
        c.hq && { label: c.hq, clear: () => set("hq", "") },
        c.band && {
          label: facets?.size_bands.find((b) => b.key === c.band)?.label ?? "Size",
          clear: () => set("band", ""),
        },
        c.revMin && { label: `Rev ≥ ₹${c.revMin} Cr`, clear: () => set("revMin", "") },
        c.headcountMin && { label: `Staff ≥ ${c.headcountMin}`, clear: () => set("headcountMin", "") },
        c.warmOnly && { label: "Worked before", clear: () => set("warmOnly", false) },
        c.hasScore && { label: "Scored only", clear: () => set("hasScore", false) },
      ].filter(Boolean) as { label: string; clear: () => void }[],
    [c, categories, facets],
  );
  const activeCount = activeCriteria.length;

  const selectEngagement = (id: number) => {
    setMandateId(id);
    setSelected(new Set());
    setExpanded(new Set());
    setFocusIdx(-1);
    setPage(1);
  };

  const toggleSelect = (profileId: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });

  const toggleExpand = (profileId: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });

  /** AI-score every company matching the current query (server cap: first 200).
   *  Scoring materialises them as Research / Long-list candidates — this is the
   *  "build my long-list" action, not a passive annotation. */
  const scoreMatches = async () => {
    if (total === 0 || scoringMatches) return;
    setScoringMatches(true);
    try {
      const qs = buildPoolQS({ ...criteria, page: 1, page_size: SCORE_CAP });
      const matches = await api.get<SourcingPoolResponse>(`/sourcing/candidates${qs}`);
      const ids = matches.items.map((i) => i.profile_id);
      const res = await scoreCandidates.mutateAsync({ mandate_id: effectiveMandate, profile_ids: ids });
      toast.success(
        `${res.scored} scored, ${res.cached} cached${total > SCORE_CAP ? ` — top ${SCORE_CAP} of ${total} matches` : ""}${res.degraded ? " (AI degraded — some failed)" : ""}`,
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Scoring failed");
    } finally {
      setScoringMatches(false);
    }
  };

  const scoreSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    try {
      const res = await scoreCandidates.mutateAsync({ mandate_id: effectiveMandate, profile_ids: ids });
      toast.success(`${res.scored} scored, ${res.cached} cached${res.degraded ? " (AI degraded — some failed)" : ""}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Scoring failed");
    }
  };

  const sendFeedback = async (candidateId: number, vote: "UP" | "DOWN") => {
    try {
      await scoreFeedback.mutateAsync({ candidateId, vote });
      toast.success("Thanks — feedback recorded");
    } catch {
      toast.error("Failed to record feedback");
    }
  };

  const shortlist = async (item: SourcingPoolItem) => {
    try {
      await addCandidate.mutateAsync({ mandate_id: effectiveMandate, profile_id: item.profile_id, stage_kind: "SHORTLIST" });
      toast.success(`${item.company_name} shortlisted`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to shortlist");
    }
  };

  const bulkShortlist = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    try {
      const res = await bulkAdd.mutateAsync({ mandate_id: effectiveMandate, profile_ids: ids, stage_kind: "SHORTLIST" });
      setSelected(new Set());
      const researchStage = stagesData?.items.find((s) => s.kind === "RESEARCH");
      toast.success(`${res.count} shortlisted`, {
        action: researchStage
          ? {
              label: "Undo",
              onClick: async () => {
                await Promise.all(
                  res.candidate_ids.map((id) => changeStage.mutateAsync({ id, stageId: researchStage.id })),
                );
                toast.success("Undone");
              },
            }
          : undefined,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Bulk shortlist failed");
    }
  };

  const saveCurrentSearch = async () => {
    const name = searchName.trim();
    if (!name) return;
    try {
      await createSaved.mutateAsync({
        name,
        scope: "PRIVATE",
        criteria: {
          q: qDebounced || undefined,
          hq: c.hq || undefined,
          category_id: c.categoryId || undefined,
          segment: c.segment || undefined,
          sector: c.sector || undefined,
          rev_band: c.band || undefined,
          rev_min: c.revMin || undefined,
          headcount_min: c.headcountMin ? Number(c.headcountMin) : undefined,
          warm_only: c.warmOnly || undefined,
          has_score: c.hasScore || undefined,
          sort: c.sort,
        },
      });
      toast.success("Search saved");
      setSearchName("");
      setSavingSearch(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const applySaved = (criteria: Record<string, unknown>) => {
    setC({
      q: (criteria.q as string) ?? "",
      hq: (criteria.hq as string) ?? "",
      categoryId: (criteria.category_id as number) ?? 0,
      // Searches saved before segment existed carry the old placement-derived `type`.
      // TARGET/BUYER/INVESTOR are the same three words in both, so the old value still
      // means what the analyst meant — it just narrows better now.
      segment: ((criteria.segment ?? criteria.type) as PoolSegment) ?? "",
      sector: (criteria.sector as string) ?? "",
      band: (criteria.rev_band as RevBand) ?? "",
      revMin: (criteria.rev_min as string) ?? "",
      headcountMin: criteria.headcount_min ? String(criteria.headcount_min) : "",
      warmOnly: !!criteria.warm_only,
      hasScore: !!criteria.has_score,
      sort: (criteria.sort as PoolFilters["sort"]) ?? "score",
    });
    setQDebounced((criteria.q as string) ?? "");
    setPage(1);
    setView("discover");
  };

  const resetCriteria = () => setC((prev) => ({ ...EMPTY_CRITERIA, q: prev.q, sort: prev.sort }));

  // Keyboard focus stays honest when the list shrinks under it — derived, not stored.
  const fi = items.length === 0 ? -1 : Math.min(focusIdx, items.length - 1);

  // Keyboard: j/k move, x select, s shortlist, p push, e opens the "why". Only on
  // the Discover list — the funnel board owns drag & drop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view !== "discover") return;
      if (e.key === "Escape") {
        setSelected(new Set());
        setFocusIdx(-1);
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing =
        t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (typing || document.querySelector('[role="dialog"]')) return;
      if (items.length === 0) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx(Math.min(items.length - 1, fi + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx(fi < 0 ? 0 : Math.max(0, fi - 1));
      } else if (e.key === "x") {
        const it = items[fi];
        if (it) {
          e.preventDefault();
          toggleSelect(it.profile_id);
        }
      } else if (e.key === "s") {
        const it = items[fi];
        if (it && it.candidate?.stage_kind !== "SHORTLIST") {
          e.preventDefault();
          shortlist(it);
        }
      } else if (e.key === "p") {
        const it = items[fi];
        if (it) {
          e.preventDefault();
          setPushTarget(it);
        }
      } else if (e.key === "e" || e.key === "Enter") {
        const it = items[fi];
        if (it) {
          e.preventDefault();
          toggleExpand(it.profile_id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, items, fi]);

  useEffect(() => {
    if (fi < 0) return;
    (document.querySelector(`[data-row-index="${fi}"]`) as HTMLElement | null)?.scrollIntoView({
      block: "nearest",
    });
  }, [fi]);

  const csvHref = `${API_URL}/sourcing/candidates.csv${buildPoolQS(criteria as PoolFilters)}`;

  // ── Page-level gates: engagements still loading, or none assigned ──
  if (!mandates) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="h-6 w-40 animate-pulse rounded bg-ink-100" />
        <div className="h-32 animate-pulse rounded-lg bg-ink-100" />
        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="hidden h-72 animate-pulse rounded-lg bg-ink-100 lg:block" />
          <div className="h-72 animate-pulse rounded-lg bg-ink-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Command line — deal context left; view switch + occasional tools right ── */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        {databaseMode ? (
          <DatabaseModeHeader total={poolTotal} isPartner={user?.role === "PARTNER"} />
        ) : (
          <EngagementSwitch
            mandates={mandateList}
            current={currentDeal}
            onSelect={selectEngagement}
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {/* A tab group of one is not a choice. With no deal open there is no funnel to
              switch to, so the switch itself stays away. */}
          {!databaseMode && (
          <div
            role="tablist"
            aria-label="Sourcing view"
            className="inline-flex w-fit items-center rounded-lg bg-muted p-[3px] text-sm text-muted-foreground"
          >
            {(
              [
                { id: "discover", label: "Discover" },
                { id: "funnel", label: "Funnel" },
              ] as const
            ).map((t) => {
              const active = view === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={active}
                  aria-controls="sourcing-panel"
                  onClick={() => setView(t.id)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md border border-transparent px-3 font-medium outline-none transition-all focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    active
                      ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30"
                      : "hover:text-foreground",
                  )}
                >
                  {t.label}
                  {t.id === "funnel" && inFunnel != null && (
                    <span
                      className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground"
                      style={MONO}
                    >
                      {inFunnel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          )}
          <Link href="/sourcing/import">
            <Button variant="outline" size="sm" className="h-9">
              <Import className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Import
            </Button>
          </Link>
          <Link href="/sourcing/analytics">
            <Button variant="outline" size="sm" className="h-9">
              <LineChart className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Analytics
            </Button>
          </Link>
        </div>
      </div>

      <div role="tabpanel" id="sourcing-panel" aria-labelledby={`tab-${view}`} className="flex flex-col gap-4">
        {view === "funnel" ? (
          <SourcingKanban mandateId={effectiveMandate} />
        ) : (
          <>
            {/* ── Query deck — ask the database ── */}
            <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:p-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-primary-ink" aria-hidden />
                <Input
                  type="search"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Search the firm database"
                  value={c.q}
                  onChange={(e) => set("q", e.target.value)}
                  placeholder={
                    poolTotal != null
                      ? `Search ${poolTotal.toLocaleString("en-IN")} companies — name, city, or domain…`
                      : "Search the firm database — name, city, or domain…"
                  }
                  className="h-12 rounded-lg pl-11 !text-[15px]"
                />
                {c.q && (
                  <button
                    onClick={() => set("q", "")}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>

              {/* Criteria — always visible; discovery filters are first-class here.
                  Controls that can only read a *placement* (category, revenue size) render
                  solely once the firm's book gives them something to say. A select whose
                  every option returns nothing is worse than no select. */}
              <div className="flex flex-wrap items-center gap-2">
                <SideSwitch
                  value={c.segment}
                  counts={segmentCounts}
                  onChange={(v) => set("segment", v)}
                />
                {sectorOptions.length > 0 && (
                  <select
                    value={c.sector}
                    onChange={(e) => set("sector", e.target.value)}
                    className={SELECT_CLS}
                    aria-label="Sector"
                  >
                    <option value="">Any sector</option>
                    {sectorOptions.map((s) => (
                      <option key={s.sector} value={s.sector}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                )}
                {(categories?.items.length ?? 0) > 0 && (facets?.by_category.length ?? 0) > 0 && (
                  <select
                    value={c.categoryId}
                    onChange={(e) => set("categoryId", Number(e.target.value))}
                    className={SELECT_CLS}
                    aria-label="Category"
                  >
                    <option value={0}>All categories</option>
                    {categories?.items.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                )}
                {sizedTotal > 0 && (
                  <select
                    value={c.band}
                    onChange={(e) => set("band", e.target.value as Criteria["band"])}
                    className={SELECT_CLS}
                    aria-label="Revenue size"
                  >
                    <option value="">Any size</option>
                    {(facets?.size_bands ?? []).map((b) => (
                      <option key={b.key} value={b.key}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                )}
                <Input
                  value={c.hq}
                  onChange={(e) => set("hq", e.target.value)}
                  placeholder="HQ city"
                  aria-label="HQ city"
                  className="h-8 w-28 text-xs"
                />
                {sizedTotal > 0 && (
                  <Input
                    inputMode="numeric"
                    value={c.headcountMin}
                    onChange={(e) => set("headcountMin", e.target.value)}
                    placeholder="Staff ≥"
                    aria-label="Minimum headcount"
                    className="h-8 w-20 text-xs"
                  />
                )}
                <ToggleChip
                  label="Worked before"
                  active={c.warmOnly}
                  icon={<History className="h-3 w-3" aria-hidden />}
                  onClick={() => set("warmOnly", !c.warmOnly)}
                />
                {!databaseMode && (
                  <ToggleChip
                    label="Scored"
                    active={c.hasScore}
                    icon={<Sparkles className="h-3 w-3" aria-hidden />}
                    onClick={() => set("hasScore", !c.hasScore)}
                  />
                )}
                <div className="ml-auto">
                  {savingSearch ? (
                    <div className="flex items-center gap-1">
                      <Input
                        autoFocus
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveCurrentSearch()}
                        placeholder="Name this search…"
                        className="h-8 w-36 text-xs"
                      />
                      <Button size="sm" className="h-8" onClick={saveCurrentSearch} disabled={createSaved.isPending}>
                        Save
                      </Button>
                      <button
                        onClick={() => setSavingSearch(false)}
                        aria-label="Cancel saving search"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => setSavingSearch(true)}>
                      <Bookmark className="mr-1 h-3.5 w-3.5" aria-hidden /> Save search
                    </Button>
                  )}
                </div>
              </div>

              {/* Readout — what the query returned, and what to do with it */}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-3">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Database className="h-3.5 w-3.5" aria-hidden />
                  <span>
                    <span key={total} className="count-pop inline-block font-semibold tabular-nums text-foreground" style={MONO}>
                      {isLoading ? "—" : total.toLocaleString("en-IN")}
                    </span>
                    {poolTotal != null && (
                      <span>
                        {" "}of{" "}
                        <span className="tabular-nums" style={MONO}>
                          {poolTotal.toLocaleString("en-IN")}
                        </span>
                      </span>
                    )}{" "}
                    {total === 1 ? "company matches" : "companies match"}
                  </span>
                  {isFetching && !isLoading && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {/* "Best fit" needs a thesis to be a fit *to*, and revenue needs revenue
                      on file. Offering either where it silently falls back to name order
                      would make the control lie about how the list is ordered. */}
                  <select
                    value={c.sort}
                    onChange={(e) => set("sort", e.target.value as PoolFilters["sort"])}
                    className={SELECT_CLS}
                    aria-label="Sort results"
                  >
                    {!databaseMode && <option value="score">Sort: Best fit</option>}
                    <option value="name">Sort: Name</option>
                    {sizedTotal > 0 && <option value="rev">Sort: Revenue</option>}
                  </select>
                  <a
                    href={csvHref}
                    title="Export the current results as CSV (first 200)"
                    aria-label="Export results as CSV"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-input text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                  </a>
                  {/* Scoring is *against a thesis*, so it needs a deal. With none open the
                      page's strongest affordance would be a dead amber button — so it
                      states the prerequisite in the quiet register instead. */}
                  {databaseMode ? (
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground ring-1 ring-border">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden />
                      Open a deal to score
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={scoreMatches}
                      disabled={scoringMatches || total === 0}
                      title={`AI-score every match (up to ${SCORE_CAP}) against this deal's thesis — they join Research / Long-list`}
                    >
                      {scoringMatches ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      )}
                      {scoringMatches ? "Scoring…" : "Score matches"}
                    </Button>
                  )}
                </div>
              </div>
            </section>

            {/* ── The query, stated — every narrowing in force, each one removable ── */}
            {activeCount > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={LABEL}>Narrowed by</span>
                {activeCriteria.map((crit) => (
                  <span
                    key={crit.label}
                    className="inline-flex items-center gap-0.5 rounded-full bg-subtle py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary-ink ring-1 ring-border-strong"
                  >
                    {crit.label}
                    <button
                      onClick={crit.clear}
                      aria-label={`Remove filter ${crit.label}`}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </span>
                ))}
                <button
                  onClick={resetCriteria}
                  className="rounded px-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* ── Saved searches ── */}
            {(savedSearches.data?.items.length ?? 0) > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={LABEL}>Saved</span>
                {savedSearches.data!.items.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-0.5 rounded-full border py-0.5 pl-2.5 pr-1 text-xs">
                    <button
                      onClick={() => applySaved(s.criteria)}
                      className="rounded py-0.5 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {s.name}
                    </button>
                    <button
                      onClick={() => deleteSaved.mutate(s.id)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-destructive/10 hover:text-destructive-ink focus-visible:ring-2 focus-visible:ring-ring/50"
                      aria-label={`Delete saved search ${s.name}`}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* ── Lens + results ── */}
            <div className="grid items-start gap-5 lg:grid-cols-[248px_minmax(0,1fr)]">
              <DatabaseLens
                facets={facets}
                databaseMode={databaseMode}
                selection={{
                  warmOnly: c.warmOnly,
                  hasScore: c.hasScore,
                  segment: c.segment,
                  sector: c.sector,
                  hq: c.hq,
                  band: c.band,
                  categoryId: c.categoryId,
                }}
                onChange={(key, value) => set(key, value as Criteria[typeof key])}
              />

              {/* Results */}
              <div className="flex min-w-0 flex-col gap-4">
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  {isError ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                      <AlertTriangle className="h-5 w-5 text-foreground" aria-hidden />
                      <p className="text-sm font-medium">Couldn&rsquo;t load the database.</p>
                      <button onClick={() => pool.refetch()} className="text-xs font-medium text-primary-ink hover:underline">
                        Try again
                      </button>
                    </div>
                  ) : isLoading ? (
                    <div className="divide-y divide-border">
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <div key={n} className="flex items-stretch">
                          <div className="w-[58px] shrink-0 animate-pulse bg-ink-100" />
                          <div className="flex-1 space-y-2 px-4 py-3.5">
                            <div className="h-3.5 w-1/3 animate-pulse rounded bg-ink-100" />
                            <div className="h-3 w-1/2 animate-pulse rounded bg-ink-100" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : items.length === 0 ? (
                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                      <Database className="h-6 w-6 text-muted-foreground" aria-hidden />
                      <p className="text-sm font-medium">
                        {poolTotal === 0 ? "The database is empty." : "No companies match."}
                      </p>
                      {poolTotal === 0 ? (
                        <>
                          <p className="text-xs text-muted-foreground">
                            Every firm starts with a research pool of real companies. Yours has
                            none on file — import a list and it becomes searchable here.
                          </p>
                          <Link href="/import" className="text-xs font-medium text-primary-ink hover:underline">
                            Import a workbook
                          </Link>
                        </>
                      ) : activeCount > 0 || qDebounced ? (
                        <>
                          <p className="text-xs text-muted-foreground">
                            {qDebounced
                              ? `Nothing in the ${poolTotal?.toLocaleString("en-IN")}-company database matches “${qDebounced}”${activeCount > 0 ? " with these filters" : ""}.`
                              : "These filters exclude every company in the database."}
                          </p>
                          <button
                            onClick={() => {
                              resetCriteria();
                              set("q", "");
                            }}
                            className="text-xs font-medium text-primary-ink hover:underline"
                          >
                            Clear search &amp; criteria
                          </button>
                        </>
                      ) : (
                        <Link href="/import" className="text-xs font-medium text-primary-ink hover:underline">
                          Import a list to grow the database
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {items.map((item, i) => (
                        <div
                          key={item.profile_id}
                          data-row-index={i}
                          className={cn(
                            "data-row",
                            fi === i && "bg-subtle ring-1 ring-inset ring-border-strong",
                          )}
                          style={{ "--row-i": Math.min(i, 14) } as CSSProperties}
                        >
                          <CandidateRow
                            item={item}
                            index={i}
                            // Shortlist and Push both write onto a *deal*; with none
                            // selected the row is a database record, not a candidate.
                            onShortlist={databaseMode ? undefined : shortlist}
                            onPush={databaseMode ? undefined : setPushTarget}
                            onFeedback={sendFeedback}
                            // Selection exists to drive the bulk deal actions, so it is
                            // off when there is no deal to act on.
                            selectable={!databaseMode}
                            selected={selected.has(item.profile_id)}
                            anySelected={selected.size > 0}
                            onToggleSelect={toggleSelect}
                            expanded={expanded.has(item.profile_id)}
                            onToggleExpand={() => toggleExpand(item.profile_id)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-xs text-muted-foreground tabular-nums" style={MONO}>
                      Page {page} / {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                        <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Next <ChevronRight className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Shortcut hint — one quiet line under the work, not chrome above it. */}
                {items.length > 0 && (
                  <p className="hidden text-center text-[11px] text-muted-foreground lg:block">
                    <kbd className="rounded border bg-muted px-1 tabular-nums">j</kbd>/<kbd className="rounded border bg-muted px-1 tabular-nums">k</kbd> move ·{" "}
                    <kbd className="rounded border bg-muted px-1 tabular-nums">x</kbd> select ·{" "}
                    <kbd className="rounded border bg-muted px-1 tabular-nums">s</kbd> shortlist ·{" "}
                    <kbd className="rounded border bg-muted px-1 tabular-nums">p</kbd> push ·{" "}
                    <kbd className="rounded border bg-muted px-1 tabular-nums">e</kbd> why
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Bulk action bar — every action on it writes onto a deal ── */}
      {selected.size > 0 && view === "discover" && !databaseMode && (
        <div
          className="bar-rise fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border-strong bg-card px-4 py-2 shadow-lg shadow-primary/5"
          role="status"
        >
          <span className="text-sm font-medium">
            <span className="tabular-nums" style={MONO}>
              {selected.size}
            </span>{" "}
            selected
          </span>
          <Button size="sm" className="h-7 text-xs" onClick={bulkShortlist} disabled={bulkAdd.isPending}>
            <Star className="mr-1 h-3 w-3" aria-hidden /> Shortlist
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={scoreSelected}
            disabled={scoreCandidates.isPending}
            title="AI-score the selected companies against this deal"
          >
            {scoreCandidates.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="mr-1 h-3 w-3" aria-hidden />
            )}
            Score
          </Button>
          <button
            onClick={() => setSelected(new Set())}
            className="rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {pushTarget && (
        <PushToDialog
          open={!!pushTarget}
          onOpenChange={(o) => !o && setPushTarget(null)}
          profileId={pushTarget.profile_id}
          companyName={pushTarget.company_name}
          defaultProjectId={currentDeal?.project_id ?? undefined}
          defaultSide={currentDeal?.type}
        />
      )}
    </div>
  );
}
