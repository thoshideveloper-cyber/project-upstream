"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";

import { useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { invalidateOutreachData } from "@/lib/query-invalidation";
import { useCreateCompany, useCheckDuplicate, type CreateCompanyResponse } from "@/hooks/use-companies";
import { useCategories } from "@/hooks/use-categories";
import { useSourcingLayers, useCreateSourcingLayer } from "@/hooks/use-sourcing-layers";
import { useMandate, useMandates } from "@/hooks/use-mandates";
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
import type { DuplicateWarning, MandateType } from "@/types";

const FIELD_SELECT =
  "mt-1 w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30";

const ENGAGEMENT_LABEL: Record<string, string> = {
  SELL_SIDE: "Sell-side",
  BUY_SIDE: "Buy-side",
  CAPITAL_RAISE: "Capital raise",
};

const MATCH_TYPE_LABEL: Record<string, string> = {
  exact_name: "exact name",
  exact_domain: "same domain",
  fuzzy_name: "similar name",
};

/**
 * Suggest Rev ₹Cr from a source revenue string and the engagement's exchange rate.
 * Interprets the parsed number as millions of the source currency:
 *   ₹Cr = millions × rate ÷ 10   (1 crore = 10 million).
 * e.g. "$70m" @ 83.6 → 585.2. Returns null when it can't parse confidently.
 */
export function suggestRevenueInrCr(
  source: string | null | undefined,
  rate: number | null | undefined,
): number | null {
  if (!source || !rate || rate <= 0) return null;
  const m = source.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(b|bn|billion|m|mn|million|k)?/i);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (!isFinite(value)) return null;
  const unit = (m[2] ?? "m").toLowerCase();
  let millions = value;
  if (unit.startsWith("b")) millions = value * 1000;
  else if (unit === "k") millions = value / 1000;
  return Math.round((millions * rate) / 10 * 100) / 100;
}

interface InlineContactState {
  contact_person: string;
  designation: string;
  email: string;
  linkedin: string;
}

const emptyContact: InlineContactState = { contact_person: "", designation: "", email: "", linkedin: "" };

interface AddCompanyFormProps {
  /** Fixed engagement (grid path). Omit/0 to show a mandate picker (firm-wide add). */
  mandateId?: number;
  mandateType?: MandateType;
  mandateName?: string;
  exchangeRate?: number | null;
  defaultCategoryId?: number | null;
  defaultSourcingLayerId?: number | null;
  onAdded: (company: CreateCompanyResponse) => void;
  onCancel?: () => void;
}

export function AddCompanyForm({
  mandateId,
  mandateType,
  mandateName,
  exchangeRate,
  defaultCategoryId,
  defaultSourcingLayerId,
  onAdded,
  onCancel,
}: AddCompanyFormProps) {
  const createCompany = useCreateCompany();
  const qc = useQueryClient();
  const [logging, setLogging] = useState(false);
  const { data: categories } = useCategories();
  const createLayer = useCreateSourcingLayer();

  // Engagement resolution: locked (grid) vs. picker (firm-wide add).
  const locked = !!mandateId && mandateId > 0;
  const [pickedMandate, setPickedMandate] = useState<number>(0);
  const effectiveMandateId = locked ? mandateId! : pickedMandate;
  const { data: mandatesList } = useMandates();
  const { data: pickedDetail } = useMandate(locked ? 0 : pickedMandate);

  const effExchangeRate = locked ? (exchangeRate ?? null) : (pickedDetail?.exchange_rate ? Number(pickedDetail.exchange_rate) : null);
  const effMandateType = locked ? mandateType : pickedDetail?.type;
  const effMandateName = locked ? mandateName : pickedDetail?.name;

  const { data: layers } = useSourcingLayers(effectiveMandateId);

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [hq, setHq] = useState("");
  const [headcount, setHeadcount] = useState("");
  // Follow-up cadence (days between touches). Default 7; analyst can override.
  const [cadenceDays, setCadenceDays] = useState("7");
  const [categoryId, setCategoryId] = useState<string>(defaultCategoryId ? String(defaultCategoryId) : "");
  // Effective category: user selection, else the firm's first vocab entry (no effect —
  // derived so there's no synchronous setState-in-effect cascade).
  const effectiveCategoryId =
    categoryId || (categories?.items?.[0] ? String(categories.items[0].id) : "");
  const [layerId, setLayerId] = useState<string>(defaultSourcingLayerId ? String(defaultSourcingLayerId) : "");
  const [rationale, setRationale] = useState("");
  const [relevant, setRelevant] = useState("");
  const [revenueSource, setRevenueSource] = useState("");
  const [revenueInrCr, setRevenueInrCr] = useState("");
  const [revenueTouched, setRevenueTouched] = useState(false);
  const [contacts, setContacts] = useState<InlineContactState[]>([{ ...emptyContact }]);
  const [showNewLayer, setShowNewLayer] = useState(false);
  const [newLayerName, setNewLayerName] = useState("");

  // Live revenue conversion suggestion (editable — the analyst can override).
  const suggestion = useMemo(
    () => suggestRevenueInrCr(revenueSource, effExchangeRate),
    [revenueSource, effExchangeRate],
  );
  const effectiveRevenueInr = revenueTouched ? revenueInrCr : suggestion != null ? String(suggestion) : "";

  // Warm/duplicate nudge (debounced).
  const [debounced, setDebounced] = useState({ name: "", website: "" });
  useEffect(() => {
    const t = setTimeout(() => setDebounced({ name, website }), 350);
    return () => clearTimeout(t);
  }, [name, website]);
  const { data: dupData } = useCheckDuplicate(debounced.name, debounced.website, effectiveMandateId);
  const warnings: DuplicateWarning[] = dupData?.warnings ?? [];

  const submit = async (logInitial: boolean) => {
    if (!name.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!effectiveMandateId) {
      toast.error("Select an engagement");
      return;
    }
    const cleanContacts = contacts
      .filter((c) => c.contact_person.trim())
      .map((c) => ({
        contact_person: c.contact_person.trim(),
        designation: c.designation.trim() || null,
        email: c.email.trim() || null,
        linkedin: c.linkedin.trim() || null,
      }));

    const payload: Record<string, unknown> = {
      company_name: name.trim(),
      mandate_id: effectiveMandateId,
      website: website.trim() || null,
      hq: hq.trim() || null,
      headcount: headcount ? Number(headcount) : null,
      category_id: effectiveCategoryId ? Number(effectiveCategoryId) : null,
      sourcing_layer_id: layerId ? Number(layerId) : null,
      rationale: rationale.trim() || null,
      relevant_investments: relevant.trim() || null,
      revenue_source: revenueSource.trim() || null,
      revenue_inr_cr: effectiveRevenueInr ? Number(effectiveRevenueInr) : null,
      cadence_interval_days: cadenceDays ? Math.max(1, Number(cadenceDays)) : 7,
      contacts: cleanContacts.length ? cleanContacts : null,
    };

    try {
      const created = await createCompany.mutateAsync(payload);
      if (logInitial) {
        setLogging(true);
        const today = new Date().toISOString().split("T")[0];
        await api.post(`/companies/${created.id}/events`, {
          event_type: "INITIAL_EMAIL",
          occurred_on: today,
          contact_id: created.primary_contact?.id ?? null,
        });
        invalidateOutreachData(qc);
        setLogging(false);
      }
      const dupes = created.duplicate_warnings ?? [];
      if (dupes.length === 0) {
        toast.success(logInitial ? "Company added — initial email logged" : "Company added");
      }
      onAdded(created);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add company");
    }
  };

  const addNewLayer = async () => {
    if (!newLayerName.trim() || !effectiveMandateId) return;
    try {
      const layer = await createLayer.mutateAsync({ mandate_id: effectiveMandateId, name: newLayerName.trim() });
      setLayerId(String(layer.id));
      setShowNewLayer(false);
      setNewLayerName("");
    } catch {
      toast.error("Failed to add layer");
    }
  };

  const busy = createCompany.isPending || logging;

  return (
    <div className="space-y-5">
      {locked && effMandateName && (
        <p className="text-xs text-muted-foreground">
          Engagement: <span className="font-medium text-foreground">{effMandateName}</span>
          {effMandateType && <> · {ENGAGEMENT_LABEL[effMandateType] ?? effMandateType}</>}
        </p>
      )}

      {!locked && (
        <div>
          <Label htmlFor="ac-mandate">Engagement *</Label>
          <select
            id="ac-mandate"
            value={pickedMandate || ""}
            onChange={(e) => setPickedMandate(Number(e.target.value))}
            className={FIELD_SELECT}
            data-testid="add-company-mandate"
          >
            <option value="">Select an engagement…</option>
            {mandatesList?.items.map((m) => (
              <option key={m.id} value={m.id}>{m.name} — {m.client_name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Company name + warm nudge */}
      <div>
        <Label htmlFor="ac-name">Company name *</Label>
        <Input
          id="ac-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1"
          autoFocus
          data-testid="add-company-name"
        />
        {warnings.length > 0 && (
          <div className="mt-1.5 rounded-md border border-border bg-muted/60 px-2 py-1.5 text-xs text-foreground">
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                Possibly already worked in another engagement:
                <ul className="mt-0.5">
                  {warnings.slice(0, 3).map((w) => (
                    <li key={w.company_id}>
                      <span className="font-medium">{w.company_name}</span>{" "}
                      <span className="opacity-70">
                        (mandate {w.mandate_id} · {MATCH_TYPE_LABEL[w.match_type] ?? w.match_type}
                        {w.initial_date ? ` · first contact ${w.initial_date}` : ""})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="ac-website">Website</Label>
          <Input id="ac-website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="example.com" className="mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="ac-hq">HQ</Label>
            <Input id="ac-hq" value={hq} onChange={(e) => setHq(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="ac-headcount">Headcount</Label>
            <Input id="ac-headcount" type="number" value={headcount} onChange={(e) => setHeadcount(e.target.value)} className="mt-1" />
          </div>
        </div>
      </div>

      {/* Follow-up cadence — analyst-editable, default 7 days */}
      <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
        <div className="min-w-0">
          <Label htmlFor="ac-cadence" className="text-sm">Follow-up cadence</Label>
          <p className="text-xs text-muted-foreground">Days between follow-ups after the first email.</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Input
            id="ac-cadence"
            type="number"
            min={1}
            value={cadenceDays}
            onChange={(e) => setCadenceDays(e.target.value)}
            className="h-9 w-16 text-center tabular-nums"
            data-testid="add-company-cadence"
          />
          <span className="text-xs text-muted-foreground">days</span>
        </div>
      </div>

      {/* Classify */}
      <div className="rounded-md border border-border p-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground">Classify</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ac-category">Category *</Label>
            <select
              id="ac-category"
              value={effectiveCategoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={FIELD_SELECT}
              data-testid="add-company-category"
            >
              {categories?.items.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="ac-layer">Sourcing layer</Label>
            {showNewLayer ? (
              <div className="mt-1 flex gap-1">
                <Input value={newLayerName} onChange={(e) => setNewLayerName(e.target.value)} placeholder="New layer…" className="h-9 text-sm" />
                <Button type="button" size="sm" className="h-9" onClick={addNewLayer} disabled={createLayer.isPending}>Add</Button>
              </div>
            ) : (
              <div className="mt-1 flex gap-1">
                <select
                  id="ac-layer"
                  value={layerId}
                  onChange={(e) => setLayerId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
                  data-testid="add-company-layer"
                >
                  <option value="">Unsorted</option>
                  {layers?.items.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <Button type="button" variant="outline" size="sm" className="h-9 px-2" onClick={() => setShowNewLayer(true)} title="New layer">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
        <div>
          <Label htmlFor="ac-rationale">Rationale</Label>
          <textarea
            id="ac-rationale"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="ac-relevant">Relevant investments</Label>
          <Input id="ac-relevant" value={relevant} onChange={(e) => setRelevant(e.target.value)} className="mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ac-rev-src">Revenue (source)</Label>
            <Input id="ac-rev-src" value={revenueSource} onChange={(e) => setRevenueSource(e.target.value)} placeholder="$70m" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="ac-rev-inr">
              Rev ₹Cr
              {!revenueTouched && suggestion != null && effExchangeRate ? (
                <span className="ml-1 text-[10px] font-normal text-muted-foreground">auto @ {effExchangeRate}</span>
              ) : null}
            </Label>
            <Input
              id="ac-rev-inr"
              value={effectiveRevenueInr}
              onChange={(e) => { setRevenueTouched(true); setRevenueInrCr(e.target.value); }}
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* Primary contact(s) */}
      <div className="rounded-md border border-border p-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground">
          Primary contact (optional)
        </p>
        {contacts.map((c, i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <Input placeholder="Name" value={c.contact_person} onChange={(e) => {
              const next = [...contacts]; next[i] = { ...c, contact_person: e.target.value }; setContacts(next);
            }} className="h-8 text-sm" />
            <Input placeholder="Title" value={c.designation} onChange={(e) => {
              const next = [...contacts]; next[i] = { ...c, designation: e.target.value }; setContacts(next);
            }} className="h-8 text-sm" />
            <Input placeholder="Email" value={c.email} onChange={(e) => {
              const next = [...contacts]; next[i] = { ...c, email: e.target.value }; setContacts(next);
            }} className="h-8 text-sm" />
            <Input placeholder="LinkedIn" value={c.linkedin} onChange={(e) => {
              const next = [...contacts]; next[i] = { ...c, linkedin: e.target.value }; setContacts(next);
            }} className="h-8 text-sm" />
          </div>
        ))}
        {contacts.length < 2 && (
          <button
            type="button"
            onClick={() => setContacts([...contacts, { ...emptyContact }])}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> add second contact
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 border-t pt-4">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        )}
        <Button type="button" variant="outline" onClick={() => submit(true)} disabled={busy} data-testid="add-and-log">
          {busy ? "Saving…" : "Add & log initial email"}
        </Button>
        <Button type="button" onClick={() => submit(false)} disabled={busy} data-testid="add-company-submit">
          {busy ? "Saving…" : "Add"}
        </Button>
      </div>
    </div>
  );
}

interface AddCompanyDialogProps extends Omit<AddCompanyFormProps, "onAdded" | "onCancel"> {
  /** Omit, and pass `open`/`onOpenChange`, to drive the dialog from a menu. */
  trigger?: React.ReactNode;
  onAdded?: (company: CreateCompanyResponse) => void;
  /** Controlled open state (opt-in) — the same contract MandateDialog offers. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddCompanyDialog({
  trigger,
  onAdded,
  open: controlledOpen,
  onOpenChange,
  ...formProps
}: AddCompanyDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger != null && (
        <span className="contents" onClick={() => setOpen(true)}>{trigger}</span>
      )}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a company</DialogTitle>
          <DialogDescription>
            It joins your firm-wide database and starts its outreach cadence — log the first email now or later.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <AddCompanyForm
            {...formProps}
            onAdded={(c) => { onAdded?.(c); setOpen(false); }}
            onCancel={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
