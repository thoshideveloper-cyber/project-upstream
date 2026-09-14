import { describe, it, expect } from "vitest";

import {
  actorName,
  countByGroup,
  groupByDay,
  linkFor,
  phraseFor,
  verbMeta,
  VERB_META,
} from "@/lib/activity";
import { relativeTime } from "@/lib/format";
import type { ActivityEvent, ActivityVerb } from "@/types";

function event(over: Partial<ActivityEvent> & { id: number }): ActivityEvent {
  return {
    firm_id: 1,
    project_id: 1,
    mandate_id: null,
    company_id: null,
    actor_id: 1,
    actor_name: "Rhea Kapoor",
    verb: "TASK_CREATED",
    object_type: "TASK",
    object_id: 9,
    object_label: "Chase the NDA",
    meta: null,
    created_at: "2026-03-05T09:00:00",
    ...over,
  } as ActivityEvent;
}

describe("verb phrasing", () => {
  it("reads as a sentence: actor + phrase + object", () => {
    const e = event({ id: 1, verb: "COMPANY_CREATED", object_label: "Acme Industries" });
    expect(`${actorName(e)} ${phraseFor(e)} · ${e.object_label}`).toBe(
      "Rhea Kapoor added a company · Acme Industries",
    );
  });

  it("names the kind of touch on an outreach row", () => {
    expect(
      phraseFor(event({ id: 1, verb: "OUTREACH_LOGGED", meta: { event_type: "INITIAL_EMAIL" } })),
    ).toBe("logged an initial email");
    expect(
      phraseFor(event({ id: 2, verb: "OUTREACH_LOGGED", meta: { event_type: "RESPONSE" } })),
    ).toBe("logged a reply");
  });

  it("turns a status change into the thing that actually happened", () => {
    // There is no TASK_COMPLETED verb by design — completion is a status change with
    // {from, to}, and the renderer is where that becomes readable English.
    const done = event({ id: 1, verb: "TASK_STATUS_CHANGED", meta: { from: "BACKLOG", to: "DONE" } });
    expect(phraseFor(done)).toBe("completed a task");
    expect(
      phraseFor(event({ id: 2, verb: "TASK_STATUS_CHANGED", meta: { from: "DONE", to: "BACKLOG" } })),
    ).toBe("reopened a task");
    expect(
      phraseFor(event({ id: 3, verb: "TASK_STATUS_CHANGED", meta: { from: "BACKLOG", to: "BLOCKED" } })),
    ).toBe("blocked a task");
  });

  it("falls back rather than rendering a raw verb it has never heard of", () => {
    // The server vocabulary is append-only, so a client that has not been redeployed
    // will meet new verbs. "made a change" beats "TASK_SPLINED".
    const meta = verbMeta("TASK_SPLINED" as ActivityVerb);
    expect(meta.phrase).toBe("made a change");
    expect(meta.icon).toBe("Activity");
  });

  it("has an entry for every verb it claims to know", () => {
    for (const [verb, meta] of Object.entries(VERB_META)) {
      expect(meta.phrase, verb).toBeTruthy();
      // A phrase is a predicate: no subject, so it must not start with a capitalised name.
      expect(meta.phrase[0], verb).toBe(meta.phrase[0].toLowerCase());
    }
  });

  it("names an unknown actor rather than rendering an empty string", () => {
    expect(actorName(event({ id: 1, actor_name: null }))).toBe("Someone");
    expect(actorName(event({ id: 2, actor_name: "  " }))).toBe("Someone");
  });
});

describe("groupByDay", () => {
  const now = new Date("2026-03-05T12:00:00");

  it("labels today and yesterday, and dates everything older", () => {
    const days = groupByDay(
      [
        event({ id: 1, created_at: "2026-03-05T09:00:00" }),
        event({ id: 2, created_at: "2026-03-04T09:00:00" }),
        event({ id: 3, created_at: "2026-02-28T09:00:00" }),
      ],
      now,
    );
    expect(days.map((d) => d.label)).toEqual(["Today", "Yesterday", "28 Feb 2026"]);
  });

  it("puts the newest day first and keeps the server's order inside a day", () => {
    const days = groupByDay(
      [
        event({ id: 1, created_at: "2026-03-04T18:00:00" }),
        event({ id: 2, created_at: "2026-03-05T09:00:00" }),
        event({ id: 3, created_at: "2026-03-05T08:00:00" }),
      ],
      now,
    );
    expect(days[0].label).toBe("Today");
    expect(days[0].events.map((e) => e.id)).toEqual([2, 3]);
    expect(days[1].events.map((e) => e.id)).toEqual([1]);
  });

  it("returns nothing for nothing", () => {
    expect(groupByDay([], now)).toEqual([]);
  });
});

describe("countByGroup", () => {
  it("counts each verb group, for the filter chips", () => {
    expect(
      countByGroup([
        event({ id: 1, verb: "TASK_CREATED" }),
        event({ id: 2, verb: "OUTREACH_LOGGED" }),
        event({ id: 3, verb: "PROJECT_CREATED" }),
        event({ id: 4, verb: "COMPANY_CREATED" }),
      ]),
    ).toEqual({ DEAL: 1, OUTREACH: 1, DATA: 1, PEOPLE: 1 });
  });
});

describe("linkFor", () => {
  it("prefers the company, then the project", () => {
    expect(linkFor(event({ id: 1, company_id: 7, project_id: 3 }))).toBe("/companies/7");
    expect(linkFor(event({ id: 2, company_id: null, project_id: 3 }))).toBe("/projects/3");
  });

  it("links a deleted project nowhere", () => {
    // The thing it names no longer exists; a 404 is a worse answer than no link.
    expect(
      linkFor(event({ id: 3, verb: "PROJECT_DELETED", project_id: null, company_id: null })),
    ).toBeNull();
  });

  it("links nowhere for an unattached row", () => {
    expect(linkFor(event({ id: 4, project_id: null, company_id: null }))).toBeNull();
  });
});

describe("naive server timestamps are read as UTC", () => {
  it("does not age a just-written row by the viewer's UTC offset", () => {
    // Regression: `created_at` is a naive UTC column, so the JSON carries no offset and
    // `new Date(...)` parsed it as LOCAL time. In IST that made a row written one second
    // ago render as "5h" — caught by driving the real app, not by a unit test.
    const created = "2026-09-06T05:21:19";
    const now = new Date("2026-09-06T05:21:20Z");
    expect(relativeTime(created, now)).toBe("just now");
  });

  it("still honours an explicit offset when the column carries one", () => {
    // archived_at / completed_at are DateTime(timezone=True) and arrive with a zone.
    const now = new Date("2026-09-06T05:21:20Z");
    expect(relativeTime("2026-09-06T05:21:19Z", now)).toBe("just now");
    expect(relativeTime("2026-09-06T10:51:19+05:30", now)).toBe("just now");
  });

  it("groups a fresh row under Today rather than Yesterday", () => {
    // The same off-by-one on the day boundary: 00:30 UTC read as local in IST lands on
    // the previous calendar day.
    const days = groupByDay(
      [event({ id: 1, created_at: "2026-09-06T00:30:00" })],
      new Date("2026-09-06T00:31:00Z"),
    );
    expect(days[0].label).toBe("Today");
  });
});
