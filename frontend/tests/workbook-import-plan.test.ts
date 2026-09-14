import { describe, it, expect } from "vitest";
import { isPlanComplete, needsMandate } from "@/app/(app)/import/page";
import type { SheetPlan, WorkbookPlan } from "@/hooks/use-workbook-import";

const master: SheetPlan = { sheet: "Company list 1", kind: "MASTER" };
const contacts: SheetPlan = { sheet: "Contacts list", kind: "CONTACTS" };

function plan(overrides: Partial<WorkbookPlan> = {}): WorkbookPlan {
  return { new_project: { name: "GAIL", client_name: "GAIL" }, sheets: [master], ...overrides };
}

describe("needsMandate", () => {
  it("is true for the sheets that become a master list", () => {
    expect(needsMandate({ sheet: "s", kind: "MASTER" })).toBe(true);
    expect(needsMandate({ sheet: "s", kind: "LONGLIST" })).toBe(true);
  });

  it("is false for the contact list and skipped tabs", () => {
    expect(needsMandate(contacts)).toBe(false);
    expect(needsMandate({ sheet: "s", kind: "IGNORE" })).toBe(false);
  });
});

describe("isPlanComplete", () => {
  it("needs a project — one workbook is one client, and it is never inferred", () => {
    expect(isPlanComplete(plan({ new_project: { name: "", client_name: "" } }))).toBe(false);
    expect(isPlanComplete(plan({ project_id: 3, new_project: null }))).toBe(false);
  });

  it("needs an engagement for every master sheet", () => {
    expect(isPlanComplete(plan())).toBe(false);
    expect(
      isPlanComplete(plan({ sheets: [{ ...master, mandate_id: 7 }] })),
    ).toBe(true);
    expect(
      isPlanComplete(
        plan({ sheets: [{ ...master, new_mandate: { name: "GAIL raise", type: "CAPITAL_RAISE" } }] }),
      ),
    ).toBe(true);
  });

  it("does not ask for an engagement on the contact list", () => {
    expect(isPlanComplete(plan({ sheets: [contacts] }))).toBe(true);
  });

  it("blocks a plan where every tab is skipped", () => {
    expect(isPlanComplete(plan({ sheets: [{ ...master, kind: "IGNORE" }] }))).toBe(false);
  });

  it("blocks when one of several master sheets is still unmapped", () => {
    expect(
      isPlanComplete(
        plan({
          sheets: [
            { ...master, mandate_id: 7 },
            { sheet: "PE porfolio names final", kind: "MASTER" },
          ],
        }),
      ),
    ).toBe(false);
  });
});
