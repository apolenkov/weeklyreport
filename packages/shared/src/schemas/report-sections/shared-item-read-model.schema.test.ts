import { describe, expect, it } from "vitest";

import {
  itemReadModelSchema,
  sharedItemReadModelSchema,
} from "./section-record.schema.js";

const IDS = {
  item: "10000000-0000-4000-8000-000000000001",
  stable: "10000000-0000-4000-8000-000000000002",
  project: "10000000-0000-4000-8000-000000000003",
  event: "10000000-0000-4000-8000-000000000004",
  actor: "10000000-0000-4000-8000-000000000005",
};
const PRIVATE_SENTINEL = "PRIVATE_NESTED_PAUSE_REASON";
const PRIVATE_NEXT_STEP = "PRIVATE_NEXT_STEP";
const pausedState = {
  type: "current" as const,
  workflowStatus: "paused" as const,
  pausedReason: PRIVATE_SENTINEL,
  nextStepText: null,
  text: null,
};
const resolution = {
  kind: "wont_do" as const,
  eventId: IDS.event,
  reason: PRIVATE_SENTINEL,
  actorId: IDS.actor,
  actorName: PRIVATE_SENTINEL,
  occurredAt: "2026-09-08T08:00:00.000Z",
  previousState: pausedState,
};
const outcomeEvent = {
  id: IDS.event,
  stableId: IDS.stable,
  outcome: "wont_do" as const,
  reason: PRIVATE_SENTINEL,
  actorId: IDS.actor,
  actorName: PRIVATE_SENTINEL,
  occurredAt: "2026-09-08T08:00:00.000Z",
  beforeState: pausedState,
  afterState: pausedState,
  reversesEventId: null,
};
const sharedPausedItem = {
  id: IDS.item,
  stableId: IDS.stable,
  projectId: IDS.project,
  activityId: null,
  type: "current" as const,
  text: "Paused shared work",
  tag: "delivery",
  workflowStatus: "paused" as const,
  carriedOver: false,
  priorityRank: null,
  stageNames: ["Development"],
};

describe("sharedItemReadModelSchema", () => {
  it("accepts a paused shared item without its author-private reason", () => {
    expect(sharedItemReadModelSchema.parse(sharedPausedItem)).toMatchObject({
      id: IDS.item,
      stableId: IDS.stable,
      workflowStatus: "paused",
    });
  });

  it.each([
    ["top-level pause reason", { pausedReason: PRIVATE_SENTINEL }],
    ["next-step commitment", { nextStepText: PRIVATE_NEXT_STEP }],
    ["next-step null", { nextStepText: null }],
    ["resolution audit", { resolution }],
    ["outcome history", { outcomeHistory: [outcomeEvent] }],
  ])("rejects injected author-private %s", (_label, injected) => {
    expect(
      sharedItemReadModelSchema.safeParse({
        ...sharedPausedItem,
        ...injected,
      }).success,
    ).toBe(false);
  });

  it("keeps the next-step commitment in the author-visible contract", () => {
    const nextStepText = "Continue with the integration";
    const parsed = itemReadModelSchema.parse({
      ...sharedPausedItem,
      nextStepText,
      pausedReason: PRIVATE_SENTINEL,
    });

    expect(parsed.nextStepText).toBe(nextStepText);
  });

  it("keeps the complete outcome audit in the author-visible contract", () => {
    const parsed = itemReadModelSchema.parse({
      ...sharedPausedItem,
      pausedReason: PRIVATE_SENTINEL,
      resolution,
      outcomeHistory: [outcomeEvent],
    });

    expect(parsed.resolution).toEqual(resolution);
    expect(parsed.outcomeHistory).toEqual([outcomeEvent]);
  });
});
