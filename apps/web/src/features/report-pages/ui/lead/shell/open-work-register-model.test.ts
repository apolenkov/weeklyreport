import type { LeadOpenWorkHistoryOccurrence } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import {
  openWorkOutsideTimeline,
  projectOpenWorkRegister,
} from "./open-work-register-model";

const REPORT_ID = "10000000-0000-4000-8000-000000000001";
const SECTION_ID = "10000000-0000-4000-8000-000000000002";
const PROJECT_ID = "10000000-0000-4000-8000-000000000003";

function occurrence(
  stableId: string,
  workflowStatus: LeadOpenWorkHistoryOccurrence["item"]["workflowStatus"],
  overrides: Partial<LeadOpenWorkHistoryOccurrence["item"]> = {},
): LeadOpenWorkHistoryOccurrence {
  return {
    source: "published",
    reportId: REPORT_ID,
    reportSectionId: SECTION_ID,
    periodStart: new Date("2026-08-17T00:00:00.000Z"),
    periodEnd: new Date("2026-08-23T00:00:00.000Z"),
    parent: { kind: "product", id: PROJECT_ID, name: "Payments" },
    item: {
      id: crypto.randomUUID(),
      stableId,
      projectId: PROJECT_ID,
      activityId: null,
      type: workflowStatus === "postponed" ? "next" : "current",
      text: "Historical work",
      tag: "delivery",
      workflowStatus,
      carriedOver: false,
      pausedReason: workflowStatus === "paused" ? "Waiting for legal" : null,
      stageNames: ["Development"],
      ...overrides,
    },
  };
}

describe("projectOpenWorkRegister", () => {
  it("does not repeat open tasks already shown in the adjacent timeline", () => {
    const register = projectOpenWorkRegister(
      [
        occurrence("adjacent", "planned"),
        occurrence("gap", "paused"),
        occurrence("terminal", "done"),
      ],
      [],
    );
    expect(
      openWorkOutsideTimeline(register.openItems, [
        { stableId: "adjacent" },
      ]).map((item) => item.key),
    ).toEqual(["gap"]);
    expect(register.terminalItems.map((item) => item.key)).toEqual([
      "terminal",
    ]);
  });
  it("keeps only the newest occurrence and lets terminal state suppress older open work", () => {
    const stableId = "20000000-0000-4000-8000-000000000001";
    const terminal = projectOpenWorkRegister(
      [occurrence(stableId, "done"), occurrence(stableId, "paused")],
      [],
    );
    expect(terminal.openItems).toEqual([]);
    expect(terminal.terminalItems).toHaveLength(1);
    expect(terminal.terminalItems[0]?.occurrence.item.workflowStatus).toBe(
      "done",
    );
    expect(terminal.terminalItems[0]?.action).toEqual({
      kind: "reopen",
      label: "Reopen in this report",
    });

    const newest = occurrence(stableId, "paused");
    expect(
      projectOpenWorkRegister(
        [newest, occurrence(stableId, "in_progress")],
        [],
      ),
    ).toEqual({
      openItems: [
        expect.objectContaining({
          occurrence: newest,
          action: { kind: "resume", label: "Resume paused work" },
        }),
      ],
      terminalItems: [],
    });
  });

  it("treats cancellation as terminal even when the progress tuple is open", () => {
    const stableId = "20000000-0000-4000-8000-000000000002";
    expect(
      projectOpenWorkRegister(
        [
          occurrence(stableId, "paused", {
            resolution: {
              kind: "wont_do",
              eventId: "30000000-0000-4000-8000-000000000001",
              reason: "Scope removed",
              actorId: "30000000-0000-4000-8000-000000000002",
              actorName: "Test Lead",
              occurredAt: "2026-08-23T12:00:00.000Z",
              previousState: {
                type: "current",
                workflowStatus: "paused",
                pausedReason: "Waiting for legal",
                nextStepText: null,
                text: null,
              },
            },
          }),
          occurrence(stableId, "in_progress"),
        ],
        [],
      ),
    ).toMatchObject({
      openItems: [],
      terminalItems: [
        {
          action: { kind: "reopen", label: "Reopen in this report" },
        },
      ],
    });
  });

  it("excludes every task already present in the current draft", () => {
    const stableId = "20000000-0000-4000-8000-000000000003";
    expect(
      projectOpenWorkRegister(
        [occurrence(stableId, "postponed")],
        [{ stableId }],
      ),
    ).toEqual({ openItems: [], terminalItems: [] });
  });

  it("keeps paused and deferred work across arbitrary period gaps with explicit actions", () => {
    const paused = occurrence("20000000-0000-4000-8000-000000000004", "paused");
    const deferred = occurrence(
      "20000000-0000-4000-8000-000000000005",
      "postponed",
    );
    const projected = projectOpenWorkRegister([paused, deferred], []);

    expect(projected.openItems.map((item) => item.action)).toEqual([
      { kind: "resume", label: "Resume paused work" },
      { kind: "replan", label: "Replan deferred work" },
    ]);
    expect(projected.openItems.map((item) => item.periodLabel)).toEqual([
      "Aug 17–23, 2026",
      "Aug 17–23, 2026",
    ]);
    expect(projected.terminalItems).toEqual([]);
  });

  it("projects an uncommitted current planned occurrence once as automatically paused without mutating it", () => {
    const uncommitted = occurrence(
      "20000000-0000-4000-8000-000000000006",
      "planned",
    );
    const register = projectOpenWorkRegister([uncommitted], []);

    expect(register.openItems).toHaveLength(1);
    const projected = register.openItems[0];
    expect(projected?.automaticPauseReason).toBe(
      "Not scheduled for the new week",
    );
    expect(projected?.action).toEqual({
      kind: "resume",
      label: "Resume paused work",
    });
    // Projection only: the historical occurrence keeps its stored tuple.
    expect(projected?.occurrence.item.workflowStatus).toBe("planned");
    expect(projected?.occurrence.item.pausedReason).toBeNull();
  });

  it("keeps a planned item with an explicit commitment out of the automatic pause", () => {
    const committed = occurrence(
      "20000000-0000-4000-8000-000000000007",
      "planned",
      { nextStepText: "Ship the staged rollout" },
    );
    const register = projectOpenWorkRegister([committed], []);

    expect(register.openItems[0]?.automaticPauseReason).toBeNull();
    expect(register.openItems[0]?.action).toEqual({
      kind: "plan",
      label: "Plan this work",
    });
  });

  it("does not auto-pause a next-period planned commitment", () => {
    const nextPlan = occurrence(
      "20000000-0000-4000-8000-000000000008",
      "planned",
      { type: "next" },
    );
    const register = projectOpenWorkRegister([nextPlan], []);

    expect(register.openItems[0]?.automaticPauseReason).toBeNull();
    expect(register.openItems[0]?.action).toEqual({
      kind: "plan",
      label: "Plan this work",
    });
  });

  it("auto-pauses only the newest occurrence of a lineage", () => {
    const stableId = "20000000-0000-4000-8000-000000000009";
    const register = projectOpenWorkRegister(
      [occurrence(stableId, "in_progress"), occurrence(stableId, "planned")],
      [],
    );

    expect(register.openItems).toHaveLength(1);
    expect(register.openItems[0]?.occurrence.item.workflowStatus).toBe(
      "in_progress",
    );
    expect(register.openItems[0]?.automaticPauseReason).toBeNull();
    expect(register.openItems[0]?.action).toEqual({
      kind: "continue",
      label: "Continue work",
    });
  });
});
