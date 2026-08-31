import { describe, expect, it } from "vitest";

import { groundingRecord } from "./grounding-record.js";
import type { SearchCandidate } from "./report-retrieval.types.js";

const context: SearchCandidate["context"] = {
  reportId: "report",
  periodId: "period",
  periodLabel: "Week 31",
  periodStart: new Date("2026-08-04T00:00:00.000Z"),
  source: "live",
  sectionId: "section",
  authorId: "author",
  authorName: "Lead",
  subject: { kind: "product", id: "product", name: "Portal" },
  stageIds: ["Development"],
  linkedProductIds: ["linked-product"],
};

const identity = {
  occurrenceId: "occurrence",
  recordId: "record",
  lineageId: null,
};

const candidates: readonly SearchCandidate[] = [
  {
    kind: "item",
    identity,
    context,
    text: "Shipped",
    itemType: "current",
    workflowStatus: "done",
    carriedOver: false,
    priorityRank: 1,
  },
  {
    kind: "risk",
    identity,
    context,
    risk: "Delay",
    impact: "Launch",
    mitigation: "Escalate",
    severity: "blocked",
  },
  {
    kind: "decision",
    identity,
    context,
    text: "Launch",
    impact: "Customers",
    owner: "Lead",
    deadline: new Date("2026-08-08T00:00:00.000Z"),
    resolvedAt: null,
  },
  { kind: "product_status", identity, context, status: "on-track" },
  { kind: "stage_status", identity, context, status: "at-risk" },
  {
    kind: "activity_status",
    identity,
    context,
    status: "blocked",
    note: "Blocked",
  },
];

describe("groundingRecord", () => {
  it("projects every candidate kind without retrieval identities", () => {
    const records = candidates.map(groundingRecord);
    const serialized = JSON.stringify(records);

    expect(records.map(({ kind }) => kind)).toEqual([
      "item",
      "risk",
      "decision",
      "product_status",
      "stage_status",
      "activity_status",
    ]);
    expect(serialized).toContain("Shipped");
    expect(serialized).toContain("2026-08-08T00:00:00.000Z");
    expect(serialized).not.toContain("occurrence");
    expect(serialized).not.toContain("linked-product");
  });
});
