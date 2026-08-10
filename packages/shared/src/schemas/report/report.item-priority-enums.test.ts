import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  itemInputSchema,
  itemTypeSchema,
  itemWorkflowStatusSchema,
  reportSectionStatusSchema,
  reportStatusSchema,
  trafficLightStatusSchema,
} from "../report";

const validItem = () => ({
  projectId: randomUUID(),
  type: "current" as const,
  text: "Ship feature X",
  tag: "feature",
  workflowStatus: "in_progress" as const,
  carriedOver: false,
  stageNames: ["Development"],
});

describe("itemInputSchema priorityRank", () => {
  it.each([
    ["omitted", undefined],
    ["null", null],
    ["one", 1],
    ["without an upper bound", 99],
  ])("accepts %s", (_label, priorityRank) => {
    const input =
      priorityRank === undefined
        ? validItem()
        : { ...validItem(), priorityRank };
    expect(itemInputSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    ["zero", 0],
    ["a non-integer", 1.5],
  ])("rejects %s", (_label, priorityRank) => {
    expect(
      itemInputSchema.safeParse({ ...validItem(), priorityRank }).success,
    ).toBe(false);
  });
});

describe("report enum schemas", () => {
  it.each(["green", "yellow", "red"])(
    "accepts traffic-light status %s",
    (status) => {
      expect(trafficLightStatusSchema.safeParse(status).success).toBe(true);
    },
  );

  it.each(["blue", "", "amber"])(
    "rejects traffic-light status %s",
    (status) => {
      expect(trafficLightStatusSchema.safeParse(status).success).toBe(false);
    },
  );

  it.each(["current", "next"])("accepts item type %s", (type) => {
    expect(itemTypeSchema.safeParse(type).success).toBe(true);
  });

  it("rejects an unknown item type", () => {
    expect(itemTypeSchema.safeParse("previous").success).toBe(false);
  });

  it.each(["planned", "in_progress", "paused", "postponed", "done"])(
    "accepts workflow status %s",
    (status) => {
      expect(itemWorkflowStatusSchema.safeParse(status).success).toBe(true);
    },
  );

  it.each(["blocked", "cancelled"])("rejects workflow status %s", (status) => {
    expect(itemWorkflowStatusSchema.safeParse(status).success).toBe(false);
  });

  it.each(["draft", "submitted"])("accepts section status %s", (status) => {
    expect(reportSectionStatusSchema.safeParse(status).success).toBe(true);
  });

  it.each(["draft", "published"])("accepts report status %s", (status) => {
    expect(reportStatusSchema.safeParse(status).success).toBe(true);
  });
});
