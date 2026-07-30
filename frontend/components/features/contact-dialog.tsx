"use client";

import { useMemo, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useCreateContact, useUpdateContact } from "@/hooks/use-contacts";
import { useCompanies } from "@/hooks/use-companies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Contact } from "@/types";

// Contact engagement vocabulary (who this person is to the firm) — must match the
// backend Engagement enum; "Capital raise" is a mandate type, not a contact tag.
const ENGAGEMENT_OPTIONS = [
  { value: "", label: "None" },
  { value: "BUY_SIDE", label: "Buy-side" },
  { value: "SELL_SIDE", label: "Sell-side" },
  { value: "INVESTOR", label: "Investor" },
  { value: "ADVISOR", label: "Advisor" },
  { value: "OTHER", label: "Other" },
];

const schema = z.object({
  contact_person: z.string().min(1, "Name is required"),
  designation: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  linkedin: z.string().optional(),
  engagement: z.string().optional(),
  remark: z.string().optional(),
  is_primary: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  /** Omit to let the analyst pick the company (e.g. from the Contacts page). */
  companyId?: number;
  contact?: Contact;
  /** Prefill the name when creating (e.g. from an empty search's "Add 'X'"). */
  initialName?: string;
  /** Pass `null` to render no trigger (drive the dialog with `open`/`onOpenChange`). */
  trigger?: React.ReactNode | null;
  /** Controlled open state. When provided, the dialog is fully controlled. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ContactDialog({
  companyId,
  contact,
  initialName,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onSuccess,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();

  const isEdit = !!contact;
  const needsCompanyPick = !isEdit && companyId == null;
  const [pickedCompanyId, setPickedCompanyId] = useState(0);
  const { data: companies } = useCompanies(
    { page_size: 500 },
    { enabled: needsCompanyPick && open },
  );
  const companyOptions = useMemo(
    () =>
      needsCompanyPick
        ? [...(companies?.items ?? [])].sort((a, b) => a.company_name.localeCompare(b.company_name))
        : [],
    [needsCompanyPick, companies],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      contact_person: contact?.contact_person ?? initialName ?? "",
      designation: contact?.designation ?? "",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
      linkedin: contact?.linkedin ?? "",
      engagement: contact?.engagement ?? "",
      remark: contact?.remark ?? "",
      is_primary: contact?.is_primary ?? false,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        contact_person: contact?.contact_person ?? initialName ?? "",
        designation: contact?.designation ?? "",
        email: contact?.email ?? "",
        phone: contact?.phone ?? "",
        linkedin: contact?.linkedin ?? "",
        engagement: contact?.engagement ?? "",
        remark: contact?.remark ?? "",
        is_primary: contact?.is_primary ?? false,
      });
    }
  }, [open, contact, initialName, reset]);

  const onSubmit = async (data: FormValues) => {
    const targetCompanyId = companyId ?? contact?.company_id ?? pickedCompanyId;
    if (!targetCompanyId) {
      toast.error("Pick the company this person belongs to");
      return;
    }
    const payload: Record<string, unknown> = {
      ...data,
      engagement: data.engagement || null,
      email: data.email || null,
      linkedin: data.linkedin || null,
    };
    try {
      if (isEdit) {
        await updateContact.mutateAsync({ id: contact.id, data: payload });
        toast.success("Contact updated");
      } else {
        await createContact.mutateAsync({ ...payload, company_id: targetCompanyId });
        toast.success("Contact created");
      }
      reset();
      setPickedCompanyId(0);
      setOpen(false);
      onSuccess?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save contact";
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <span className="contents" onClick={() => setOpen(true)}>
          {trigger ?? (
            <Button size="sm">{isEdit ? "Edit" : "Add contact"}</Button>
          )}
        </span>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit contact" : "Add contact"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {needsCompanyPick && (
            <div>
              <Label htmlFor="contact_company">Company *</Label>
              <select
                id="contact_company"
                value={pickedCompanyId}
                onChange={(e) => setPickedCompanyId(Number(e.target.value))}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value={0}>Pick a company…</option>
                {companyOptions.map((co) => (
                  <option key={co.id} value={co.id}>{co.company_name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label htmlFor="contact_person">Name *</Label>
            <Input
              id="contact_person"
              {...register("contact_person")}
              className="mt-1"
            />
            {errors.contact_person && (
              <p className="mt-1 text-xs text-destructive-ink">{errors.contact_person.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" {...register("designation")} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="engagement">Engagement</Label>
              <select
                id="engagement"
                {...register("engagement")}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {ENGAGEMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} className="mt-1" />
              {errors.email && (
                <p className="mt-1 text-xs text-destructive-ink">{errors.email.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register("phone")} className="mt-1" />
            </div>
          </div>

          <div>
            <Label htmlFor="linkedin">LinkedIn</Label>
            <Input
              id="linkedin"
              placeholder="linkedin.com/in/…"
              {...register("linkedin")}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="remark">Remark</Label>
            <Input id="remark" {...register("remark")} className="mt-1" />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_primary" {...register("is_primary")} />
            <Label htmlFor="is_primary">Primary contact for company</Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
