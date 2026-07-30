"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import {
  ArrowRight,
  BookmarkPlus,
  ChevronDown,
  FlaskConical,
  Loader2,
  Mail,
  Sparkles,
  X,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useContacts } from "@/hooks/use-contacts";
import {
  useCreateTemplate,
  useDraftEmail,
  useEmailAccount,
  useEmailTemplates,
  useSendEmail,
  type EmailTemplate,
  type TemplateKind,
} from "@/hooks/use-email";
import type { ScheduleRow } from "@/hooks/use-schedule";
import { EmailConnectPanel } from "@/components/features/email-connect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MandateType } from "@/types";

const DISPLAY = { fontFamily: "var(--font-display)" };
const MONO = { fontFamily: "var(--font-mono)" };

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DEAL_SHORT: Record<MandateType, string> = {
  SELL_SIDE: "Sell-side",
  BUY_SIDE: "Buy-side",
  CAPITAL_RAISE: "Capital raise",
};

const KIND_LABEL: Record<TemplateKind, string> = {
  INITIAL: "Intro",
  FOLLOW_UP: "Follow-up",
  BUMP: "Bump",
  BREAKUP: "Breakup",
};

const SPAM_TRIGGERS = [
  "free money",
  "guarantee",
  "act now",
  "limited time",
  "winner",
  "risk-free",
  "100% ",
  "click here",
  "!!!",
];

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return iso;
  return `${d} ${MONTH[m - 1]}`;
}

function firstNameOf(full: string | null | undefined): string | null {
  return full?.trim().split(/\s+/)[0] ?? null;
}

/** Substitute {{variables}} with concrete values (unknowns are left visible). */
function fillTemplate(text: string, vars: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (raw, key: string) => {
    const v = vars[key];
    return v && v.trim() ? v : raw;
  });
}

/** Reverse of fillTemplate — turn concrete names back into variables so a written
 *  email saves as a reusable template. */
function unfillTemplate(text: string, vars: Record<string, string | null | undefined>): string {
  let out = text;
  for (const [key, value] of Object.entries(vars)) {
    if (value && value.trim().length > 2) {
      out = out.split(value).join(`{{${key}}}`);
    }
  }
  return out;
}

// ── Send health — honest client-side lint, never a fake score ──────────────────

interface HealthCheck {
  key: string;
  label: string;
  ok: boolean;
  hint: string;
}

function healthChecks(
  subject: string,
  body: string,
  contactFirstName: string | null,
): HealthCheck[] {
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const links = (body.match(/https?:\/\//g) ?? []).length;
  const subjectTrim = subject.trim();
  const lowered = `${subjectTrim} ${body}`.toLowerCase();
  const spamHit = SPAM_TRIGGERS.find((w) => lowered.includes(w));
  const allCaps = subjectTrim.length > 6 && subjectTrim === subjectTrim.toUpperCase();

  return [
    {
      key: "personal",
      label: "Personal",
      ok: contactFirstName ? body.includes(contactFirstName) : body.trim().length > 0,
      hint: contactFirstName
        ? `Greet ${contactFirstName} by name — personal mail lands in Primary`
        : "Write the body",
    },
    {
      key: "length",
      label: "Length",
      ok: words >= 30 && words <= 180,
      hint:
        words < 30
          ? `${words} words — a touch short to feel substantive`
          : `${words} words — tighten to under ~180`,
    },
    {
      key: "links",
      label: "Links",
      ok: links <= 2,
      hint: `${links} links — heavy linking reads as a blast`,
    },
    {
      key: "subject",
      label: "Subject",
      ok: subjectTrim.length > 0 && subjectTrim.length <= 78 && !allCaps && !spamHit,
      hint: !subjectTrim
        ? "Write a subject"
        : allCaps
          ? "All-caps subjects trip spam filters"
          : spamHit
            ? `“${spamHit.trim()}” is a spam trigger phrase`
            : "Keep the subject under ~78 characters",
    },
  ];
}

function SendHealth({ checks }: { checks: HealthCheck[] }) {
  const firstIssue = checks.find((c) => !c.ok);
  return (
    <div
      className="flex min-w-0 items-center gap-2"
      title={checks.map((c) => `${c.ok ? "✓" : "•"} ${c.label}: ${c.ok ? "ok" : c.hint}`).join("\n")}
    >
      <span className="flex items-center gap-1" aria-hidden>
        {checks.map((c) => (
          <span
            key={c.key}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              c.ok ? "bg-emerald-500" : "bg-amber-500",
            )}
          />
        ))}
      </span>
      <span className="truncate text-[11px] text-muted-foreground">
        {firstIssue ? firstIssue.hint : "Reads like a personal 1-to-1 email"}
      </span>
    </div>
  );
}

// ── The sheet ──────────────────────────────────────────────────────────────────

interface Props {
  row: ScheduleRow;
  dealName?: string;
  dealType?: MandateType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once per successful send (before the sheet closes). */
  onSent?: () => void;
}

export function ComposeEmailSheet({
  row,
  dealName,
  dealType,
  open,
  onOpenChange,
  onSent,
}: Props) {
  const { user } = useAuth();
  const { data: account } = useEmailAccount();
  const { data: contactsData } = useContacts(open ? { company_id: row.company_id } : {});
  const { data: templatesData } = useEmailTemplates(open);
  const send = useSendEmail();
  const draft = useDraftEmail();
  const createTemplate = useCreateTemplate();

  const awaiting = row.schedule_status === "AWAITING_INITIAL";
  const eventType = awaiting ? "INITIAL_EMAIL" : "FOLLOW_UP";
  const contacts = useMemo(
    () => (contactsData?.items ?? []).filter((c) => !!c.email),
    [contactsData],
  );

  // ── Compose state ──
  const [toChoice, setToChoice] = useState<string>("");
  const [customEmail, setCustomEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [notes, setNotes] = useState("");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTone, setAiTone] = useState<"direct" | "warm" | "formal">("direct");
  const [aiInstructions, setAiInstructions] = useState("");
  const [aiDrafted, setAiDrafted] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveKind, setSaveKind] = useState<TemplateKind>(awaiting ? "INITIAL" : "FOLLOW_UP");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Reset per company; preselect the primary contact once contacts arrive.
  useEffect(() => {
    if (!open) return;
    setSubject("");
    setBody("");
    setNotes("");
    setTemplateId(null);
    setAiDrafted(false);
    setAiOpen(false);
    setSaveOpen(false);
    setCustomEmail("");
    setToChoice("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row.company_id]);

  useEffect(() => {
    if (!open || toChoice !== "") return;
    const primary = row.primary_contact?.email
      ? contacts.find((c) => c.id === row.primary_contact!.id)
      : undefined;
    const pick = primary ?? contacts[0];
    if (pick) setToChoice(String(pick.id));
    else if (contactsData) setToChoice("custom");
  }, [open, toChoice, contacts, contactsData, row.primary_contact]);

  const chosenContact = useMemo(
    () => (toChoice && toChoice !== "custom" ? contacts.find((c) => String(c.id) === toChoice) : undefined),
    [toChoice, contacts],
  );
  const toEmail = chosenContact?.email ?? customEmail.trim();
  const contactFirst = firstNameOf(chosenContact?.contact_person);

  const vars: Record<string, string | null | undefined> = {
    first_name: contactFirst,
    full_name: chosenContact?.contact_person,
    company: row.company_name,
    designation: chosenContact?.designation,
    deal: dealName,
    sender_name: firstNameOf(account?.display_name ?? user?.full_name),
    firm: user?.firm?.name,
  };

  const applyTemplate = (tpl: EmailTemplate) => {
    setSubject(fillTemplate(tpl.subject, vars));
    setBody(fillTemplate(tpl.body, vars));
    setTemplateId(tpl.id);
    setAiDrafted(false);
    toast.success(`Template applied — ${tpl.name}`);
  };

  const insertVar = (value: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + value + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + value.length, start + value.length);
    });
  };

  const runDraft = async () => {
    try {
      const result = await draft.mutateAsync({
        company_id: row.company_id,
        contact_id: chosenContact?.id ?? null,
        kind: eventType,
        tone: aiTone,
        instructions: aiInstructions.trim() || undefined,
      });
      setSubject(result.subject);
      setBody(result.body);
      setAiDrafted(true);
      setAiOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Drafting failed");
    }
  };

  const checks = useMemo(
    () => healthChecks(subject, body, contactFirst),
    [subject, body, contactFirst],
  );

  const limitReached = (account?.sends_today ?? 0) >= (account?.daily_send_limit ?? Infinity);
  const canSend =
    !!account?.connected && !!toEmail && !!subject.trim() && !!body.trim() && !limitReached;

  const doSend = async () => {
    if (!canSend) return;
    try {
      const result = await send.mutateAsync({
        company_id: row.company_id,
        to_email: toEmail,
        subject: subject.trim(),
        body,
        contact_id: chosenContact?.id ?? null,
        event_type: eventType,
        notes: notes.trim() || undefined,
        template_id: templateId,
      });
      toast.success(
        result.status === "SIMULATED"
          ? `Simulated send to ${toEmail} — ${awaiting ? "intro" : "follow-up"} logged`
          : `Sent to ${toEmail} — ${awaiting ? "intro" : "follow-up"} logged`,
      );
      onSent?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    }
  };

  const saveTemplate = async () => {
    if (!saveName.trim() || !subject.trim() || !body.trim()) {
      toast.error("Name, subject, and body are needed to save a template");
      return;
    }
    try {
      await createTemplate.mutateAsync({
        name: saveName.trim(),
        kind: saveKind,
        subject: unfillTemplate(subject.trim(), vars),
        body: unfillTemplate(body, vars),
      });
      toast.success(`Template saved — ${saveName.trim()}`);
      setSaveOpen(false);
      setSaveName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save template");
    }
  };

  const dirty = subject.trim().length > 0 || body.trim().length > 0;
  // Deliberately still `window.confirm`: this guards an unsaved draft inside a
  // synchronous onOpenChange, not a destructive action against saved data, and
  // stacking the app's confirm dialog over this z-50 sheet portal buys nothing.
  const guardedOpenChange = (next: boolean) => {
    if (!next && dirty && !send.isPending) {
      if (!window.confirm("Discard this draft?")) return;
    }
    onOpenChange(next);
  };

  // Cadence-truth strip — the analyst never loses the queue context.
  const cadenceBits: string[] = [];
  cadenceBits.push(
    awaiting
      ? "First outreach — clock starts on send"
      : row.days_remaining == null
        ? "No next date"
        : row.days_remaining < 0
          ? `${Math.abs(row.days_remaining)}d overdue`
          : row.days_remaining === 0
            ? "Due today"
            : `Due in ${row.days_remaining}d`,
  );
  if (dealName) cadenceBits.push(dealType ? `${dealName} · ${DEAL_SHORT[dealType]}` : dealName);
  if (row.last_event_date) cadenceBits.push(`Last touch ${fmtDate(row.last_event_date)}`);

  const templates = templatesData?.items ?? [];
  const connected = !!account?.connected;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={guardedOpenChange}>
      <DialogPrimitive.Portal>
        {/* z-50 everywhere on purpose: body-appended portals paint in DOM order, so
            this sheet sits above the inline focus-mode scrim (also z-50) and the
            later-opened dropdown/dialog portals sit above the sheet. */}
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 duration-150 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="sheet-pane fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l border-border bg-card text-sm shadow-2xl outline-none sm:max-w-[600px]">
          {/* ── Envelope header ── */}
          <div className="border-b border-border px-5 pb-4 pt-5 sm:px-7">
            <div className="flex items-start justify-between gap-3">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-ink">
                <Mail className="h-3.5 w-3.5" aria-hidden />
                {awaiting ? "New email · Introduction" : "New email · Follow-up"}
              </p>
              <DialogPrimitive.Close
                aria-label="Close compose"
                className="rounded-md p-1 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" aria-hidden />
              </DialogPrimitive.Close>
            </div>
            <DialogPrimitive.Title
              className="mt-1.5 truncate text-[26px] font-semibold leading-tight tracking-tight"
              style={{ ...DISPLAY, letterSpacing: "-0.02em" }}
            >
              {row.company_name}
            </DialogPrimitive.Title>
            <p className="mt-1 truncate text-xs text-muted-foreground" style={MONO}>
              {cadenceBits.join("  ·  ")}
            </p>
          </div>

          {!connected ? (
            /* ── Not connected — the sheet becomes the connect moment ── */
            <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
              <h3 className="text-base font-semibold" style={DISPLAY}>
                Connect your mailbox to send from the desk
              </h3>
              <p className="mb-4 mt-1 text-xs text-muted-foreground">
                One connection, then every follow-up is written, sent, and logged in one step.
              </p>
              <EmailConnectPanel compact />
            </div>
          ) : (
            <>
              {/* ── Address + message ── */}
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-7">
                {/* To / From */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-11 shrink-0 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      To
                    </span>
                    {contacts.length > 0 ? (
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <select
                          value={toChoice}
                          onChange={(e) => setToChoice(e.target.value)}
                          aria-label="Recipient"
                          className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
                        >
                          {contacts.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.contact_person}
                              {c.designation ? ` · ${c.designation}` : ""}
                            </option>
                          ))}
                          <option value="custom">Another address…</option>
                        </select>
                        {chosenContact?.email && (
                          <span className="hidden max-w-[200px] truncate text-xs text-muted-foreground sm:block" style={MONO}>
                            {chosenContact.email}
                          </span>
                        )}
                      </div>
                    ) : null}
                    {(toChoice === "custom" || contacts.length === 0) && (
                      <Input
                        type="email"
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                        placeholder="name@company.com"
                        aria-label="Recipient email"
                        className={cn("h-9", contacts.length > 0 ? "w-48" : "flex-1")}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-11 shrink-0 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      From
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="truncate" style={MONO}>{account?.email_address}</span>
                      {account?.provider === "SANDBOX" && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/[0.08] px-1.5 py-px text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                          <FlaskConical className="h-2.5 w-2.5" aria-hidden /> Simulated
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject"
                    aria-label="Subject"
                    className="h-10 border-x-0 border-t-0 border-b border-input bg-transparent px-0 text-[15px] font-medium shadow-none focus-visible:ring-0 rounded-none focus-visible:border-primary"
                  />
                </div>

                {/* Assist row */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="outline" size="sm" className="h-7 gap-1 px-2.5 text-xs" />}
                    >
                      Template <ChevronDown className="h-3 w-3" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
                      {templates.length === 0 && (
                        // Grouped: a bare Base UI GroupLabel throws, so this menu
                        // used to break in exactly the no-templates-yet state.
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                            No templates yet — write an email and save it as one.
                          </DropdownMenuLabel>
                        </DropdownMenuGroup>
                      )}
                      {templates.map((t) => (
                        <DropdownMenuItem key={t.id} onClick={() => applyTemplate(t)}>
                          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                            <span className="truncate">{t.name}</span>
                            <span className="shrink-0 rounded bg-muted px-1 text-[10px] font-medium text-muted-foreground">
                              {KIND_LABEL[t.kind]}
                            </span>
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {account?.ai_drafting && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAiOpen((v) => !v)}
                      aria-expanded={aiOpen}
                      className={cn(
                        "h-7 gap-1.5 px-2.5 text-xs",
                        aiOpen && "border-primary/50 bg-primary/[0.06] text-primary-ink",
                      )}
                    >
                      <Sparkles className="h-3 w-3" aria-hidden /> Draft with AI
                    </Button>
                  )}

                  <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
                  {[
                    { label: contactFirst ?? "First name", value: contactFirst },
                    { label: row.company_name, value: row.company_name },
                  ].map(
                    (chip) =>
                      chip.value && (
                        <button
                          key={chip.label}
                          onClick={() => insertVar(chip.value!)}
                          title="Insert at cursor"
                          className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {chip.label}
                        </button>
                      ),
                  )}
                </div>

                {/* AI panel */}
                {aiOpen && (
                  <div className="space-y-2.5 rounded-xl border border-primary/25 bg-primary/[0.04] p-3 duration-200 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-1.5">
                      {(["direct", "warm", "formal"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setAiTone(t)}
                          aria-pressed={aiTone === t}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-medium capitalize outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                            aiTone === t
                              ? "bg-primary text-primary-foreground"
                              : "border border-border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <Input
                      value={aiInstructions}
                      onChange={(e) => setAiInstructions(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !draft.isPending && runDraft()}
                      placeholder="Optional steer — e.g. mention their Pune expansion"
                      className="h-8 bg-background text-xs"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground">
                        Drafts from real deal context — cadence, touches, notes. You edit, you send.
                      </p>
                      <Button size="sm" className="h-7 gap-1.5 px-3 text-xs" onClick={runDraft} disabled={draft.isPending}>
                        {draft.isPending ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Drafting…
                          </>
                        ) : (
                          "Generate"
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Body */}
                <div>
                  <textarea
                    ref={bodyRef}
                    value={body}
                    onChange={(e) => {
                      setBody(e.target.value);
                      setAiDrafted(false);
                    }}
                    rows={11}
                    placeholder={
                      awaiting
                        ? "Introduce the opportunity — short, specific, one clear ask…"
                        : "Move the conversation forward — one new angle, one clear ask…"
                    }
                    aria-label="Email body"
                    className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm leading-relaxed outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
                  />
                  {aiDrafted && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Sparkles className="h-3 w-3 text-primary-ink" aria-hidden />
                      AI draft — read it as the recipient before you send.
                    </p>
                  )}
                </div>

                {/* Signature preview */}
                {account?.signature && (
                  <div className="rounded-lg border border-dashed border-border px-3 py-2">
                    <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                      {account.signature}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Signature — appended on send · edit in Settings
                    </p>
                  </div>
                )}

                {/* Private note → the outreach log, not the email */}
                <div>
                  <Label htmlFor="compose-note" className="text-xs text-muted-foreground">
                    Private note on the log (optional)
                  </Label>
                  <Input
                    id="compose-note"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Visible to your team, never sent"
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </div>

              {/* ── Footer ── */}
              <div className="border-t border-border bg-muted/30 px-5 py-3 sm:px-7">
                <div className="flex items-center justify-between gap-3">
                  <SendHealth checks={checks} />
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground" style={MONO}>
                    {account?.sends_today ?? 0}/{account?.daily_send_limit ?? "—"} today
                  </span>
                </div>
                {limitReached && (
                  <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                    Daily send limit reached — pacing keeps your mail out of spam. Raise it in Settings.
                  </p>
                )}
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs text-muted-foreground"
                    onClick={() => setSaveOpen(true)}
                    disabled={!subject.trim() || !body.trim()}
                    title="Save this email as a reusable template"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" aria-hidden /> Save as template
                  </Button>
                  <Button className="h-9 gap-1.5 px-5" onClick={doSend} disabled={!canSend || send.isPending}>
                    {send.isPending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Sending…
                      </>
                    ) : (
                      <>
                        {awaiting ? "Send intro & start clock" : "Send & log follow-up"}
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>

      {/* Save-as-template mini dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. Warm second follow-up"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="tpl-kind">Kind</Label>
              <select
                id="tpl-kind"
                value={saveKind}
                onChange={(e) => setSaveKind(e.target.value as TemplateKind)}
                className="mt-1.5 h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {Object.entries(KIND_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              Names and the company are converted to variables automatically, so this template
              works for any deal.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveTemplate} disabled={createTemplate.isPending}>
                {createTemplate.isPending ? "Saving…" : "Save template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DialogPrimitive.Root>
  );
}
