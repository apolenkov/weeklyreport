import { describe, expect, it } from "vitest";

import {
  projectActivityCreateSchema,
  projectActivityLeadEdgeSchema,
  projectActivitySchema,
  projectActivityUpdateSchema,
} from "./project-activity.schema";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_PRODUCT_ID = "2222aaaa-2222-4222-8222-2222222222aa";
const ACTIVITY_ID = "33333333-3333-4333-8333-333333333333";
const LEAD_ID = "55555555-5555-4555-8555-555555555555";

describe("projectActivitySchema", () => {
  it("parses a full activity and defaults jiraAccounts/leadIds", () => {
    const parsed = projectActivitySchema.parse({
      id: ACTIVITY_ID,
      name: "Jira triage duty",
      groupId: GROUP_ID,
      archived: false,
    });
    expect(parsed.linkedProducts).toEqual([]);
    expect(parsed.jiraAccounts).toEqual([]);
    expect(parsed.leadIds).toEqual([]);
  });

  it("rejects a create without a group (groupId is authoritative + required)", () => {
    const result = projectActivityCreateSchema.safeParse({
      name: "Ops rotation",
    });
    expect(result.success).toBe(false);
  });

  it("accepts label-only product links and Jira accounts", () => {
    const parsed = projectActivityCreateSchema.parse({
      name: "Ops rotation",
      groupId: GROUP_ID,
      linkedProductIds: [PRODUCT_ID],
      jiraAccounts: ["OPS", "SUP-billing"],
    });
    expect(parsed.linkedProductIds).toEqual([PRODUCT_ID]);
    expect(parsed.jiraAccounts).toEqual(["OPS", "SUP-billing"]);
  });

  it("rejects a create whose linkedProductIds repeats a product id", () => {
    const result = projectActivityCreateSchema.safeParse({
      name: "Ops rotation",
      groupId: GROUP_ID,
      linkedProductIds: [PRODUCT_ID, PRODUCT_ID],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "linkedProductIds must not contain duplicates",
    );
  });

  it("rejects a create whose linkedProductIds repeat a product id in a different case", () => {
    const result = projectActivityCreateSchema.safeParse({
      name: "Ops rotation",
      groupId: GROUP_ID,
      linkedProductIds: [OTHER_PRODUCT_ID.toUpperCase(), OTHER_PRODUCT_ID],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "linkedProductIds must not contain duplicates",
    );
  });

  it("normalizes an uppercase linkedProductId to lowercase", () => {
    const parsed = projectActivityCreateSchema.parse({
      name: "Ops rotation",
      groupId: GROUP_ID,
      linkedProductIds: [OTHER_PRODUCT_ID.toUpperCase()],
    });
    expect(parsed.linkedProductIds).toEqual([OTHER_PRODUCT_ID]);
  });

  it("normalizes an uppercase linkedProductId to lowercase on update too", () => {
    const parsed = projectActivityUpdateSchema.parse({
      id: ACTIVITY_ID,
      name: "Ops rotation",
      groupId: GROUP_ID,
      linkedProductIds: [OTHER_PRODUCT_ID.toUpperCase()],
    });
    expect(parsed.linkedProductIds).toEqual([OTHER_PRODUCT_ID]);
  });

  it("defaults linkedProductIds to an empty array when absent", () => {
    const parsed = projectActivityCreateSchema.parse({
      name: "Ops rotation",
      groupId: GROUP_ID,
    });
    expect(parsed.linkedProductIds).toEqual([]);
  });

  it("accepts a create whose linkedProductIds are unique", () => {
    const result = projectActivityCreateSchema.safeParse({
      name: "Ops rotation",
      groupId: GROUP_ID,
      linkedProductIds: [PRODUCT_ID, OTHER_PRODUCT_ID],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an update whose linkedProductIds repeats a product id", () => {
    const result = projectActivityUpdateSchema.safeParse({
      id: ACTIVITY_ID,
      name: "Ops rotation",
      groupId: GROUP_ID,
      linkedProductIds: [PRODUCT_ID, PRODUCT_ID],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "linkedProductIds must not contain duplicates",
    );
  });

  it("accepts an update whose linkedProductIds are unique", () => {
    const result = projectActivityUpdateSchema.safeParse({
      id: ACTIVITY_ID,
      name: "Ops rotation",
      groupId: GROUP_ID,
      linkedProductIds: [PRODUCT_ID, OTHER_PRODUCT_ID],
    });
    expect(result.success).toBe(true);
  });

  it("requires both sides of the attach/detach edge", () => {
    expect(
      projectActivityLeadEdgeSchema.safeParse({ activityId: ACTIVITY_ID })
        .success,
    ).toBe(false);
    expect(
      projectActivityLeadEdgeSchema.safeParse({
        activityId: ACTIVITY_ID,
        leadId: LEAD_ID,
      }).success,
    ).toBe(true);
  });
});
