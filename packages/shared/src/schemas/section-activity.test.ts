import { describe, expect, it } from "vitest";

import {
  draftSaveSchema,
  reportSectionReadModelSchema,
} from "./section.schema";
import { validateActivityStatuses } from "./section-validation.schema";

const ACTIVITY_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_ACTIVITY_ID = "44444444-4444-4444-8444-444444444444";
const LEAD_ID = "55555555-5555-4555-8555-555555555555";
const SECTION_ID = "66666666-6666-4666-8666-666666666666";
const REPORT_ID = "77777777-7777-4777-8777-777777777777";

const makeSection = (activities: readonly unknown[]) =>
  reportSectionReadModelSchema.parse({
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

const payload = (activityStatuses: readonly unknown[]) =>
  draftSaveSchema.parse({
    reportSectionId: SECTION_ID,
    version: 1,
    projectStatuses: [],
    activityStatuses,
    items: [],
    risks: [],
    decisions: [],
  });

describe("section activities read model", () => {
  it("normalizes an omitted activities slice on a stored section", () => {
    expect(makeSection([]).activities).toEqual([]);
  });

  it("normalizes omitted write slices on an unversioned draft", () => {
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
