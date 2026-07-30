"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { invalidateOutreachData } from "@/lib/query-invalidation";

// ── Types ──────────────────────────────────────────────────────────────────────

export type EmailProvider = "GOOGLE" | "MICROSOFT" | "SANDBOX";

export interface EmailAccountInfo {
  connected: boolean;
  provider: EmailProvider | null;
  email_address: string | null;
  display_name: string | null;
  signature: string | null;
  daily_send_limit: number;
  sends_today: number;
  ai_drafting: boolean;
  providers: { google?: boolean; microsoft?: boolean; sandbox?: boolean };
}

export type TemplateKind = "INITIAL" | "FOLLOW_UP" | "BUMP" | "BREAKUP";

export interface EmailTemplate {
  id: number;
  owner_id: number | null;
  name: string;
  kind: TemplateKind;
  subject: string;
  body: string;
  is_shared: boolean;
  use_count: number;
  updated_at: string;
}

export interface SendEmailPayload {
  company_id: number;
  to_email: string;
  subject: string;
  body: string;
  contact_id?: number | null;
  event_type: "INITIAL_EMAIL" | "FOLLOW_UP";
  notes?: string;
  template_id?: number | null;
}

export interface SendEmailResult {
  status: "SENT" | "SIMULATED" | "FAILED";
  event_id: number | null;
  sent_email_id: number;
  sends_today: number;
  daily_limit: number;
}

export interface DraftPayload {
  company_id: number;
  contact_id?: number | null;
  kind: "INITIAL_EMAIL" | "FOLLOW_UP";
  tone: "direct" | "warm" | "formal";
  instructions?: string;
}

export interface DraftResult {
  subject: string;
  body: string;
}

// ── Account ────────────────────────────────────────────────────────────────────

export function useEmailAccount() {
  return useQuery<EmailAccountInfo>({
    queryKey: ["email", "account"],
    queryFn: () => api.get<EmailAccountInfo>("/email/account"),
    staleTime: 60_000,
  });
}

export function useConnectSandbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<EmailAccountInfo>("/email/account/sandbox"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email"] }),
  });
}

/** Kick off the provider consent flow — navigates the browser to Google/Microsoft. */
export function useOAuthStart() {
  return useMutation({
    mutationFn: async (provider: "google" | "microsoft") => {
      const { url } = await api.get<{ url: string }>(`/email/oauth/${provider}/start`);
      window.location.href = url;
    },
  });
}

export function useUpdateEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      signature?: string;
      display_name?: string;
      daily_send_limit?: number;
    }) => api.patch<EmailAccountInfo>("/email/account", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email"] }),
  });
}

export function useDisconnectEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.del("/email/account"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email"] }),
  });
}

// ── Templates ──────────────────────────────────────────────────────────────────

export function useEmailTemplates(enabled = true) {
  return useQuery<{ items: EmailTemplate[]; total: number }>({
    queryKey: ["email", "templates"],
    queryFn: () => api.get("/email/templates"),
    staleTime: 60_000,
    enabled,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      kind: TemplateKind;
      subject: string;
      body: string;
      is_shared?: boolean;
    }) => api.post<EmailTemplate>("/email/templates", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email", "templates"] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<EmailTemplate, "id">> }) =>
      api.patch<EmailTemplate>(`/email/templates/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email", "templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/email/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email", "templates"] }),
  });
}

// ── Send + draft ───────────────────────────────────────────────────────────────

export function useSendEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SendEmailPayload) =>
      api.post<SendEmailResult>("/email/send", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email", "account"] });
      invalidateOutreachData(qc);
    },
  });
}

export function useDraftEmail() {
  return useMutation({
    mutationFn: (payload: DraftPayload) => api.post<DraftResult>("/email/draft", payload),
  });
}
