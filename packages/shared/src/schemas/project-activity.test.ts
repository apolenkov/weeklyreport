import { describe, expect, it } from "vitest";

import {
  projectActivityCreateSchema,
  projectActivityLeadEdgeSchema,
  projectActivitySchema,
} from "./project-activity.schema";
import {
  draftSaveSchema,
  reportSectionReadModelSchema,
} from "./section.schema";
import { validateActivityStatuses } from "./section-validation.schema";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const ACTIVITY_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_ACTIVITY_ID = "44444444-4444-4444-8444-444444444444";
const LEAD_ID = "55555555-5555-4555-8555-555555555555";
const SECTION_ID = "66666666-6666-4666-8666-666666666666";
const REPORT_ID = "77777777-7777-4777-8777-777777777777";

describe("projectActivitySchema", () => {
  it("parses a full activity and defaults jiraAccounts/leadIds", () => {
    const parsed = projectActivitySchema.parse({
      id: ACTIVITY_ID,
      name: "Jira triage duty",
      groupId: GROUP_ID,
      projectId: null,
      archived: false,
    });
    expect(parsed.jiraAccounts).toEqual([]);
    expect(parsed.leadIds).toEqual([]);
  });

  it("rejects a create without a group (groupId is authoritative + required)", () => {
    const result = projectActivityCreateSchema.safeParse({
      name: "Ops rotation",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an optional label-only product link and Jira accounts", () => {
    const parsed = projectActivityCreateSchema.parse({
      name: "Ops rotation",
      groupId: GROUP_ID,
      projectId: PRODUCT_ID,
      jiraAccounts: ["OPS", "SUP-billing"],
    });
    expect(parsed.projectId).toBe(PRODUCT_ID);
    expect(parsed.jiraAccounts).toEqual(["OPS", "SUP-billing"]);
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

function makeSection(activities: unknown[]) {
  return reportSectionReadModelSchema.parse({
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: LEAD_ID,
    authorName: "Lead 1",
    version: 1,
    status: "draft",
    submittedAt: null,
    projects: [],
    items: [],
    risks: [],
    decisions: [],
    activities,
  });
}

describe("section activities read model", () => {
  it("older snapshots without the activities field still parse (default [])", () => {
    const parsed = reportSectionReadModelSchema.parse({
      reportSectionId: SECTION_ID,
      reportId: REPORT_ID,
      authorId: LEAD_ID,
      authorName: "Lead 1",
      version: 1,
      status: "draft",
      submittedAt: null,
      projects: [],
      items: [],
      risks: [],
      decisions: [],
    });
    expect(parsed.activities).toEqual([]);
  });

  it("draft-save payloads without the activity slice still parse (default [])", () => {
    const parsed = draftSaveSchema.parse({
      reportSectionId: SECTION_ID,
      version: 1,
      projectStatuses: [],
      items: [],
      risks: [],
      decisions: [],
    });
    expect(parsed.activityStatuses).toEqual([]);
  });
});

describe("validateActivityStatuses", () => {
  const seeded = makeSection([
    {
      activityId: ACTIVITY_ID,
      activityName: "Jira triage duty",
      status: "green",
    },
  ]);

  function payload(activityStatuses: unknown[]) {
    return draftSaveSchema.parse({
      reportSectionId: SECTION_ID,
      version: 1,
      projectStatuses: [],
      activityStatuses,
      items: [],
      risks: [],
      decisions: [],
    });
  }

  it("accepts a status write for a seeded activity", () => {
    const errors = validateActivityStatuses(
      seeded,
      payload([{ activityId: ACTIVITY_ID, status: "red" }]),
    );
    expect(errors).toEqual([]);
  });

  it("rejects a status write for an unattached activity", () => {
    const errors = validateActivityStatuses(
      seeded,
      payload([{ activityId: OTHER_ACTIVITY_ID, status: "red" }]),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe("ACTIVITY_NOT_ATTACHED");
  });

  it("rejects every id when the section has no seeded activities", () => {
    const errors = validateActivityStatuses(
      makeSection([]),
      payload([{ activityId: ACTIVITY_ID, status: "green" }]),
    );
    expect(errors).toHaveLength(1);
  });
});
