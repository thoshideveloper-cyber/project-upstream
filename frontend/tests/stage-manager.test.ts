import { describe, it, expect } from "vitest";
import {
  STAGE_KIND_LABEL,
  isBehaviouralStage,
} from "@/components/features/stage-manager";
import type { SourcingStageKind } from "@/types";

describe("stage kind labels", () => {
  it("labels every kind", () => {
    const kinds: SourcingStageKind[] = [
      "RESEARCH",
      "SHORTLIST",
      "ACTIVE",
      "ENGAGED",
      "PASSED",
      "CUSTOM",
    ];
    for (const k of kinds) {
      expect(STAGE_KIND_LABEL[k]).toBeTruthy();
    }
  });
});

describe("isBehaviouralStage", () => {
  it("treats every non-custom kind as behavioural (not freely archivable)", () => {
    expect(isBehaviouralStage("RESEARCH")).toBe(true);
    expect(isBehaviouralStage("ACTIVE")).toBe(true);
    expect(isBehaviouralStage("PASSED")).toBe(true);
    expect(isBehaviouralStage("CUSTOM")).toBe(false);
  });
});
