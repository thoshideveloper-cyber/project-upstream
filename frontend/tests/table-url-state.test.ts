import { describe, it, expect } from "vitest";

import {
  boolParam,
  decodeState,
  encodeQuery,
  enumParam,
  intParam,
  stringParam,
  type ParamSpec,
} from "@/lib/table-url-state";

/**
 * Unit tests for the URL-persisted table-state core (P2). The React hook is a thin
 * binding over these; the decode/encode semantics — defaults omitted, foreign params
 * preserved — are proven here without a router.
 */

const spec = {
  q: stringParam(""),
  page: intParam(1),
  archived: boolParam(false),
  sort: enumParam(["name", "revenue", "headcount"] as const, "name"),
} satisfies ParamSpec;

describe("decodeState", () => {
  it("returns fallbacks for an empty query", () => {
    expect(decodeState(spec, "")).toEqual({ q: "", page: 1, archived: false, sort: "name" });
  });

  it("parses each codec from the query", () => {
    expect(decodeState(spec, "?q=tata&page=3&archived=1&sort=revenue")).toEqual({
      q: "tata",
      page: 3,
      archived: true,
      sort: "revenue",
    });
  });

  it("falls back on an unknown enum value and a non-numeric int", () => {
    expect(decodeState(spec, "?sort=bogus&page=abc")).toMatchObject({ sort: "name", page: 1 });
  });
});

describe("encodeQuery", () => {
  it("omits params at their default (clean URL)", () => {
    expect(encodeQuery(spec, { q: "", page: 1, archived: false, sort: "name" })).toBe("");
  });

  it("emits only non-default params", () => {
    const qs = encodeQuery(spec, { q: "steel", page: 2, archived: true, sort: "name" });
    const p = new URLSearchParams(qs);
    expect(p.get("q")).toBe("steel");
    expect(p.get("page")).toBe("2");
    expect(p.get("archived")).toBe("1");
    expect(p.has("sort")).toBe(false); // default → omitted
  });

  it("preserves foreign params not owned by the spec", () => {
    const qs = encodeQuery(spec, { q: "x", page: 1, archived: false, sort: "name" }, "?deal=7&view=firm");
    const p = new URLSearchParams(qs);
    expect(p.get("deal")).toBe("7");
    expect(p.get("view")).toBe("firm");
    expect(p.get("q")).toBe("x");
  });

  it("clears a param from the base URL once it returns to default", () => {
    const qs = encodeQuery(spec, { q: "", page: 1, archived: false, sort: "name" }, "?q=old&page=5");
    expect(qs).toBe("");
  });

  it("round-trips decode → encode", () => {
    const state = decodeState(spec, "?q=abc&page=4&archived=1&sort=headcount");
    const qs = encodeQuery(spec, state);
    expect(decodeState(spec, `?${qs}`)).toEqual(state);
  });
});
