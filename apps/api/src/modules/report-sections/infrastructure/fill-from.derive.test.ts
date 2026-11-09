// Characterization pins for the fill-from row-mappers and predicates extracted
// from LeadFormPrismaRepository.fillFromSection: the next→current status remap
// table, the activityId carry rule, and the exact createMany field mapping.
import { draftSaveSchema } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import {
  carryableDecisions,
  carryableRisks,
  isCarryable,
  remapNextToCurrentStatus,
  toFilledDecisionRows,
  toFilledItemRows,
  toFilledRiskRows,
} from "./fill-from.derive";

const TARGET = "22222222-2222-4222-8222-222222222222";
const PROJECT = "11111111-1111-4111-8111-111111111111";
const ACTIVITY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("remapNextToCurrentStatus", () => {
  it("maps planned → in_progress", () => {
    expect(remapNextToCurrentStatus("planned")).toBe("in_progress");
  });
  it("maps postponed → in_progress", () => {
    expect(remapNextToCurrentStatus("postponed")).toBe("in_progress");
  });
  it("passes in_progress / paused / done through unchanged", () => {
    expect(remapNextToCurrentStatus("in_progress")).toBe("in_progress");
    expect(remapNextToCurrentStatus("paused")).toBe("paused");
    expect(remapNextToCurrentStatus("done")).toBe("done");
  });
});

describe("isCarryable", () => {
  const targetIds = new Set([ACTIVITY]);

  it("carries a product-parented (null activityId) row", () => {
    expect(isCarryable({ activityId: null }, targetIds)).toBe(true);
  });
  it("carries an activity row whose activity is attached to the target", () => {
    expect(isCarryable({ activityId: ACTIVITY }, targetIds)).toBe(true);
  });
  it("excludes an activity row not attached to the target", () => {
    expect(isCarryable({ activityId: "other" }, targetIds)).toBe(false);
  });
  it("excludes any activity row when the target has no activities", () => {
    expect(isCarryable({ activityId: ACTIVITY }, new Set())).toBe(false);
  });
});

describe("carryable risks and decisions", () => {
  const targetIds = new Set([ACTIVITY]);
  const risk = { activityId: null, impact: "delay", mitigation: "add QA" };

  it("never copies an incomplete source risk and keeps complete ones", () => {
    const rows = [
      { id: "complete", ...risk },
      { id: "no-impact", ...risk, impact: null },
      { id: "no-mitigation", ...risk, mitigation: null },
      { id: "detached", ...risk, activityId: "other" },
    ];
    expect(carryableRisks(rows, targetIds).map(({ id }) => id)).toEqual([
      "complete",
    ]);
  });

  it("never copies an incomplete source decision, resolved or not", () => {
    const rows = [
      { id: "complete", activityId: ACTIVITY, impact: "scope" },
      { id: "draft", activityId: null, impact: null },
      { id: "resolved-draft", activityId: null, impact: null, resolvedAt: 1 },
    ];
    expect(carryableDecisions(rows, targetIds).map(({ id }) => id)).toEqual([
      "complete",
    ]);
  });
});

describe("toFilledItemRows", () => {
  it("maps to Current-Week rows with carriedOver:false and the status remap", () => {
    const rows = toFilledItemRows(
      [
        {
          projectId: PROJECT,
          activityId: null,
          text: "Ship it",
          tag: "feature",
          workflowStatus: "planned",
          pausedReason: null,
          stageNames: ["Development"],
        },
        {
          projectId: null,
          activityId: ACTIVITY,
          text: "Triage",
          tag: "chore",
          workflowStatus: "paused",
          pausedReason: "Waiting for the upstream delivery",
          stageNames: [],
        },
      ],
      TARGET,
    );

    expect(rows).toEqual([
      {
        reportSectionId: TARGET,
        projectId: PROJECT,
        activityId: null,
        type: "current",
        text: "Ship it",
        tag: "feature",
        workflowStatus: "in_progress",
        pausedReason: null,
        carriedOver: false,
        stageNames: ["Development"],
      },
      {
        reportSectionId: TARGET,
        projectId: null,
        activityId: ACTIVITY,
        type: "current",
        text: "Triage",
        tag: "chore",
        workflowStatus: "paused",
        pausedReason: "Waiting for the upstream delivery",
        carriedOver: false,
        stageNames: [],
      },
    ]);
    expect(
      draftSaveSchema.safeParse({
        reportSectionId: TARGET,
        version: 1,
        projectStatuses: [],
        items: rows,
        risks: [],
        decisions: [],
      }).success,
    ).toBe(true);
  });
});

describe("toFilledRiskRows", () => {
  it("maps risk fields and stageNames passthrough onto the target section", () => {
    const rows = toFilledRiskRows(
      [
        {
          projectId: PROJECT,
          activityId: null,
          risk: "Scope creep",
          impact: "High",
          mitigation: "Cut scope",
          severity: "at-risk",
          stageNames: ["Development"],
        },
      ],
      TARGET,
    );

    expect(rows).toEqual([
      {
        reportSectionId: TARGET,
        projectId: PROJECT,
        activityId: null,
        risk: "Scope creep",
        impact: "High",
        mitigation: "Cut scope",
        severity: "at-risk",
        stageNames: ["Development"],
      },
    ]);
  });
});

describe("toFilledDecisionRows", () => {
  it("maps decision fields, nulling deadline/resolvedAt when absent", () => {
    const deadline = new Date("2026-02-01T00:00:00.000Z");
    const rows = toFilledDecisionRows(
      [
        {
          text: "Go with Postgres",
          owner: "Lead",
          deadline,
          impact: "Infra",
          resolvedAt: null,
          stageNames: [],
          productId: PROJECT,
          activityId: null,
        },
      ],
      TARGET,
    );

    expect(rows).toEqual([
      {
        reportSectionId: TARGET,
        text: "Go with Postgres",
        owner: "Lead",
        deadline,
        impact: "Infra",
        resolvedAt: null,
        stageNames: [],
        productId: PROJECT,
        activityId: null,
      },
    ]);
  });
});
