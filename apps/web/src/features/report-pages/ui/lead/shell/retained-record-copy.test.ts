import type { RetainedIncompleteRecordsOutput } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../../../test-utils/expect-defined";
import { readRetainedRecordCopy } from "./retained-record-copy";

const ids = {
  report: "10000000-0000-4000-8000-000000000001",
  section: "10000000-0000-4000-8000-000000000002",
  risk: "10000000-0000-4000-8000-000000000003",
  decision: "10000000-0000-4000-8000-000000000004",
  product: "10000000-0000-4000-8000-000000000005",
  activity: "10000000-0000-4000-8000-000000000006",
};
const source = {
  reportId: ids.report,
  reportSectionId: ids.section,
  stableId: ids.risk,
  kind: "risk" as const,
};
const available = {
  status: "available",
  reportId: ids.report,
  reportSectionId: ids.section,
  periodStart: new Date("2026-05-11T00:00:00Z"),
  periodEnd: new Date("2026-05-17T00:00:00Z"),
  readOnlyReason: "archived",
  risks: [
    {
      id: "20000000-0000-4000-8000-000000000001",
      stableId: ids.risk,
      projectId: ids.product,
      risk: "Supplier delay",
      impact: null,
      mitigation: "Alternative supplier",
      severity: "blocked",
      stageNames: ["Testing"],
    },
  ],
  decisions: [
    {
      id: "20000000-0000-4000-8000-000000000002",
      stableId: ids.decision,
      productId: null,
      activityId: ids.activity,
      text: "Choose an owner",
      owner: "Historical owner",
      impact: null,
      deadline: new Date("2026-05-15T00:00:00Z"),
      resolvedAt: new Date("2026-05-16T00:00:00Z"),
      stageNames: [],
    },
  ],
} satisfies RetainedIncompleteRecordsOutput;

describe("retained source to normal create input", () => {
  it("copies only risk fields, keeping missing details missing", () => {
    const before = structuredClone(available);
    expect(readRetainedRecordCopy(available, source)).toEqual({
      kind: "risk",
      sourceParent: { kind: "product", id: ids.product },
      input: {
        text: "Supplier delay",
        impact: null,
        mitigation: "Alternative supplier",
        severity: "blocked",
        stageNames: ["Testing"],
      },
    });
    expect(available).toEqual(before);
  });

  it("omits decision source identity, historical owner and resolution date", () => {
    expect(
      readRetainedRecordCopy(available, {
        ...source,
        kind: "decision",
        stableId: ids.decision,
      }),
    ).toEqual({
      kind: "decision",
      sourceParent: { kind: "activity", id: ids.activity },
      input: {
        text: "Choose an owner",
        impact: null,
        deadline: "2026-05-15",
        stageNames: [],
      },
    });
  });

  it("does not fabricate a deadline", () => {
    const data = {
      ...available,
      decisions: available.decisions.map((row) => ({ ...row, deadline: null })),
    };
    expect(
      readRetainedRecordCopy(data, {
        ...source,
        kind: "decision",
        stableId: ids.decision,
      })?.input,
    ).toMatchObject({ deadline: "" });
  });

  it.each([
    { reportId: ids.product },
    { reportSectionId: ids.product },
    { stableId: ids.decision },
    { kind: "decision" as const },
  ])("rejects a different source coordinate %j", (mismatch) => {
    expect(
      readRetainedRecordCopy(available, { ...source, ...mismatch }),
    ).toBeNull();
  });

  it("does not copy unavailable or removed source rows", () => {
    expect(
      readRetainedRecordCopy({ status: "unavailable" }, source),
    ).toBeNull();
    expect(
      readRetainedRecordCopy({ ...available, risks: [] }, source),
    ).toBeNull();
  });

  it("does not choose one of two ambiguous source lineages", () => {
    expect(
      readRetainedRecordCopy(
        { ...available, risks: [...available.risks, ...available.risks] },
        source,
      ),
    ).toBeNull();
  });

  it("gives the composer its own stage array without modifying the source", () => {
    const copy = readRetainedRecordCopy(available, source);
    expect(expectDefined(copy).input.stageNames).not.toBe(
      expectDefined(available.risks[0]).stageNames,
    );
  });
});
