"use client";

/**
 * The company peek — inspect a record without leaving the list.
 *
 * The behaviour this exists to kill: an analyst has 47 overdue companies filtered,
 * sorted and scrolled to row 30, clicks one to check what happened last time, and is
 * navigated to a full page. Coming back costs a browser-back, a refetch, a re-scroll,
 * and — before the URL carried the view — rebuilding the filter by hand. Nobody works
 * through a queue twice like that; they work through five and give up.
 *
 * So the panel is an *overlay on the same route*. The list underneath keeps its scroll,
 * its expansion, its selection and its filters, because it is never unmounted. The open
 * record lives in `?peek=`, so the panel is linkable and survives a reload.
 *
 * It answers, in order, the questions the brief lists: who is this, where does it sit,
 * who do we know, what happened, what is scheduled, what work is attached, and what can
 * I do right now. The full dossier is one click away for everything else — this is
 * deliberately not a second company page.
 */

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  Building2,
  CheckSquare,
  ExternalLink,
  Mail,
  Phone,
  X,
} from "lucide-react";

import { LogOutreachDialog } from "@/components/features/log-outreach-dialog";
import { useProjectShell } from "@/components/project/project-context";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/hooks/use-companies";
import { useCompanyActivity } from "@/hooks/use-activity";
import { useTasks } from "@/hooks/use-tasks";
import {
  AWAITING_INK,
  DEAL_TYPE_SHORT,
  DEAL_TYPE_STYLE,
  INK_LINK,
  LABEL,
  LATE_TOKEN,
  MONO,
  STATUS_META,
} from "@/lib/design";
import { fmtDate, relativeTime } from "@/lib/format";
import { phraseFor, verbMeta } from "@/lib/activity";
import { eventLabel } from "@/lib/outreach-timeline";
import { priorityOf, cadenceOf, CADENCE_LABEL } from "@/lib/project-views";
import { sortTasks } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import type { Company } from "@/types";

/* ── Small parts ───────────────────────────────────────────────────────────── */

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className={LABEL}>{label}</p>
      <div className="mt-1 min-w-0 text-xs text-foreground">{children}</div>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className={LABEL}>{title}</h3>
        {action}
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

const dash = <span className="text-muted-foreground">—</span>;

/* ── Why now ───────────────────────────────────────────────────────────────── */

/**
 * The priority, stated as its reasons.
 *
 * The brief asked for no black-box score and it is the right call, so there is no
 * number on screen at all: the score exists only to order the queue, and what the panel
 * shows is the list of facts that produced it, each one a field the server computed and
 * the analyst can check.
 */
function WhyNow({ company }: { company: Company }) {
  const { reasons } = priorityOf(company);
  if (reasons.length === 0) return null;

  // Weight carries the tone: the reason that is costing time is heaviest, a reply is
  // firm, a first email that never went out is provisional, context recedes. The first
  // reason is the one that put the company here, so its mark is solid.
  const ink = {
    danger: "font-semibold text-foreground",
    awaiting: AWAITING_INK,
    positive: "font-medium text-foreground",
    neutral: "text-muted-foreground",
  } as const;

  return (
    <div className="border-y border-border bg-muted/60 px-4 py-3">
      <p className={LABEL}>Why this is on the list</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {reasons.map((r, i) => (
          <li key={r.label} className={cn("flex items-center gap-1.5 text-xs", ink[r.tone])}>
            <span
              className={cn("size-1.5 shrink-0 rounded-full", i === 0 ? "bg-foreground" : "bg-ink-300")}
              aria-hidden
            />
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── The panel ─────────────────────────────────────────────────────────────── */

export function CompanyPeek({
  companyId,
  row,
  onClose,
}: {
  companyId: number;
  /** The list's own copy, so the panel paints instantly and then fills in. */
  row: Company | undefined;
  onClose: () => void;
}) {
  const { engagements } = useProjectShell();
  const { data: detail, isLoading } = useCompany(companyId);
  const { data: tasksData } = useTasks({ company_id: companyId });
  const { data: activity } = useCompanyActivity(companyId);
  const reduce = useReducedMotion();

  const c = detail ?? row;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const engagement = useMemo(
    () => engagements.find((e) => e.id === c?.mandate_id),
    [engagements, c?.mandate_id],
  );

  const openTasks = useMemo(
    () => sortTasks((tasksData?.items ?? []).filter((t) => t.status !== "DONE")),
    [tasksData],
  );

  // The last thing that actually happened to this company, from the outreach log —
  // not from `updated_at`, which moves when somebody fixes a typo in the HQ.
  const lastEvent = useMemo(() => {
    const events = detail?.events ?? [];
    return events.length ? events[events.length - 1] : null;
  }, [detail]);

  if (!c) return null;

  const status = STATUS_META[c.status] ?? STATUS_META.NOT_CONTACTED;
  const awaiting = c.schedule_status === "AWAITING_INITIAL";
  const running = !c.is_cold && (c.schedule_status === "ACTIVE" || awaiting);
  const contact = detail?.contacts?.find((k) => k.is_primary) ?? null;
  const fallbackContact = c.primary_contact;

  return (
    <motion.aside
      role="complementary"
      aria-label={`${c.company_name} details`}
      initial={reduce ? { opacity: 0 } : { x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={reduce ? { opacity: 0 } : { x: 24, opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="flex w-full shrink-0 flex-col overflow-y-auto bg-card lg:w-[26rem] lg:border-l lg:border-border"
      data-testid="company-peek"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-card px-4 pb-3 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
              {c.company_name}
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {c.hq && <span className="truncate">{c.hq}</span>}
              <span className="inline-flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} aria-hidden />
                {status.label}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the details panel"
            className="-mr-1 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Actions sit with the identity, not at the bottom of a scroll. */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {running && (
            <LogOutreachDialog
              companyId={c.id}
              companyName={c.company_name}
              defaultEventType={awaiting ? "INITIAL_EMAIL" : "FOLLOW_UP"}
              trigger={
                <Button size="sm" className="h-7 px-2.5 text-xs">
                  {awaiting ? "Send intro" : "Log follow-up"}
                </Button>
              }
            />
          )}
          {running && (
            <LogOutreachDialog
              companyId={c.id}
              companyName={c.company_name}
              defaultEventType="RESPONSE"
              trigger={
                <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs">
                  Mark replied
                </Button>
              }
            />
          )}
          <Link href={`/companies/${c.id}`}>
            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs">
              Open dossier
              <ArrowUpRight className="ml-1 h-3.5 w-3.5" aria-hidden />
            </Button>
          </Link>
        </div>
      </header>

      <WhyNow company={c} />

      {/* ── Where it sits ──────────────────────────────────────────────── */}
      <Section title="In this project">
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          <Field label="Engagement" className="col-span-2">
            {engagement ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className={cn(
                    "shrink-0 rounded-[3px] px-1 text-[10px] font-medium leading-4",
                    DEAL_TYPE_STYLE[engagement.type],
                  )}
                >
                  {DEAL_TYPE_SHORT[engagement.type]}
                </span>
                <span className="truncate">{engagement.name}</span>
              </span>
            ) : (
              dash
            )}
          </Field>
          <Field label="Band">{c.sourcing_layer_name ?? dash}</Field>
          <Field label="Category">{c.category_name ?? dash}</Field>
        </div>
      </Section>

      {/* ── Who we know ────────────────────────────────────────────────── */}
      <Section
        title="Relationship"
        action={
          <Link
            href={`/companies/${c.id}`}
            className={cn(INK_LINK, "text-[11px]")}
          >
            Manage contacts
          </Link>
        }
      >
        {contact || fallbackContact ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {contact?.contact_person ?? fallbackContact?.contact_person}
            </p>
            {contact?.designation && (
              <p className="truncate text-xs text-muted-foreground">{contact.designation}</p>
            )}
            <div className="mt-1.5 flex flex-col gap-1">
              {(contact?.email ?? fallbackContact?.email) && (
                <a
                  href={`mailto:${contact?.email ?? fallbackContact?.email}`}
                  className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Mail className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">{contact?.email ?? fallbackContact?.email}</span>
                </a>
              )}
              {contact?.phone && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3 shrink-0" aria-hidden />
                  {contact.phone}
                </span>
              )}
            </div>
            {(detail?.contacts?.length ?? 0) > 1 && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                +{detail!.contacts.length - 1} other{" "}
                {detail!.contacts.length - 1 === 1 ? "contact" : "contacts"} on file
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nobody to email here — the cadence cannot run without a contact.{" "}
            <Link href={`/companies/${c.id}`} className={INK_LINK}>
              Add one
            </Link>
            .
          </p>
        )}
      </Section>

      {/* ── The clock ──────────────────────────────────────────────────── */}
      <Section title="Outreach">
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          <Field label="Cadence">
            <span
              className={cn(
                c.is_cold && "text-muted-foreground",
                awaiting && AWAITING_INK,
              )}
            >
              {CADENCE_LABEL[cadenceOf(c)]}
              {c.cycle_number && c.cycle_number > 1 && (
                <span className="text-muted-foreground"> · cycle {c.cycle_number}</span>
              )}
            </span>
          </Field>
          <Field label="Next touch">
            {c.is_overdue ? (
              <span className={LATE_TOKEN} style={MONO}>
                {Math.abs(c.days_remaining ?? 0)}d late
              </span>
            ) : c.next_due_date ? (
              <span style={MONO}>{fmtDate(c.next_due_date)}</span>
            ) : (
              dash
            )}
          </Field>
          <Field label="First email">
            {c.initial_date ? <span style={MONO}>{fmtDate(c.initial_date)}</span> : "Not sent"}
          </Field>
          <Field label="Last touch">
            {lastEvent ? (
              <span>
                {eventLabel(lastEvent.event_type)}{" "}
                <span className="text-muted-foreground" style={MONO}>
                  {fmtDate(lastEvent.occurred_on)}
                </span>
              </span>
            ) : isLoading ? (
              <span className="inline-block h-3 w-16 animate-pulse rounded bg-ink-100" />
            ) : (
              dash
            )}
          </Field>
        </div>

        {(detail?.events?.length ?? 0) > 0 && (
          <ol className="mt-3 flex flex-col gap-1 border-t border-border pt-2.5">
            {detail!.events
              .slice(-4)
              .reverse()
              .map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate text-foreground">{eventLabel(e.event_type)}</span>
                  <span
                    className="shrink-0 tabular-nums text-[11px] text-muted-foreground"
                    style={MONO}
                  >
                    {fmtDate(e.occurred_on)}
                  </span>
                </li>
              ))}
          </ol>
        )}
      </Section>

      {/* ── Declared work ──────────────────────────────────────────────── */}
      <Section title={`Open work${openTasks.length ? ` · ${openTasks.length}` : ""}`}>
        {openTasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tasks attached.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {openTasks.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <CheckSquare
                    className="h-3 w-3 shrink-0 translate-y-0.5 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="truncate text-foreground">{t.title}</span>
                </span>
                {t.due_date && (
                  <span
                    className={cn(
                      "shrink-0 tabular-nums text-[11px]",
                      t.is_overdue ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                    style={MONO}
                  >
                    {fmtDate(t.due_date)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── What changed ───────────────────────────────────────────────── */}
      <Section title="Recent activity">
        {!activity ? (
          <div className="flex flex-col gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-3 w-full animate-pulse rounded bg-ink-100" />
            ))}
          </div>
        ) : activity.items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing logged against this record yet.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {activity.items.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-baseline gap-2 text-xs">
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">{e.actor_name ?? "Someone"}</span>{" "}
                  <span className="text-muted-foreground">{phraseFor(e)}</span>
                </span>
                <span
                  className="shrink-0 text-[11px] text-muted-foreground"
                  title={verbMeta(e.verb).phrase}
                >
                  {relativeTime(e.created_at)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* ── The rest of the record ─────────────────────────────────────── */}
      <div className="mt-auto border-t border-border px-4 py-3">
        <Link
          href={`/companies/${c.id}`}
          className={cn(INK_LINK, "inline-flex items-center gap-1.5 text-xs")}
        >
          <Building2 className="h-3.5 w-3.5" aria-hidden />
          Full dossier — revenue, every contact, the whole outreach log
          <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </motion.aside>
  );
}

export function CompanyPeekHost({
  companyId,
  row,
  onClose,
}: {
  companyId: number | null;
  row: Company | undefined;
  onClose: () => void;
}) {
  /*
   * One panel, whose contents change — not one panel per record.
   *
   * Keying this on `companyId` made every step through the queue an unmount and a
   * mount, and `AnimatePresence` holds the outgoing element for the length of its exit:
   * two panels side by side, the register squeezed to half width between them, on every
   * press of ↓. The slide belongs to opening and closing the panel, which is what the
   * presence boundary is for; moving to the next company is the same panel showing
   * something else, and it should not animate at all.
   */
  return (
    <AnimatePresence>
      {companyId != null && (
        <CompanyPeek key="peek" companyId={companyId} row={row} onClose={onClose} />
      )}
    </AnimatePresence>
  );
}
