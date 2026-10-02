import { describe, expect, it } from "vitest";

import { SAFE_TEXT_MAX_LENGTH } from "../primitives/report-primitives.schema.js";
import {
  draftSaveSchema,
  MAX_ACTIVITY_NAME_LENGTH,
  reportSectionReadModelSchema,
} from "./section.schema.js";
import { validateActivityStatuses } from "./section-validation.schema.js";

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
    authorRole: "lead",
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
  it("preserves an empty activities slice on a stored section", () => {
    expect(makeSection([]).activities).toEqual([]);
  });

  it("defaults omitted activity statuses on a versioned draft", () => {
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
      jiraAccounts: [],
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

describe("activity weekly title override", () => {
  it("trims a non-blank override and preserves omission", () => {
    const parsed = payload([
      {
        activityId: ACTIVITY_ID,
        status: "green",
        titleOverride: "  Weekly duty  ",
      },
      { activityId: OTHER_ACTIVITY_ID, status: "green" },
    ]);
    expect(parsed.activityStatuses[0]?.titleOverride).toBe("Weekly duty");
    expect(parsed.activityStatuses[1]?.titleOverride).toBeUndefined();
  });

  it("normalizes blank and whitespace overrides to null", () => {
    const parsed = payload([
      { activityId: ACTIVITY_ID, status: "green", titleOverride: "" },
      {
        activityId: OTHER_ACTIVITY_ID,
        status: "green",
        titleOverride: " ".repeat(3),
      },
    ]);
    expect(parsed.activityStatuses[0]?.titleOverride).toBeNull();
    expect(parsed.activityStatuses[1]?.titleOverride).toBeNull();
  });

  it("normalizes a cleared description to null while preserving a note", () => {
    const parsed = payload([
      { activityId: ACTIVITY_ID, status: "green", note: "" },
      { activityId: OTHER_ACTIVITY_ID, status: "green", note: "  " },
      { activityId: ACTIVITY_ID, status: "green", note: "Weekly context" },
    ]);
    expect(parsed.activityStatuses.map((status) => status.note)).toEqual([
      null,
      null,
      "Weekly context",
    ]);
  });

  it("accepts a title at the name limit and a description at the safe-text limit", () => {
    const parsed = payload([
      {
        activityId: ACTIVITY_ID,
        status: "green",
        titleOverride: "x".repeat(MAX_ACTIVITY_NAME_LENGTH),
        note: "y".repeat(SAFE_TEXT_MAX_LENGTH),
      },
    ]);
    expect(parsed.activityStatuses[0]?.titleOverride).toHaveLength(
      MAX_ACTIVITY_NAME_LENGTH,
    );
    expect(parsed.activityStatuses[0]?.note).toHaveLength(SAFE_TEXT_MAX_LENGTH);
  });

  it("rejects an override longer than the catalogue name limit", () => {
    const tooLong = "x".repeat(MAX_ACTIVITY_NAME_LENGTH + 1);
    expect(() =>
      payload([
        { activityId: ACTIVITY_ID, status: "green", titleOverride: tooLong },
      ]),
    ).toThrow();
  });

  it("rejects a description longer than the existing safe-text limit", () => {
    const tooLong = "x".repeat(SAFE_TEXT_MAX_LENGTH + 1);
    expect(() =>
      payload([{ activityId: ACTIVITY_ID, status: "green", note: tooLong }]),
    ).toThrow();
  });

  it("carries the override on the stored section read model", () => {
    const section = makeSection([
      {
        activityId: ACTIVITY_ID,
        activityName: "Weekly duty",
        titleOverride: "Weekly duty",
        status: "green",
        jiraAccounts: [],
      },
    ]);
    expect(section.activities[0]?.titleOverride).toBe("Weekly duty");
    expect(section.activities[0]?.activityName).toBe("Weekly duty");
  });
});
