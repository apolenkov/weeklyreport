import { describe, expect, it } from "vitest";

import {
  itemOutcomeEventSchema,
  itemOutcomeResultSchema,
  itemOutcomeStateSchema,
  itemResolutionSchema,
  promotePlanInputSchema,
  resolvePlanInputSchema,
  restorePlanInputSchema,
} from "../../index";
import { publishedItemReadModelSchema } from "./published-section-record.schema";
import { itemReadModelSchema, itemWriteSchema } from "./section-record.schema";

const IDs = {
  record: "10000000-0000-4000-8000-000000000001",
  stable: "10000000-0000-4000-8000-000000000002",
  report: "10000000-0000-4000-8000-000000000003",
  section: "10000000-0000-4000-8000-000000000004",
  command: "10000000-0000-4000-8000-000000000005",
  event: "10000000-0000-4000-8000-000000000006",
  actor: "10000000-0000-4000-8000-000000000007",
  project: "10000000-0000-4000-8000-000000000008",
};

const currentState = {
  type: "current" as const,
  workflowStatus: "in_progress" as const,
  pausedReason: null,
  nextStepText: null,
  text: "Delivered the API",
};

const resolution = {
  kind: "wont_do" as const,
  eventId: IDs.event,
  reason: "The dependency was retired.",
  actorId: IDs.actor,
  actorName: "Lead",
  occurredAt: "2026-09-04T12:00:00.000Z",
  previousState: currentState,
};

const outcomeEvent = {
  id: IDs.event,
  stableId: IDs.stable,
  outcome: "wont_do" as const,
  reason: resolution.reason,
  actorId: IDs.actor,
  actorName: "Lead",
  occurredAt: "2026-09-04T12:00:00.000Z",
  beforeState: currentState,
  afterState: currentState,
  reversesEventId: null,
};

const readItem = {
  id: IDs.record,
  stableId: IDs.stable,
  projectId: IDs.project,
  activityId: null,
  type: "current" as const,
  text: "Completed the API contract.",
  tag: "delivery",
  workflowStatus: "in_progress" as const,
  carriedOver: false,
  priorityRank: null,
  pausedReason: null,
  nextStepText: null,
  stageNames: ["Development"],
};

describe("item outcome contracts", () => {
  it("accepts all server-resolved outcome commands and both source kinds", () => {
    const base = {
      reportSectionId: IDs.section,
      version: 1,
      commandId: IDs.command,
      source: { kind: "current" as const, recordId: IDs.record },
    };

    for (const outcome of ["done", "continue", "plan_next"] as const) {
      expect(
        resolvePlanInputSchema.safeParse({
          ...base,
          outcome,
          text: "Validate next week",
        }).success,
      ).toBe(true);
    }
    expect(
      resolvePlanInputSchema.safeParse({ ...base, outcome: "plan_next" })
        .success,
    ).toBe(false);
    expect(
      resolvePlanInputSchema.safeParse({
        ...base,
        outcome: "continue",
        nextStepText: "Verify the production metrics.",
      }).success,
    ).toBe(true);
    expect(
      resolvePlanInputSchema.safeParse({
        ...base,
        outcome: "wont_do",
        reason: "The work is no longer needed.",
      }).success,
    ).toBe(true);
    expect(
      resolvePlanInputSchema.safeParse({
        ...base,
        source: {
          kind: "prior",
          reportId: IDs.report,
          recordId: IDs.record,
        },
        outcome: "done",
      }).success,
    ).toBe(true);
  });

  it("rejects forged ownership fields and invalid won't-do reasons", () => {
    const base = {
      reportSectionId: IDs.section,
      version: 1,
      commandId: IDs.command,
      source: { kind: "current" as const, recordId: IDs.record },
      outcome: "done" as const,
    };

    expect(
      resolvePlanInputSchema.safeParse({ ...base, stableId: IDs.stable })
        .success,
    ).toBe(false);
    expect(
      resolvePlanInputSchema.safeParse({ ...base, actorId: IDs.actor }).success,
    ).toBe(false);
    expect(
      resolvePlanInputSchema.safeParse({
        ...base,
        occurredAt: "2026-09-04T12:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      resolvePlanInputSchema.safeParse({
        ...base,
        outcome: "wont_do",
      }).success,
    ).toBe(false);
    expect(
      resolvePlanInputSchema.safeParse({
        ...base,
        outcome: "wont_do",
        reason: " ".repeat(3),
      }).success,
    ).toBe(false);
    expect(
      resolvePlanInputSchema.safeParse({ ...base, reason: "Not applicable" })
        .success,
    ).toBe(false);
    for (const outcome of ["done", "plan_next"] as const) {
      expect(
        resolvePlanInputSchema.safeParse({
          ...base,
          outcome,
          nextStepText: "Not allowed here",
        }).success,
      ).toBe(false);
    }
    expect(
      resolvePlanInputSchema.safeParse({
        ...base,
        outcome: "wont_do",
        reason: "No longer needed.",
        nextStepText: "Not allowed here",
      }).success,
    ).toBe(false);
  });

  it("strictly accepts only the restore command identity", () => {
    const input = {
      reportSectionId: IDs.section,
      version: 1,
      commandId: IDs.command,
      recordId: IDs.record,
    };

    expect(restorePlanInputSchema.safeParse(input).success).toBe(true);
    expect(
      restorePlanInputSchema.safeParse({ ...input, actorId: IDs.actor })
        .success,
    ).toBe(false);
  });

  it("enforces the canonical current/next state tuple", () => {
    expect(itemOutcomeStateSchema.safeParse(currentState).success).toBe(true);
    expect(
      itemOutcomeStateSchema.safeParse({
        type: "current",
        workflowStatus: "paused",
        pausedReason: "Waiting for access.",
        nextStepText: null,
      }).success,
    ).toBe(true);
    expect(
      itemOutcomeStateSchema.safeParse({
        type: "next",
        workflowStatus: "postponed",
        pausedReason: null,
        nextStepText: null,
      }).success,
    ).toBe(true);
    expect(
      itemOutcomeStateSchema.safeParse({
        ...currentState,
        workflowStatus: "postponed",
      }).success,
    ).toBe(true);
    expect(
      itemOutcomeStateSchema.safeParse({
        ...currentState,
        workflowStatus: "paused",
      }).success,
    ).toBe(false);
    expect(
      itemOutcomeStateSchema.safeParse({
        ...currentState,
        pausedReason: "Unneeded reason",
      }).success,
    ).toBe(false);
    expect(
      itemOutcomeStateSchema.safeParse({
        ...currentState,
        workflowStatus: "done",
        nextStepText: "Carry this forward",
      }).success,
    ).toBe(false);
  });

  it("retains outcome metadata for reads while ordinary writes strip it", () => {
    const parsed = itemReadModelSchema.parse({
      ...readItem,
      resolution,
      outcomeHistory: [outcomeEvent],
    });
    const written = itemWriteSchema.parse({
      ...readItem,
      resolution,
      outcomeHistory: [outcomeEvent],
    });

    expect(parsed.resolution).toEqual(resolution);
    expect(parsed.outcomeHistory).toEqual([outcomeEvent]);
    expect(itemReadModelSchema.safeParse(readItem).success).toBe(true);
    expect(publishedItemReadModelSchema.safeParse(readItem).success).toBe(true);
    expect(written).not.toHaveProperty("resolution");
    expect(written).not.toHaveProperty("outcomeHistory");
  });

  it("defaults the retained transition text for older stored events", () => {
    const withText = { ...currentState, text: "Delivered the API" };
    const replaced = itemOutcomeEventSchema.parse({
      ...outcomeEvent,
      beforeState: withText,
      afterState: { ...withText, text: "Promoted next step" },
    });

    const legacyState = {
      type: "current" as const,
      workflowStatus: "in_progress" as const,
      pausedReason: null,
      nextStepText: null,
    };

    expect(itemOutcomeStateSchema.parse(legacyState).text).toBeNull();
    expect(itemOutcomeStateSchema.safeParse(withText).success).toBe(true);
    expect(replaced.beforeState.text).toBe("Delivered the API");
    expect(replaced.afterState.text).toBe("Promoted next step");
  });

  it("accepts the promotion command shape and rejects stray keys", () => {
    const promotion = {
      reportSectionId: IDs.stable,
      version: 1,
      commandId: IDs.event,
      recordId: IDs.actor,
    };

    expect(promotePlanInputSchema.safeParse(promotion).success).toBe(true);
    expect(
      promotePlanInputSchema.safeParse({ ...promotion, target: "next" })
        .success,
    ).toBe(true);
    expect(
      promotePlanInputSchema.safeParse({ ...promotion, target: "later" })
        .success,
    ).toBe(false);
    expect(
      promotePlanInputSchema.safeParse({ ...promotion, text: "Not allowed" })
        .success,
    ).toBe(false);
    expect(
      promotePlanInputSchema.safeParse({ ...promotion, version: 0 }).success,
    ).toBe(false);
  });

  it("validates server-owned resolution/audit metadata and reconciled results", () => {
    expect(itemResolutionSchema.safeParse(resolution).success).toBe(true);
    expect(
      itemResolutionSchema.safeParse({ ...resolution, actorName: "  " })
        .success,
    ).toBe(false);
    expect(itemOutcomeEventSchema.safeParse(outcomeEvent).success).toBe(true);
    expect(
      itemOutcomeEventSchema.safeParse({
        ...outcomeEvent,
        occurredAt: "not-a-datetime",
      }).success,
    ).toBe(false);
    expect(
      itemOutcomeResultSchema.safeParse({
        stableId: IDs.stable,
        replayed: false,
        section: {
          reportSectionId: IDs.section,
          reportId: IDs.report,
          authorId: IDs.actor,
          authorName: "Lead",
          authorRole: "lead",
          version: 1,
          status: "draft",
          submittedAt: null,
          projects: [],
          items: [],
          risks: [],
          decisions: [],
        },
      }).success,
    ).toBe(true);
  });
});
