"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Contact, ContactDetail, ContactListResponse } from "@/types";

export interface ContactFilters {
  q?: string;
  company_id?: number;
  engagement?: string;
  sentiment?: string;
  poc_owner_id?: number;
  include_archived?: boolean;
}

function buildQS(filters: ContactFilters): string {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.company_id) p.set("company_id", String(filters.company_id));
  if (filters.engagement) p.set("engagement", filters.engagement);
  if (filters.sentiment) p.set("sentiment", filters.sentiment);
  if (filters.poc_owner_id) p.set("poc_owner_id", String(filters.poc_owner_id));
  if (filters.include_archived) p.set("include_archived", "true");
  return p.toString() ? `?${p.toString()}` : "";
}

export function useContacts(filters: ContactFilters = {}, opts: { enabled?: boolean } = {}) {
  return useQuery<ContactListResponse>({
    queryKey: ["contacts", filters],
    queryFn: () => api.get<ContactListResponse>(`/contacts${buildQS(filters)}`),
    staleTime: 30_000,
    enabled: opts.enabled ?? true,
  });
}

export function useContact(id: number) {
  return useQuery<ContactDetail>({
    queryKey: ["contact", id],
    queryFn: () => api.get<ContactDetail>(`/contacts/${id}`),
    staleTime: 30_000,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<Contact>("/contacts", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.patch<Contact>(`/contacts/${id}`, data),
    onSuccess: (contact) => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.setQueryData(["contact", contact.id], (old: ContactDetail | undefined) =>
        old ? { ...old, ...contact } : old
      );
      qc.invalidateQueries({ queryKey: ["company"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useArchiveContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del<{ detail: string }>(`/contacts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["company"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useUnarchiveContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<Contact>(`/contacts/${id}/unarchive`),
    onSuccess: (contact) => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["contact", contact.id] });
      qc.invalidateQueries({ queryKey: ["company"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}
