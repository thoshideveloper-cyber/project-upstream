import { describe, it, expect } from "vitest";
import { requiresPushConfirm } from "@/components/features/sourcing-kanban";

describe("requiresPushConfirm", () => {
  it("gates a drag into Active for a not-yet-placed candidate", () => {
    expect(requiresPushConfirm("ACTIVE", false)).toBe(true);
  });

  it("does not gate an already-placed candidate moving into Active", () => {
    expect(requiresPushConfirm("ACTIVE", true)).toBe(false);
  });

  it("does not gate cheap pre-push drags", () => {
    expect(requiresPushConfirm("RESEARCH", false)).toBe(false);
    expect(requiresPushConfirm("SHORTLIST", false)).toBe(false);
    expect(requiresPushConfirm("ENGAGED", false)).toBe(false);
  });
});
