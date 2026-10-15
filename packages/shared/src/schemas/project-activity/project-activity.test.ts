import { describe, expect, it } from "vitest";

import {
  projectActivityArchiveSchema,
  projectActivityCreateSchema,
  projectActivityLeadEdgeSchema,
  projectActivitySchema,
  projectActivityUpdateSchema,
} from "./project-activity.schema.js";

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

  // TASK-503.108: reads keep stored text the write rule rejects; only a null
  // byte, which PostgreSQL text cannot hold, still fails closed.
  it.each(
    (["name", "jiraAccounts"] as const).flatMap((field) =>
      [" ".repeat(3), "\u200B\u200D\u2060", "x".repeat(201)].map((text) => ({
        field,
        text,
      })),
    ),
  )("reads persisted $field text $text exactly", ({ field, text }) => {
    const parsed = projectActivitySchema.parse({
      id: ACTIVITY_ID,
      name: "Ops",
      groupId: GROUP_ID,
      archived: false,
      [field]: field === "name" ? text : [text],
    });
    expect(field === "name" ? parsed.name : parsed.jiraAccounts).toEqual(
      field === "name" ? text : [text],
    );
  });

  it.each(["name", "jiraAccounts"] as const)(
    "rejects a persisted %s with a null byte",
    (field) => {
      const text = "visible\u0000text";
      const base = {
        id: ACTIVITY_ID,
        name: "Ops",
        groupId: GROUP_ID,
        archived: false,
      };
      const result = projectActivitySchema.safeParse({
        ...base,
        [field]: field === "name" ? text : [text],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(
        field === "name" ? ["name"] : ["jiraAccounts", 0],
      );
    },
  );

  it("retains write guards for invisible and null-byte text", () => {
    for (const text of [" ".repeat(3), "\u200B\u200D", "visible\u0000text"]) {
      expect(
        projectActivityCreateSchema.safeParse({ name: text, groupId: GROUP_ID })
          .success,
      ).toBe(false);
      expect(
        projectActivityUpdateSchema.safeParse({
          id: ACTIVITY_ID,
          name: "Ops",
          groupId: GROUP_ID,
          jiraAccounts: [text],
        }).success,
      ).toBe(false);
    }
  });

  it.each([" Ops ", "one\ntwo", "x".repeat(100)])(
    "preserves visible persisted text bytes %j",
    (text) => {
      const result = projectActivitySchema.parse({
        id: ACTIVITY_ID,
        name: text,
        groupId: GROUP_ID,
        archived: false,
        jiraAccounts: [text],
      });
      expect(result.name).toBe(text);
      expect(result.jiraAccounts).toEqual([text]);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.jiraAccounts)).toBe(true);
    },
  );

  it("reads stored names and Jira accounts past the write bounds without cardinality limits", () => {
    const base = {
      id: ACTIVITY_ID,
      name: "x".repeat(200),
      groupId: GROUP_ID,
      archived: false,
      jiraAccounts: ["x".repeat(100)],
    };
    expect(projectActivitySchema.safeParse(base).success).toBe(true);
    expect(
      projectActivitySchema.safeParse({ ...base, name: "x".repeat(201) })
        .success,
    ).toBe(true);
    expect(
      projectActivitySchema.safeParse({
        ...base,
        jiraAccounts: ["x".repeat(101)],
      }).success,
    ).toBe(true);
    expect(
      projectActivityCreateSchema.safeParse({
        name: "x".repeat(201),
        groupId: GROUP_ID,
      }).success,
    ).toBe(false);
    expect(projectActivitySchema.safeParse({ ...base, name: "" }).success).toBe(
      false,
    );
    expect(
      projectActivitySchema.safeParse({ ...base, jiraAccounts: [""] }).success,
    ).toBe(false);
    expect(
      projectActivitySchema.parse({
        ...base,
        jiraAccounts: Array.from({ length: 21 }, () => "JIRA"),
      }).jiraAccounts,
    ).toHaveLength(21);
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

  // Letter-bearing ids: toUpperCase() must change them or the cases pass vacuously.
  describe("canonical lowercase write ids", () => {
    const LETTER_GROUP_ID = "aaaaaaaa-1111-4111-8111-1111111111aa";
    const LETTER_ACTIVITY_ID = "bbbbbbbb-3333-4333-8333-3333333333bb";
    const LETTER_LEAD_ID = "cccccccc-5555-4555-8555-5555555555cc";

    it("lowercases the group id on create and update", () => {
      expect(
        projectActivityCreateSchema.parse({
          name: "Ops",
          groupId: LETTER_GROUP_ID.toUpperCase(),
        }).groupId,
      ).toBe(LETTER_GROUP_ID);
      expect(
        projectActivityUpdateSchema.parse({
          id: LETTER_ACTIVITY_ID,
          name: "Ops",
          groupId: LETTER_GROUP_ID.toUpperCase(),
        }).groupId,
      ).toBe(LETTER_GROUP_ID);
    });

    it("lowercases the activity id on update and archive", () => {
      expect(
        projectActivityUpdateSchema.parse({
          id: LETTER_ACTIVITY_ID.toUpperCase(),
          name: "Ops",
          groupId: GROUP_ID,
        }).id,
      ).toBe(LETTER_ACTIVITY_ID);
      expect(
        projectActivityArchiveSchema.parse({
          id: LETTER_ACTIVITY_ID.toUpperCase(),
          archived: true,
        }).id,
      ).toBe(LETTER_ACTIVITY_ID);
    });

    it("lowercases both ids of a lead edge", () => {
      expect(
        projectActivityLeadEdgeSchema.parse({
          activityId: LETTER_ACTIVITY_ID.toUpperCase(),
          leadId: LETTER_LEAD_ID.toUpperCase(),
        }),
      ).toEqual({ activityId: LETTER_ACTIVITY_ID, leadId: LETTER_LEAD_ID });
    });
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
