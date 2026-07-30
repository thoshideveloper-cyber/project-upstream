"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MyBookResponse } from "@/types";

/** The analyst worklist — placements in my mandates, grouped by project, attention-sorted. */
export function useMyBook(mandateId?: number) {
  return useQuery<MyBookResponse>({
    queryKey: ["my-book", mandateId ?? null],
    queryFn: () =>
      api.get<MyBookResponse>(`/my-book${mandateId ? `?mandate_id=${mandateId}` : ""}`),
    staleTime: 20_000,
  });
}
