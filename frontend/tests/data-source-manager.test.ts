import { describe, it, expect } from "vitest";
import { providerLabel } from "@/components/features/data-source-manager";

describe("providerLabel", () => {
  it("labels known providers", () => {
    expect(providerLabel("mock_ranking")).toContain("Mock");
    expect(providerLabel("groq_ranking")).toContain("Groq");
  });
  it("falls back to the raw key", () => {
    expect(providerLabel("some_future_vendor")).toBe("some_future_vendor");
  });
});
