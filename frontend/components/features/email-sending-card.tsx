"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useConfirm } from "@/components/features/confirm-dialog";
import { FlaskConical, Mail, Pencil, Plus, Trash2, Users2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import {
  useDeleteTemplate,
  useCreateTemplate,
  useDisconnectEmail,
  useEmailAccount,
  useEmailTemplates,
  useUpdateEmailAccount,
  useUpdateTemplate,
  type EmailTemplate,
  type TemplateKind,
} from "@/hooks/use-email";
import { EmailConnectPanel, GmailGlyph, OutlookGlyph } from "@/components/features/email-connect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<TemplateKind, string> = {
  INITIAL: "Intro",
  FOLLOW_UP: "Follow-up",
  BUMP: "Bump",
  BREAKUP: "Breakup",
};

// The intro is the anchor of every sequence, so it is the one inverted kind; the rest
// step lighter the further into the sequence they sit.
const KIND_STYLE: Record<TemplateKind, string> = {
  INITIAL: "bg-info-soft text-info-ink ring-1 ring-inset ring-info-line",
  FOLLOW_UP: "bg-muted text-foreground ring-1 ring-inset ring-border",
  BUMP: "bg-card text-foreground ring-1 ring-inset ring-border",
  BREAKUP: "bg-ink-200 text-foreground",
};

// ── Account card ───────────────────────────────────────────────────────────────

export function EmailSendingCard() {
  const { data: account, isLoading } = useEmailAccount();
  const update = useUpdateEmailAccount();
  const disconnect = useDisconnectEmail();
  const confirm = useConfirm();

  const [signature, setSignature] = useState("");
  const [limit, setLimit] = useState<number>(50);

  useEffect(() => {
    if (account?.connected) {
      setSignature(account.signature ?? "");
      setLimit(account.daily_send_limit);
    }
  }, [account]);

  const dirty =
    !!account?.connected &&
    (signature !== (account.signature ?? "") || limit !== account.daily_send_limit);

  const save = async () => {
    try {
      await update.mutateAsync({ signature, daily_send_limit: limit });
      toast.success("Sending settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4" /> Email & sending
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !account?.connected ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              Connect your mailbox to write, send, and log outreach from the Outreach desk
              in one step.
            </p>
            <div className="max-w-md">
              <EmailConnectPanel />
            </div>
          </>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background">
                {account.provider === "GOOGLE" ? (
                  <GmailGlyph className="h-5 w-5" />
                ) : account.provider === "MICROSOFT" ? (
                  <OutlookGlyph className="h-5 w-5" />
                ) : (
                  <FlaskConical className="h-5 w-5 text-foreground" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{account.email_address}</p>
                <p className="text-xs text-muted-foreground">
                  {account.provider === "SANDBOX"
                    ? "Sandbox — sends are simulated"
                    : account.provider === "GOOGLE"
                      ? "Gmail — sends from your mailbox"
                      : "Outlook — sends from your mailbox"}
                  {" · "}
                  <span className="tabular-nums">
                    {account.sends_today}/{account.daily_send_limit}
                  </span>{" "}
                  sent today
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
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
                Disconnect
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div>
                <Label htmlFor="email-signature">Signature</Label>
                <textarea
                  id="email-signature"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  rows={3}
                  placeholder={"Your name\nYour firm"}
                  className="mt-1.5 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Appended to every email sent from the desk.
                </p>
              </div>
              <div>
                <Label htmlFor="email-limit">Daily send limit</Label>
                <Input
                  id="email-limit"
                  type="number"
                  min={1}
                  max={200}
                  value={limit}
                  onChange={(e) => setLimit(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                  className="mt-1.5 w-28"
                />
                <p className="mt-1 max-w-44 text-xs text-muted-foreground">
                  Steady pacing keeps 1-to-1 mail out of spam.
                </p>
              </div>
            </div>

            {dirty && (
              <div className="flex justify-end">
                <Button size="sm" onClick={save} disabled={update.isPending}>
                  {update.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Templates card ─────────────────────────────────────────────────────────────

interface TemplateDraft {
  id: number | null;
  name: string;
  kind: TemplateKind;
  subject: string;
  body: string;
  is_shared: boolean;
}

const EMPTY_DRAFT: TemplateDraft = {
  id: null,
  name: "",
  kind: "FOLLOW_UP",
  subject: "",
  body: "",
  is_shared: false,
};

export function EmailTemplatesCard() {
  const { user } = useAuth();
  const { data } = useEmailTemplates();
  const create = useCreateTemplate();
  const patch = useUpdateTemplate();
  const remove = useDeleteTemplate();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<TemplateDraft | null>(null);

  const templates = useMemo(() => data?.items ?? [], [data]);
  const canEdit = (t: EmailTemplate) =>
    t.owner_id === user?.id || (t.owner_id === null && user?.role === "PARTNER");

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.subject.trim() || !draft.body.trim()) {
      toast.error("Name, subject, and body are required");
      return;
    }
    try {
      if (draft.id == null) {
        await create.mutateAsync({
          name: draft.name.trim(),
          kind: draft.kind,
          subject: draft.subject.trim(),
          body: draft.body,
          is_shared: draft.is_shared,
        });
        toast.success(`Template created — ${draft.name.trim()}`);
      } else {
        await patch.mutateAsync({
          id: draft.id,
          data: {
            name: draft.name.trim(),
            kind: draft.kind,
            subject: draft.subject.trim(),
            body: draft.body,
            is_shared: draft.is_shared,
          },
        });
        toast.success("Template updated");
      }
      setDraft(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save template");
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Pencil className="h-4 w-4" /> Email templates ({templates.length})
        </CardTitle>
        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setDraft(EMPTY_DRAFT)}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> New template
        </Button>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No templates yet. Save one from the compose sheet, or create one here — use{" "}
            <code className="rounded bg-muted px-1 text-xs">{"{{first_name}}"}</code>,{" "}
            <code className="rounded bg-muted px-1 text-xs">{"{{company}}"}</code>,{" "}
            <code className="rounded bg-muted px-1 text-xs">{"{{sender_name}}"}</code> as variables.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-px text-[11px] font-medium",
                    KIND_STYLE[t.kind],
                  )}
                >
                  {KIND_LABEL[t.kind]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {t.name}
                    {(t.owner_id === null || t.is_shared) && (
                      <span
                        className="ml-2 inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground"
                        title={t.owner_id === null ? "Firm starter template" : "Shared with the firm"}
                      >
                        <Users2 className="h-3 w-3" aria-hidden /> Firm
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{t.subject}</p>
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  used {t.use_count}×
                </span>
                {canEdit(t) && (
                  <span className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      aria-label={`Edit ${t.name}`}
                      onClick={() =>
                        setDraft({
                          id: t.id,
                          name: t.name,
                          kind: t.kind,
                          subject: t.subject,
                          body: t.body,
                          is_shared: t.is_shared,
                        })
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive-ink"
                      aria-label={`Delete ${t.name}`}
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Delete the “${t.name}” template?`,
                          description:
                            "This one is a real delete, not an archive — the template can't be restored. Emails already sent from it are untouched.",
                          confirmLabel: "Delete",
                          tone: "destructive",
                        });
                        if (!ok) return;
                        remove.mutate(t.id, {
                          onSuccess: () => toast.success("Template deleted"),
                        });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{draft?.id == null ? "New template" : "Edit template"}</DialogTitle>
            </DialogHeader>
            {draft && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <div>
                    <Label htmlFor="tplm-name">Name</Label>
                    <Input
                      id="tplm-name"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tplm-kind">Kind</Label>
                    <select
                      id="tplm-kind"
                      value={draft.kind}
                      onChange={(e) => setDraft({ ...draft, kind: e.target.value as TemplateKind })}
                      className="mt-1.5 h-9 w-32 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      {Object.entries(KIND_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="tplm-subject">Subject</Label>
                  <Input
                    id="tplm-subject"
                    value={draft.subject}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                    placeholder="e.g. Exploring a fit with {{company}}"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="tplm-body">Body</Label>
                  <textarea
                    id="tplm-body"
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                    rows={8}
                    className="mt-1.5 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-relaxed outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Variables: {"{{first_name}} {{full_name}} {{company}} {{designation}} {{deal}} {{sender_name}} {{firm}}"}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.is_shared}
                    onChange={(e) => setDraft({ ...draft, is_shared: e.target.checked })}
                    className="h-4 w-4 rounded border-input"
                  />
                  Share with the whole firm
                </label>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="ghost" onClick={() => setDraft(null)}>
                    Cancel
                  </Button>
                  <Button onClick={save} disabled={create.isPending || patch.isPending}>
                    {create.isPending || patch.isPending ? "Saving…" : "Save template"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
