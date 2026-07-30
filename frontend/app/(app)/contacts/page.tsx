"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  BookUser,
  Building2,
  Copy,
  Download,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Network,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  Reply,
  Search,
  Send,
  Star,
  StickyNote,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  useContacts,
  useContact,
  useUpdateContact,
  useArchiveContact,
  useUnarchiveContact,
} from "@/hooks/use-contacts";
import { useAuth } from "@/hooks/use-auth";
import { useTableUrlState } from "@/hooks/use-table-url-state";
import { ContactDialog } from "@/components/features/contact-dialog";
import { LogOutreachDialog } from "@/components/features/log-outreach-dialog";
import { boolParam, enumParam, stringParam, type ParamSpec } from "@/lib/table-url-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DISPLAY, LABEL, MONO, PAGE_TITLE, PAGE_TITLE_STYLE } from "@/lib/design";
import { cn } from "@/lib/utils";
import type { Contact, OutreachEvent, Sentiment } from "@/types";


const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");
const QUIET_DAYS = 30;

const ENGAGEMENT_LABEL: Record<string, string> = {
  BUY_SIDE: "Buy-side",
  SELL_SIDE: "Sell-side",
  INVESTOR: "Investor",
  ADVISOR: "Advisor",
  OTHER: "Other",
};

// ── People, in colour ───────────────────────────────────────────────────────────
// Everyone gets a steady hue derived from their name — the rolodex reads as a
// crowd of individuals, not a column of grey icons. Real initials, no fake faces.

const AVATAR_TONES = [
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-destructive/15 text-destructive-ink",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
];

function toneOf(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length];
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// The latest reply's read, worn like a presence dot — visible, never shouting.
const READ_DOT: Record<Sentiment, { dot: string; label: string }> = {
  POSITIVE: { dot: "bg-emerald-500", label: "Latest reply read positive" },
  NEUTRAL: { dot: "bg-muted-foreground/70", label: "Latest reply read neutral" },
  NEGATIVE: { dot: "bg-amber-500", label: "Latest reply read negative" },
};

function PersonMark({
  c,
  size = "sm",
  ring = "ring-background",
}: {
  c: Contact;
  size?: "sm" | "lg";
  ring?: string;
}) {
  const read = c.sentiment ? READ_DOT[c.sentiment] : null;
  return (
    <span className={cn("relative shrink-0", size === "lg" ? "h-12 w-12" : "h-8 w-8")}>
      <span
        aria-hidden
        className={cn(
          "flex h-full w-full items-center justify-center rounded-full font-semibold",
          size === "lg" ? "text-sm" : "text-[10px]",
          toneOf(c.contact_person),
        )}
        style={MONO}
      >
        {initialsOf(c.contact_person)}
      </span>
      {read && (
        <span
          title={read.label}
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-2",
            size === "lg" ? "h-3 w-3" : "h-2 w-2",
            read.dot,
            ring,
          )}
        >
          <span className="sr-only">{read.label}</span>
        </span>
      )}
    </span>
  );
}

// ── Small helpers ───────────────────────────────────────────────────────────────

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(then.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - then.getTime()) / 86_400_000));
}

function fmtElapsed(d: number): string {
  if (d === 0) return "today";
  if (d < 31) return `${d}d`;
  if (d < 365) return `${Math.max(1, Math.round(d / 30.4))}mo`;
  return `${Math.floor(d / 365)}y+`;
}

function fmtFullDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return m && d ? `${d} ${MONTH[m - 1]} ${y}` : iso;
}

function letterOf(name: string): string {
  const ch = name.trim().charAt(0).toUpperCase();
  return ch >= "A" && ch <= "Z" ? ch : "#";
}

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error("Couldn't copy — clipboard unavailable");
  }
}

// ── Rolodex rail — the thumb index, digitized ───────────────────────────────────
// The one tactile artifact every rolodex and phone book shares: letter tabs down
// the edge. Letters with no one behind them sit dimmed; the rest jump.

function prefersReduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function RolodexRail({ present }: { present: Set<string> }) {
  return (
    <nav
      aria-label="Jump to letter"
      className="sticky top-8 hidden max-h-[calc(100vh-10rem)] flex-col items-center self-start overflow-y-auto md:flex lg:top-0 lg:max-h-full"
    >
      {ALPHABET.map((l) => {
        const has = present.has(l);
        return (
          <button
            key={l}
            disabled={!has}
            onClick={() =>
              document
                .getElementById(`rolo-${l}`)
                ?.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "start" })
            }
            className={cn(
              "flex h-[15px] w-5 items-center justify-center rounded text-[9px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              has
                ? "text-muted-foreground hover:text-primary-ink"
                : "cursor-default text-muted-foreground/25",
            )}
            style={MONO}
            aria-label={has ? `Jump to ${l}` : undefined}
            tabIndex={has ? 0 : -1}
          >
            {l}
          </button>
        );
      })}
    </nav>
  );
}

// ── List rows and dividers ──────────────────────────────────────────────────────

function PersonRow({
  c,
  active,
  showCompany,
  onSelect,
}: {
  c: Contact;
  active: boolean;
  showCompany: boolean;
  onSelect: (c: Contact) => void;
}) {
  const elapsed = daysSince(c.last_contact_date);
  const quiet = elapsed !== null && elapsed > QUIET_DAYS;
  const sub = [c.designation, showCompany ? c.company_name : null].filter(Boolean).join(" · ");
  return (
    <button
      data-person-row={c.id}
      onClick={() => onSelect(c)}
      aria-current={active || undefined}
      className={cn(
        "cv-row flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary/[0.07] shadow-[inset_2px_0_0_0_var(--primary)]"
          : "hover:bg-muted/50",
        c.archived_at && "opacity-55",
      )}
    >
      <PersonMark c={c} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold tracking-tight">
            {c.contact_person}
          </span>
          {c.is_primary && (
            <span
              title={`Primary contact${c.company_name ? ` at ${c.company_name}` : ""}`}
              className="shrink-0 text-primary-ink/60"
            >
              <Star className="h-3 w-3 fill-current" aria-hidden />
              <span className="sr-only">Primary contact</span>
            </span>
          )}
          {c.archived_at && (
            <span className="shrink-0 rounded border border-border px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              archived
            </span>
          )}
        </span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
      {elapsed !== null && (
        <span
          className={cn(
            "shrink-0 text-[11px] tabular-nums",
            quiet ? "font-medium text-primary-ink" : "text-muted-foreground",
          )}
          style={MONO}
          title={`Last touch ${fmtFullDate(c.last_contact_date)}`}
        >
          {fmtElapsed(elapsed)}
        </span>
      )}
    </button>
  );
}

function LetterDivider({ letter }: { letter: string }) {
  return (
    <div
      className="sticky top-0 z-10 -mx-1 flex items-center gap-3 bg-background/95 px-4 py-1 backdrop-blur-sm"
    >
      <span className="text-[11px] font-semibold text-primary-ink" style={MONO}>
        {letter}
      </span>
      <span className="h-px flex-1 bg-border/60" aria-hidden />
    </div>
  );
}

function CompanyDivider({
  name,
  companyId,
  count,
  onAdd,
}: {
  name: string;
  companyId: number | null;
  count: number;
  onAdd: (() => void) | null;
}) {
  return (
    <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2 bg-background/95 px-4 py-1.5 backdrop-blur-sm">
      {companyId != null ? (
        <Link
          href={`/companies/${companyId}`}
          title={`Open ${name}`}
          className="flex min-w-0 items-center gap-1 truncate rounded text-xs font-semibold uppercase tracking-wider outline-none hover:text-primary-ink focus-visible:ring-2 focus-visible:ring-ring"
        >
          {name}
          <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      ) : (
        <span className="truncate text-xs font-semibold uppercase tracking-wider">{name}</span>
      )}
      <span className="text-[11px] tabular-nums text-muted-foreground" style={MONO}>
        {count}
      </span>
      <span className="h-px flex-1 bg-border/60" aria-hidden />
      {onAdd && (
        <button
          onClick={onAdd}
          title={`Add a person at ${name}`}
          aria-label={`Add a person at ${name}`}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

// ── The person card — one relationship, told properly ───────────────────────────

const EVENT_META: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  INITIAL_EMAIL: { label: "Initial email", icon: Mail, tone: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300" },
  FOLLOW_UP: { label: "Follow-up", icon: Send, tone: "bg-primary/12 text-primary-ink" },
  RESPONSE: { label: "Reply", icon: MessageSquare, tone: "bg-emerald-500/12 text-emerald-500" },
  BOUNCE: { label: "Bounce", icon: AlertTriangle, tone: "bg-destructive/12 text-destructive-ink" },
  CALL: { label: "Call", icon: Phone, tone: "bg-sky-500/12 text-sky-500" },
  LINKEDIN: { label: "LinkedIn", icon: Network, tone: "bg-violet-500/12 text-violet-500" },
  MEETING: { label: "Meeting", icon: Users, tone: "bg-sky-500/12 text-sky-500" },
  NOTE: { label: "Note", icon: StickyNote, tone: "bg-muted text-muted-foreground" },
};

function ReachRow({
  icon: Icon,
  value,
  copyLabel,
  href,
}: {
  icon: LucideIcon;
  value: string;
  copyLabel?: string;
  href?: string;
}) {
  return (
    <div className="group/reach flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate rounded text-sm outline-none hover:text-primary-ink focus-visible:ring-2 focus-visible:ring-ring"
        >
          {value}
        </a>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm">{value}</span>
      )}
      {copyLabel && (
        <button
          onClick={() => copyText(value, copyLabel)}
          title={`Copy ${copyLabel.toLowerCase()}`}
          aria-label={`Copy ${copyLabel.toLowerCase()}`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 outline-none transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover/reach:opacity-100"
        >
          <Copy className="h-3 w-3" aria-hidden />
        </button>
      )}
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-xs">{children}</span>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </div>
      {[1, 2, 3].map((n) => (
        <div key={n} className="h-16 animate-pulse rounded-lg bg-muted/60" />
      ))}
    </div>
  );
}

function PersonPanel({ contactId, onClose }: { contactId: number; onClose?: () => void }) {
  const { data: c, isLoading, isError, refetch } = useContact(contactId);
  const [quickType, setQuickType] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const updateContact = useUpdateContact();
  const archiveContact = useArchiveContact();
  const unarchiveContact = useUnarchiveContact();

  if (isLoading) return <PanelSkeleton />;
  if (isError || !c)
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-center">
        <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
        <p className="text-sm font-medium">Couldn&rsquo;t load this person.</p>
        <button onClick={() => refetch()} className="text-xs font-medium text-primary-ink hover:underline">
          Try again
        </button>
      </div>
    );

  const archived = !!c.archived_at;
  const elapsed = daysSince(c.last_contact_date);
  const events = [...c.events].reverse(); // newest first — quick recall
  const read = c.sentiment ? READ_DOT[c.sentiment] : null;

  const makePrimary = async () => {
    try {
      await updateContact.mutateAsync({ id: c.id, data: { is_primary: true } });
      toast.success(`${c.contact_person} is now the primary contact`);
    } catch {
      toast.error("Couldn't set primary contact");
    }
  };
  const doArchive = async () => {
    try {
      await archiveContact.mutateAsync(c.id);
      toast.success("Contact archived");
    } catch {
      toast.error("Couldn't archive contact");
    }
  };
  const doRestore = async () => {
    try {
      await unarchiveContact.mutateAsync(c.id);
      toast.success("Contact restored");
    } catch {
      toast.error("Couldn't restore contact");
    }
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Letterhead */}
      <div className="flex items-start gap-3">
        <PersonMark c={c} size="lg" ring="ring-card" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[22px] font-semibold leading-tight" style={DISPLAY}>
            {c.contact_person}
          </h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {c.designation}
            {c.designation && c.company_name && " · "}
            {c.company_name && (
              <Link
                href={`/companies/${c.company_id}`}
                className="rounded outline-none hover:text-primary-ink hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {c.company_name}
              </Link>
            )}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {c.is_primary && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/[0.12] px-1.5 py-px text-[10px] font-medium text-amber-700/90 dark:text-amber-300/80">
                <Star className="h-2.5 w-2.5 fill-current" aria-hidden /> Primary
              </span>
            )}
            {c.engagement && (
              <span className="rounded bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                {ENGAGEMENT_LABEL[c.engagement] ?? c.engagement}
              </span>
            )}
            {archived && (
              <span className="rounded border border-border px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Archived
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {!archived && (
            <button
              onClick={() => setEditOpen(true)}
              title="Edit contact"
              aria-label="Edit contact"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  aria-label={`More actions for ${c.contact_person}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
              }
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {!archived && !c.is_primary && (
                <DropdownMenuItem onClick={makePrimary}>
                  <Star className="h-4 w-4 text-primary-ink" aria-hidden /> Make primary
                </DropdownMenuItem>
              )}
              <DropdownMenuItem render={<Link href={`/companies/${c.company_id}`} />}>
                <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden /> Open company
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={`/contacts/${c.id}`} />}>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" aria-hidden /> Full profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {archived ? (
                <DropdownMenuItem onClick={doRestore}>
                  <ArchiveRestore className="h-4 w-4 text-muted-foreground" aria-hidden /> Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={doArchive}>
                  <Archive className="h-4 w-4 text-muted-foreground" aria-hidden /> Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Log a touch */}
      {archived ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Archived — restore to log touches.</p>
          <Button size="sm" variant="outline" className="h-7" onClick={doRestore}>
            <ArchiveRestore className="mr-1 h-3.5 w-3.5" aria-hidden /> Restore
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          <Button variant="outline" onClick={() => setQuickType("RESPONSE")}>
            <Reply className="mr-1 h-3.5 w-3.5 text-emerald-500" aria-hidden /> Reply
          </Button>
          <Button variant="outline" onClick={() => setQuickType("CALL")}>
            <PhoneCall className="mr-1 h-3.5 w-3.5 text-sky-500" aria-hidden /> Call
          </Button>
          <Button variant="outline" onClick={() => setQuickType("MEETING")}>
            <Users className="mr-1 h-3.5 w-3.5 text-violet-500" aria-hidden /> Meeting
          </Button>
        </div>
      )}

      {/* Get in touch */}
      <div>
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Get in touch
        </p>
        {c.email || c.phone || c.linkedin ? (
          <div className="flex flex-col">
            {c.email && <ReachRow icon={Mail} value={c.email} copyLabel="Email" />}
            {c.phone && <ReachRow icon={Phone} value={c.phone} copyLabel="Phone" />}
            {c.linkedin && (
              <ReachRow
                icon={Network}
                value={c.linkedin.replace(/^https?:\/\/(www\.)?/, "")}
                href={c.linkedin.startsWith("http") ? c.linkedin : `https://${c.linkedin}`}
              />
            )}
          </div>
        ) : (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            No email or phone on file yet —{" "}
            {archived ? (
              "restore to add them."
            ) : (
              <button onClick={() => setEditOpen(true)} className="rounded font-medium text-primary-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                edit to add them
              </button>
            )}
            .
          </p>
        )}
      </div>

      {/* Relationship facts */}
      <div className="rounded-lg border border-border px-3 py-1.5">
        {c.poc_name && (
          <MetaRow label="Known via">
            <span className="font-medium">{c.poc_name}</span>
          </MetaRow>
        )}
        {c.date_connected && (
          <MetaRow label="Connected">
            <span className="tabular-nums" style={MONO}>{fmtFullDate(c.date_connected)}</span>
          </MetaRow>
        )}
        <MetaRow label="Last touch">
          {elapsed !== null ? (
            <span
              className={cn("tabular-nums", elapsed > QUIET_DAYS && "font-medium text-primary-ink")}
              style={MONO}
              title={fmtFullDate(c.last_contact_date)}
            >
              {fmtElapsed(elapsed)}
              {elapsed > QUIET_DAYS && " — gone quiet"}
            </span>
          ) : (
            <span className="text-muted-foreground">none yet</span>
          )}
        </MetaRow>
        {read && (
          <MetaRow label="Latest read">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", read.dot)} aria-hidden />
              {c.sentiment!.charAt(0) + c.sentiment!.slice(1).toLowerCase()}
            </span>
          </MetaRow>
        )}
      </div>

      {/* Notes — the human texture */}
      {(c.reason || c.remark || c.comments) && (
        <div>
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Notes
          </p>
          <div className="space-y-1.5 rounded-lg bg-muted/40 px-3 py-2.5 text-xs leading-relaxed">
            {c.reason && <p>{c.reason}</p>}
            {c.remark && <p>{c.remark}</p>}
            {c.comments && <p className="text-muted-foreground">{c.comments}</p>}
          </div>
        </div>
      )}

      {/* The story so far */}
      <div>
        <p className="mb-2 flex items-baseline gap-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Story so far
          {events.length > 0 && (
            <span className="tabular-nums" style={MONO}>
              {events.length}
            </span>
          )}
        </p>
        {events.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">
            No touches with {c.contact_person.split(" ")[0]} logged yet
            {archived ? "." : " — log the first call or reply above."}
          </p>
        ) : (
          <ol className="relative flex flex-col gap-0.5">
            {events.length > 1 && (
              <span className="absolute bottom-4 left-[13px] top-4 w-px bg-border/70" aria-hidden />
            )}
            {events.map((e: OutreachEvent) => {
              const m = EVENT_META[e.event_type] ?? {
                label: e.event_type,
                icon: StickyNote,
                tone: "bg-muted text-muted-foreground",
              };
              const Icon = m.icon;
              return (
                <li key={e.id} className="relative flex items-start gap-2.5 px-0.5 py-1">
                  <span
                    className={cn(
                      "z-10 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full ring-4 ring-card",
                      m.tone,
                    )}
                  >
                    <Icon className="h-3 w-3" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium">{m.label}</span>
                      <time className="shrink-0 text-[10px] tabular-nums text-muted-foreground" style={MONO}>
                        {fmtFullDate(e.occurred_on)}
                      </time>
                    </span>
                    {e.notes && (
                      <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                        {e.notes}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {quickType !== null && (
        <LogOutreachDialog
          key={quickType}
          companyId={c.company_id}
          companyName={c.company_name ?? "Company"}
          defaultEventType={quickType}
          defaultContactId={c.id}
          open
          onOpenChange={(o) => !o && setQuickType(null)}
          trigger={null}
        />
      )}
      {editOpen && (
        <ContactDialog companyId={c.company_id} contact={c} open onOpenChange={setEditOpen} trigger={null} />
      )}
    </div>
  );
}

// ── Idle card — what the firm knows, before anyone is picked ────────────────────

function IdleCard({
  people,
  companies,
  deepest,
}: {
  people: number;
  companies: number;
  deepest: { name: string; count: number } | null;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
        <BookUser className="h-5 w-5 text-primary-ink/50" aria-hidden />
      </span>
      <p className="text-sm">
        The firm knows{" "}
        <span className="font-semibold tabular-nums" style={MONO}>
          {people}
        </span>{" "}
        people at{" "}
        <span className="font-semibold tabular-nums" style={MONO}>
          {companies}
        </span>{" "}
        companies.
      </p>
      {deepest && deepest.count > 1 && (
        <p className="text-xs text-muted-foreground">
          Deepest bench: {deepest.name} ·{" "}
          <span className="tabular-nums" style={MONO}>
            {deepest.count}
          </span>{" "}
          people
        </p>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Pick someone to see their story. <kbd className="rounded border border-border px-1" style={MONO}>↑↓</kbd>{" "}
        moves · <kbd className="rounded border border-border px-1" style={MONO}>⏎</kbd> opens the full profile
      </p>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────

type View = "alpha" | "company";

// URL-persisted rolodex filters (P2 DataTable pattern, list idiom).
const CONTACTS_SPEC = {
  q: stringParam(""),
  view: enumParam(["alpha", "company"] as const, "alpha"),
  mine: boolParam(false),
  arch: boolParam(false),
} satisfies ParamSpec;

interface Group {
  key: string;
  letter?: string;
  companyId?: number | null;
  companyName?: string;
  people: Contact[];
}

export default function ContactsPage() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useContacts({ include_archived: true });
  const { user: me } = useAuth();

  // Filters live in the URL (shareable, reload-stable) — the P2 pattern in the
  // rolodex's own idiom. The selected person (?c=) stays on its bespoke keyboard-nav
  // path below; it isn't a filter, so it keeps its lightweight replaceState sync.
  const [filters, patchFilters] = useTableUrlState(CONTACTS_SPEC);
  const { q, view, mine, arch: showArchived } = filters;
  const setQ = (v: string) => patchFilters({ q: v });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addFor, setAddFor] = useState<{ id: number; name: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Restore the shareable selected person (?c=) once on mount.
  useEffect(() => {
    const cid = Number(new URLSearchParams(window.location.search).get("c"));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cid) setSelectedId(cid);
  }, []);

  const syncUrl = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  };

  const selectView = (v: View) => patchFilters({ view: v });
  const selectPerson = (c: Contact | null) => {
    setSelectedId(c?.id ?? null);
    syncUrl({ c: c ? String(c.id) : null });
  };

  const items = useMemo(() => data?.items ?? [], [data]);
  const archivedCount = useMemo(() => items.filter((c) => !!c.archived_at).length, [items]);

  const visible = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return items.filter((c) => {
      if (!showArchived && c.archived_at) return false;
      if (mine && c.poc_owner_id !== me?.id) return false;
      if (!ql) return true;
      return [c.contact_person, c.company_name, c.designation, c.email, c.category_name].some((f) =>
        f?.toLowerCase().includes(ql),
      );
    });
  }, [items, q, mine, showArchived, me]);

  // Groups: the alphabet, or the bench at each company.
  const groups = useMemo<Group[]>(() => {
    if (view === "alpha") {
      const by = new Map<string, Contact[]>();
      for (const c of visible) {
        const l = letterOf(c.contact_person);
        if (!by.has(l)) by.set(l, []);
        by.get(l)!.push(c);
      }
      return [...by.entries()]
        .sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)))
        .map(([letter, people]) => ({
          key: letter,
          letter,
          people: people.sort((a, b) => a.contact_person.localeCompare(b.contact_person)),
        }));
    }
    const by = new Map<string, { companyId: number | null; companyName: string; people: Contact[] }>();
    for (const c of visible) {
      const name = c.company_name ?? "No company";
      if (!by.has(name)) by.set(name, { companyId: c.company_name ? c.company_id : null, companyName: name, people: [] });
      by.get(name)!.people.push(c);
    }
    return [...by.values()]
      .sort((a, b) => a.companyName.localeCompare(b.companyName))
      .map((g) => ({
        key: g.companyName,
        companyId: g.companyId,
        companyName: g.companyName,
        people: g.people.sort(
          (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.contact_person.localeCompare(b.contact_person),
        ),
      }));
  }, [visible, view]);

  const flat = useMemo(() => groups.flatMap((g) => g.people), [groups]);
  const presentLetters = useMemo(
    () => new Set(groups.filter((g) => g.letter).map((g) => g.letter!)),
    [groups],
  );

  const activePeople = useMemo(() => items.filter((c) => !c.archived_at), [items]);
  const companiesKnown = useMemo(() => new Set(activePeople.map((c) => c.company_id)).size, [activePeople]);
  const deepest = useMemo(() => {
    const by = new Map<string, number>();
    for (const c of activePeople) if (c.company_name) by.set(c.company_name, (by.get(c.company_name) ?? 0) + 1);
    let best: { name: string; count: number } | null = null;
    for (const [name, count] of by) if (!best || count > best.count) best = { name, count };
    return best;
  }, [activePeople]);

  // Keyboard: "/" finds, arrows walk the list, Enter opens the profile, Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t?.closest("input, textarea, select, [contenteditable], [role=dialog]");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing) return;
      if (e.key === "ArrowDown" || e.key === "j" || e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setSelectedId((prev) => {
          if (flat.length === 0) return prev;
          const dir = e.key === "ArrowDown" || e.key === "j" ? 1 : -1;
          const idx = flat.findIndex((c) => c.id === prev);
          const next = flat[Math.min(flat.length - 1, Math.max(0, idx === -1 ? (dir === 1 ? 0 : flat.length - 1) : idx + dir))];
          syncUrl({ c: String(next.id) });
          document
            .querySelector(`[data-person-row="${next.id}"]`)
            ?.scrollIntoView({ block: "nearest", behavior: prefersReduced() ? "auto" : "smooth" });
          return next.id;
        });
      } else if (e.key === "Enter" && selectedId) {
        router.push(`/contacts/${selectedId}`);
      } else if (e.key === "Escape" && selectedId) {
        selectPerson(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat, selectedId, router]);

  const exportCsv = () => {
    const header = [
      "Person", "Designation", "Company", "Category", "Engagement", "Email", "Phone",
      "LinkedIn", "POC", "Primary", "Connected", "Last touch", "Archived",
    ];
    const lines = [header.join(",")];
    for (const c of flat) {
      lines.push(
        [
          csvEscape(c.contact_person),
          csvEscape(c.designation),
          csvEscape(c.company_name),
          csvEscape(c.category_name),
          csvEscape(c.engagement ? ENGAGEMENT_LABEL[c.engagement] ?? c.engagement : ""),
          csvEscape(c.email),
          csvEscape(c.phone),
          csvEscape(c.linkedin),
          csvEscape(c.poc_name),
          csvEscape(c.is_primary ? "Yes" : ""),
          csvEscape(c.date_connected),
          csvEscape(c.last_contact_date),
          csvEscape(c.archived_at ? "Yes" : ""),
        ].join(","),
      );
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selected = selectedId != null ? flat.find((c) => c.id === selectedId) ?? items.find((c) => c.id === selectedId) : null;

  return (
    <div className="flex flex-col gap-4 lg:h-full">
      {/* ── Command line ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className={PAGE_TITLE} style={PAGE_TITLE_STYLE}>
            Contacts
          </h1>
          {!isLoading && !isError && items.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              The firm knows{" "}
              <span className="font-semibold tabular-nums text-foreground" style={MONO}>
                {activePeople.length}
              </span>{" "}
              people at{" "}
              <span className="font-semibold tabular-nums text-foreground" style={MONO}>
                {companiesKnown}
              </span>{" "}
              companies{mine ? " · showing yours" : ""}.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              ref={searchRef}
              type="search"
              autoComplete="off"
              spellCheck={false}
              aria-label="Find a person"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a person, company, role…"
              title="Press / to search"
              className="h-9 w-48 pl-8 transition-[width] focus:w-72 sm:w-56"
            />
          </div>
          <div
            role="group"
            aria-label="Arrange the rolodex"
            className="inline-flex w-fit items-center rounded-lg bg-muted p-[3px] text-sm text-muted-foreground"
          >
            {(
              [
                { id: "alpha", label: "A–Z" },
                { id: "company", label: "Companies" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                aria-pressed={view === t.id}
                onClick={() => selectView(t.id)}
                className={cn(
                  "inline-flex h-7 items-center rounded-md border border-transparent px-3 font-medium outline-none transition-all focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  view === t.id
                    ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30"
                    : "hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button
            variant={mine ? "secondary" : "outline"}
            size="sm"
            className="h-9"
            onClick={() => patchFilters({ mine: !mine })}
            aria-pressed={mine}
            title="Only people whose relationship you own"
          >
            Mine
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="icon" aria-label="More tools" />
              }
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={exportCsv}>
                <Download className="h-4 w-4 text-muted-foreground" aria-hidden /> Export CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => patchFilters({ arch: !showArchived })}>
                <Archive className="h-4 w-4 text-muted-foreground" aria-hidden />
                {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden /> Add person
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      {isError ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card py-16 text-center">
          <AlertTriangle className="h-6 w-6 text-amber-500" aria-hidden />
          <p className="text-sm font-medium">Couldn&rsquo;t load the rolodex.</p>
          <button onClick={() => refetch()} className="text-xs font-medium text-primary-ink hover:underline">
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col gap-1 pt-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <div key={n} className="flex items-center gap-3 px-3 py-2">
              <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-1/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
            <BookUser className="h-5 w-5 text-primary-ink/50" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-medium">The rolodex is empty</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Every analyst&rsquo;s contacts land here — one shared book of who the firm knows.
              People are captured when you log replies, calls, and meetings, or add them yourself.
            </p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden /> Add the first person
          </Button>
        </div>
      ) : (
        <div className="flex items-start gap-5 lg:min-h-0 lg:flex-1 lg:items-stretch">
          {/* ── The list (its own scroll column at lg — the pane never moves) ── */}
          <div className="flex min-w-0 flex-1 items-start gap-1.5 lg:h-full lg:overflow-y-auto lg:pr-1">
            {/* role="group", not role="list": the rows are selectable buttons
                grouped under company/letter headings, and a list may only contain
                listitems (axe aria-required-children). */}
            <div className="min-w-0 flex-1" role="group" aria-label="People">
              {flat.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <Users className="h-6 w-6 text-muted-foreground" aria-hidden />
                  {q.trim() ? (
                    <>
                      <p className="text-sm font-medium">No one matches &ldquo;{q.trim()}&rdquo;.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-1"
                        onClick={() => setAddOpen(true)}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" aria-hidden /> Add &ldquo;{q.trim()}&rdquo; as a new person
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium">
                        {mine ? "None of these people are yours." : "Everyone here is archived."}
                      </p>
                      <button
                        onClick={() => (mine ? patchFilters({ mine: false }) : patchFilters({ arch: true }))}
                        className="text-xs font-medium text-primary-ink hover:underline"
                      >
                        {mine ? "Show everyone" : "Show archived"}
                      </button>
                    </>
                  )}
                </div>
              ) : (
                groups.map((g) => (
                  <section key={g.key} id={g.letter ? `rolo-${g.letter}` : undefined} className="scroll-mt-2">
                    {g.letter ? (
                      <LetterDivider letter={g.letter} />
                    ) : (
                      <CompanyDivider
                        name={g.companyName!}
                        companyId={g.companyId ?? null}
                        count={g.people.length}
                        onAdd={
                          g.companyId != null
                            ? () => setAddFor({ id: g.companyId!, name: g.companyName! })
                            : null
                        }
                      />
                    )}
                    <div className="flex flex-col py-0.5">
                      {g.people.map((c) => (
                        <PersonRow
                          key={c.id}
                          c={c}
                          active={c.id === selectedId}
                          showCompany={view === "alpha"}
                          onSelect={selectPerson}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
            {view === "alpha" && flat.length > 0 && <RolodexRail present={presentLetters} />}
          </div>

          {/* ── The reading pane (desktop) — full height, anchored, scrolls itself ── */}
          <aside className="hidden w-[360px] shrink-0 lg:block xl:w-[400px]">
            <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {selected ? (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <PersonPanel key={selected.id} contactId={selected.id} onClose={() => selectPerson(null)} />
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto">
                  <IdleCard people={activePeople.length} companies={companiesKnown} deepest={deepest} />
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ── The person card (mobile sheet) ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            aria-label="Close"
            onClick={() => selectPerson(null)}
            className="flex-1 bg-black/40 backdrop-blur-[2px]"
          />
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card shadow-xl duration-200 animate-in slide-in-from-right-4">
            <PersonPanel key={selected.id} contactId={selected.id} onClose={() => selectPerson(null)} />
          </div>
        </div>
      )}

      {addOpen && (
        <ContactDialog open onOpenChange={setAddOpen} trigger={null} initialName={flat.length === 0 && q.trim() ? q.trim() : undefined} />
      )}
      {addFor && (
        <ContactDialog
          companyId={addFor.id}
          open
          onOpenChange={(o) => !o && setAddFor(null)}
          trigger={null}
        />
      )}
    </div>
  );
}
