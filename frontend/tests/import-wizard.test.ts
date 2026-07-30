import { describe, it, expect } from "vitest";
import { isMappingComplete } from "@/app/(app)/sourcing/import/page";
import type { ImportFieldMeta } from "@/hooks/use-imports";

const FIELDS: ImportFieldMeta[] = [
  { field: "company_name", label: "Company name", required: true },
  { field: "website", label: "Website", required: false },
];

describe("isMappingComplete", () => {
  it("requires every required field to be mapped", () => {
    expect(isMappingComplete(FIELDS, { company_name: null, website: "Website" })).toBe(false);
    expect(isMappingComplete(FIELDS, { company_name: "Name", website: null })).toBe(true);
  });

  it("ignores optional fields", () => {
    expect(isMappingComplete(FIELDS, { company_name: "Co" })).toBe(true);
  });
});
