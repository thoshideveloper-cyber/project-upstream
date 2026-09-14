"use client";

/**
 * The vocabulary a filter can address, resolved from the project actually on screen.
 *
 * A filter UI has two ways to know what "Category" can be: a hardcoded list, or the
 * data. Hardcoded goes stale the moment a firm renames a category, and it offers values
 * that match nothing. So every option list here is derived — from the firm's own
 * vocabulary where one exists (categories, bands), and from the loaded book where it
 * doesn't (HQ). An option that would return zero rows is not offered at all, which is
 * why the filter never has an empty-handed state to explain.
 */

import { useMemo } from "react";

import { ATTENTION_LABEL, CADENCE_LABEL, type FilterField } from "@/lib/project-views";
import { STATUS_META } from "@/lib/design";
import type { Company, MandateEngagementStats } from "@/types";

export interface Option {
  value: string;
  label: string;
  /** How many of the loaded companies match — shown so a filter costs no guessing. */
  count?: number;
}

export type OptionMap = Partial<Record<FilterField, Option[]>>;

function tally<T extends string | number>(
  companies: Company[],
  key: (c: Company) => T | null | undefined,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of companies) {
    const v = key(c);
    const k = v == null ? "none" : String(v);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/**
 * Options for every enum field, counted against the whole book.
 *
 * Counted against the *unfiltered* book on purpose: a count that changes as you build
 * the filter tells you what you already narrowed to, not what the next click would give
 * you, and the second is the only one worth printing beside a checkbox.
 */
export function useFilterOptions({
  companies,
  engagements,
  categories,
  bands,
}: {
  companies: Company[];
  engagements: MandateEngagementStats[];
  categories: { id: number; name: string }[];
  bands: { id: number; name: string }[];
}): OptionMap {
  return useMemo(() => {
    const byEngagement = tally(companies, (c) => c.mandate_id);
    const byCategory = tally(companies, (c) => c.category_id);
    const byBand = tally(companies, (c) => c.sourcing_layer_id);
    const byStatus = tally(companies, (c) => c.status);
    const byHq = tally(companies, (c) => c.hq);

    const present = (opts: Option[]) => opts.filter((o) => (o.count ?? 0) > 0);

    return {
      engagement: present(
        engagements.map((e) => ({
          value: String(e.id),
          label: e.name,
          count: byEngagement.get(String(e.id)) ?? 0,
        })),
      ),
      category: present([
        ...categories.map((c) => ({
          value: String(c.id),
          label: c.name,
          count: byCategory.get(String(c.id)) ?? 0,
        })),
        { value: "none", label: "Uncategorized", count: byCategory.get("none") ?? 0 },
      ]),
      band: present([
        ...bands.map((b) => ({
          value: String(b.id),
          label: b.name,
          count: byBand.get(String(b.id)) ?? 0,
        })),
        { value: "none", label: "Unsorted", count: byBand.get("none") ?? 0 },
      ]),
      status: present(
        Object.entries(STATUS_META).map(([k, v]) => ({
          value: k,
          label: v.label,
          count: byStatus.get(k) ?? 0,
        })),
      ),
      // Attention and cadence are closed vocabularies the app defines, so they are
      // listed in full even at zero — "0 overdue" is information, and hiding the row
      // makes an analyst wonder whether the filter can express it at all.
      attention: Object.entries(ATTENTION_LABEL).map(([k, label]) => ({ value: k, label })),
      cadence: Object.entries(CADENCE_LABEL).map(([k, label]) => ({ value: k, label })),
      contact: [
        { value: "has", label: "Has a contact" },
        { value: "missing", label: "No contact" },
      ],
      // HQ is free text an import wrote, so it can only come from the data. Capped:
      // a select with 300 cities in it is a search box wearing the wrong clothes.
      hq: [...byHq.entries()]
        .filter(([k]) => k !== "none")
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 40)
        .map(([value, count]) => ({ value, label: value, count })),
    } satisfies OptionMap;
  }, [companies, engagements, categories, bands]);
}

/** Resolve a stored filter value back to the label a human wrote. */
export function labelFor(options: OptionMap, field: FilterField, value: string | number): string {
  const found = options[field]?.find((o) => o.value === String(value));
  return found?.label ?? String(value);
}
