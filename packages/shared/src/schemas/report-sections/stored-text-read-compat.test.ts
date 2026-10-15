import { describe, expect, it } from "vitest";

import { recordCommentViewSchema } from "../review/review.schema.js";
import {
  itemOutcomeEventSchema,
  itemResolutionSchema,
} from "./item-outcome.schema.js";
import {
  publishedDecisionReadModelSchema,
  publishedItemReadModelSchema,
  publishedRiskReadModelSchema,
} from "./published-section-record.schema.js";
import {
  decisionReadModelSchema,
  decisionWriteSchema,
  itemReadModelSchema,
  itemWriteSchema,
  riskReadModelSchema,
  riskWriteSchema,
  sharedDecisionReadModelSchema,
  sharedItemReadModelSchema,
  sharedRiskReadModelSchema,
} from "./section-record.schema.js";

// TASK-503.108: text the earlier write rule accepted and the current one
// rejects (U+2060 WORD JOINER alone, admitted before the selected invisible
// class). Reads must return it exactly; writes must keep rejecting it.
const LEGACY = "⁠";
const ID = "10800000-0000-4000-8000-000000000001";
const STABLE_ID = "10800000-0000-4000-8000-000000000002";
const PROJECT_ID = "10800000-0000-4000-8000-000000000003";
const ACTOR_ID = "10800000-0000-4000-8000-000000000004";
const EVENT_ID = "10800000-0000-4000-8000-000000000005";

const parent = { projectId: PROJECT_ID, activityId: null };
const legacyComment = {
  id: EVENT_ID,
  reviewerId: ACTOR_ID,
  text: LEGACY,
  createdAt: "2026-06-01T00:00:00.000Z",
};
const legacyState = {
  type: "current",
  workflowStatus: "paused",
  pausedReason: LEGACY,
  nextStepText: LEGACY,
  text: LEGACY,
} as const;

const item = {
  id: ID,
  stableId: STABLE_ID,
  ...parent,
  stageNames: [LEGACY],
  type: "current",
  text: LEGACY,
  tag: LEGACY,
  workflowStatus: "paused",
  carriedOver: false,
  pausedReason: LEGACY,
  nextStepText: LEGACY,
};
const risk = {
  id: ID,
  stableId: STABLE_ID,
  ...parent,
  stageNames: [LEGACY],
  risk: LEGACY,
  impact: LEGACY,
  mitigation: LEGACY,
  severity: "at-risk",
};
const decision = {
  id: ID,
  stableId: STABLE_ID,
  productId: PROJECT_ID,
  activityId: null,
  stageNames: [LEGACY],
  text: LEGACY,
  owner: LEGACY,
  impact: LEGACY,
};
const resolution = {
  kind: "wont_do",
  eventId: EVENT_ID,
  reason: LEGACY,
  actorId: ACTOR_ID,
  actorName: "Lead",
  occurredAt: "2026-06-01T00:00:00.000Z",
  previousState: legacyState,
};
const outcomeEvent = {
  id: EVENT_ID,
  stableId: STABLE_ID,
  outcome: "wont_do",
  reason: LEGACY,
  actorId: ACTOR_ID,
  actorName: "Lead",
  occurredAt: "2026-06-01T00:00:00.000Z",
  beforeState: legacyState,
  afterState: legacyState,
  reversesEventId: null,
};
// The co-lead lens omits the author-private paused reason and next step.
const sharedItem = {
  ...item,
  pausedReason: undefined,
  nextStepText: undefined,
};

describe("stored text read compatibility", () => {
  it.each([
    ["item", itemReadModelSchema, item],
    ["shared item", sharedItemReadModelSchema, sharedItem],
    ["published item", publishedItemReadModelSchema, item],
    ["risk", riskReadModelSchema, risk],
    ["shared risk", sharedRiskReadModelSchema, risk],
    ["published risk", publishedRiskReadModelSchema, risk],
    ["decision", decisionReadModelSchema, decision],
    ["shared decision", sharedDecisionReadModelSchema, decision],
    ["published decision", publishedDecisionReadModelSchema, decision],
  ] as const)(
    "reads a stored %s whose text the current write rule rejects, byte for byte",
    (_name, schema, record) => {
      expect(schema.parse(record)).toEqual(record);
    },
  );

  it("reads stored review comments, outcome history and resolution exactly", () => {
    expect(recordCommentViewSchema.parse(legacyComment).text).toBe(LEGACY);
    expect(itemOutcomeEventSchema.parse(outcomeEvent)).toEqual(outcomeEvent);
    expect(itemResolutionSchema.parse(resolution)).toEqual(resolution);
    expect(
      itemReadModelSchema.parse({
        ...item,
        comments: [legacyComment],
        resolution,
        outcomeHistory: [outcomeEvent],
      }).outcomeHistory,
    ).toEqual([outcomeEvent]);
  });

  it.each([
    [
      "item",
      itemWriteSchema,
      item,
      ["text", "tag", "pausedReason", "nextStepText"],
    ],
    ["risk", riskWriteSchema, risk, ["risk", "impact", "mitigation"]],
    ["decision", decisionWriteSchema, decision, ["text", "owner", "impact"]],
  ] as const)(
    "keeps rejecting that text in every %s write field and stage name",
    (_name, schema, record, fields) => {
      const visible = {
        ...Object.fromEntries(fields.map((field) => [field, "Visible"])),
        stageNames: ["Development"],
      };
      expect(schema.safeParse({ ...record, ...visible }).success).toBe(true);
      expect(
        schema.safeParse({ ...record, ...visible, stageNames: [LEGACY] })
          .success,
      ).toBe(false);
      for (const field of fields) {
        expect(
          schema.safeParse({ ...record, ...visible, [field]: LEGACY }).success,
        ).toBe(false);
      }
    },
  );
});
