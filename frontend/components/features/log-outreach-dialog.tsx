"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Info } from "lucide-react";

import { useLogEvent, type LogEventPayload } from "@/hooks/use-schedule";
import { useContacts } from "@/hooks/use-contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const EVENT_TYPES = [
  { value: "INITIAL_EMAIL", label: "Initial email" },
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "RESPONSE", label: "Response received" },
  { value: "BOUNCE", label: "Bounce" },
  { value: "CALL", label: "Call" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "MEETING", label: "Meeting" },
  { value: "NOTE", label: "Note" },
];

// Touch types that involve a person → capture who + how + outcome.
const PERSON_TYPES = new Set(["RESPONSE", "CALL", "LINKEDIN", "MEETING"]);
const MODE_BY_TYPE: Record<string, string> = {
  RESPONSE: "EMAIL",
  CALL: "CALL",
  LINKEDIN: "LINKEDIN",
  MEETING: "MEETING",
};

const MODE_OPTIONS = [
  { value: "EMAIL", label: "Email" },
  { value: "CALL", label: "Call" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "MEETING", label: "Meeting" },
  { value: "EVENT", label: "Event" },
];

const SENTIMENT_OPTIONS = [
  { value: "", label: "—" },
  { value: "POSITIVE", label: "Positive" },
  { value: "NEGATIVE", label: "Negative" },
  { value: "NEUTRAL", label: "Neutral" },
];

// What each touch does to the cadence — surfaced so the analyst is never surprised.
const HINT: Record<string, { text: string; stops?: boolean }> = {
  INITIAL_EMAIL: { text: "Logs the first touch and starts the cadence clock." },
  FOLLOW_UP: { text: "Advances the cadence to the next follow-up." },
  RESPONSE: { text: "Captures a reply — this stops the cadence.", stops: true },
  BOUNCE: { text: "Marks the address as bounced — this stops the cadence.", stops: true },
  DECLINED: { text: "Records a decline — this stops the cadence.", stops: true },
};

interface Props {
  companyId: number;
  companyName: string;
  /** Pass `null` to render no trigger (drive the dialog with `open`/`onOpenChange`). */
  trigger?: React.ReactNode | null;
  defaultEventType?: string;
  /**
   * One line of context from whatever opened the dialog — e.g. the pipeline board
   * saying what dropping the card is about to do to the cadence. Shown under the
   * title so a consequence is never a surprise.
   */
  note?: string;
  /** Preselect the person on person-type touches (e.g. logging from the Contacts page). */
  defaultContactId?: number;
  /** Controlled open state. When provided, the dialog is fully controlled. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Called after a touch is successfully logged (e.g. to update a momentum counter). */
  onLogged?: () => void;
}

export function LogOutreachDialog({
  companyId,
  companyName,
  trigger,
  defaultEventType,
  note,
  defaultContactId,
  open: controlledOpen,
  onOpenChange,
  onLogged,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const logEvent = useLogEvent(companyId);
  const { data: contactsData } = useContacts(open ? { company_id: companyId } : {});

  const today = new Date().toISOString().split("T")[0];
  const [eventType, setEventType] = useState(defaultEventType ?? "FOLLOW_UP");
  const [occurredOn, setOccurredOn] = useState(today);
  const [notes, setNotes] = useState("");
  // Mode seeded from the initial type so key-based remounts (quick outcomes) land
  // on the right channel without an effect.
  const [mode, setMode] = useState(MODE_BY_TYPE[defaultEventType ?? ""] ?? "EMAIL");

  // Person capture (response-type touches).
  const [contactChoice, setContactChoice] = useState<string>(
    defaultContactId ? String(defaultContactId) : "",
  ); // "" | "new" | id
  const [newName, setNewName] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [sentiment, setSentiment] = useState("");

  const isPerson = PERSON_TYPES.has(eventType);
  const contacts = contactsData?.items ?? [];

  const reset = () => {
    setEventType(defaultEventType ?? "FOLLOW_UP");
    setOccurredOn(today);
    setNotes("");
    setContactChoice(defaultContactId ? String(defaultContactId) : "");
    setNewName(""); setNewTitle(""); setNewEmail("");
    setMode("EMAIL"); setSentiment("");
  };

  const onEventTypeChange = (v: string) => {
    setEventType(v);
    if (MODE_BY_TYPE[v]) setMode(MODE_BY_TYPE[v]);
  };

  const submit = async () => {
    const payload: LogEventPayload = { event_type: eventType, occurred_on: occurredOn, notes: notes || undefined };
    if (isPerson) {
      payload.mode = mode;
      if (sentiment) payload.sentiment = sentiment;
      if (contactChoice === "new") {
        if (!newName.trim()) { toast.error("Enter the contact's name"); return; }
        payload.new_contact = {
          contact_person: newName.trim(),
          designation: newTitle.trim() || null,
          email: newEmail.trim() || null,
        };
      } else if (contactChoice) {
        payload.contact_id = Number(contactChoice);
      }
    }
    try {
      await logEvent.mutateAsync(payload);
      toast.success(eventType === "RESPONSE" ? "Response captured" : "Outreach logged");
      onLogged?.();
      reset();
      setOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to log outreach");
    }
  };

  const title = useMemo(
    () => (eventType === "RESPONSE" ? "Log response" : "Log outreach"),
    [eventType],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <span className="contents" onClick={() => setOpen(true)}>
          {trigger ?? <Button size="sm">Log outreach</Button>}
        </span>
      )}
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {title} <span className="font-normal text-muted-foreground">· {companyName}</span>
          </DialogTitle>
          {note && <DialogDescription>{note}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="event_type">Type</Label>
              <select
                id="event_type"
                value={eventType}
                onChange={(e) => onEventTypeChange(e.target.value)}
                className="mt-1.5 w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
                data-testid="log-event-type"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="occurred_on">Date</Label>
              <Input id="occurred_on" type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} className="mt-1.5" />
            </div>
          </div>

          {HINT[eventType] && (
            <p
              className={`flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-xs ${
                HINT[eventType].stops
                  ? "border-amber-500/25 bg-amber-500/[0.07] text-amber-700 dark:text-amber-400"
                  : "border-border bg-muted/40 text-muted-foreground"
              }`}
            >
              <Info className="mt-px h-3.5 w-3.5 shrink-0" />
              {HINT[eventType].text}
            </p>
          )}

          {isPerson && (
            <div className="rounded-md border border-border p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Who</p>
              <select
                value={contactChoice}
                onChange={(e) => setContactChoice(e.target.value)}
                className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
                data-testid="log-contact-choice"
              >
                <option value="">No specific contact</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.contact_person}{c.designation ? ` · ${c.designation}` : ""}</option>
                ))}
                <option value="new">+ New contact…</option>
              </select>
              {contactChoice === "new" && (
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 text-sm" data-testid="log-new-name" />
                  <Input placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="h-8 text-sm" />
                  <Input placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="h-8 text-sm col-span-2" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="mode" className="text-xs">Mode</Label>
                  <select id="mode" value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 w-full h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30">
                    {MODE_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="sentiment" className="text-xs">Sentiment</Label>
                  <select id="sentiment" value={sentiment} onChange={(e) => setSentiment(e.target.value)} className="mt-1 w-full h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30" data-testid="log-sentiment">
                    {SENTIMENT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="notes">{isPerson ? "Comments" : "Notes"} (optional)</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={isPerson ? "Running log of the interaction…" : "Brief notes…"}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={submit} disabled={logEvent.isPending} data-testid="log-submit">
              {logEvent.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
