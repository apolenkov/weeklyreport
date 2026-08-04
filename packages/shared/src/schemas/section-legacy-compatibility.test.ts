import { describe, expect, it } from "vitest";

import {
  draftSaveSchema,
  reportSectionReadModelSchema,
  submitSectionSchema,
} from "./section.schema";

const SECTION_ID = "00000000-0000-4000-8000-000000000001";
const REPORT_ID = "00000000-0000-4000-8000-000000000002";
const AUTHOR_ID = "00000000-0000-4000-8000-000000000003";
const PROJECT_ID = "00000000-0000-4000-8000-000000000004";

const legacyDraft = () => ({
  reportSectionId: SECTION_ID,
  version: 1,
  projectStatuses: [],
  items: [],
  risks: [],
  decisions: [],
});

describe("legacy section compatibility", () => {
  it("normalizes an unversioned draft from clients deployed before status slices", () => {
    expect(draftSaveSchema.parse(legacyDraft())).toMatchObject({
      status: "draft",
      stageStatuses: [],
      activityStatuses: [],
    });
  });

  it("normalizes an unversioned submit without the activity-status slice", () => {
    expect(
      submitSectionSchema.parse({
        ...legacyDraft(),
        confirmed: true,
      }),
    ).toMatchObject({ status: "draft", activityStatuses: [] });
  });

  it("normalizes a stored section snapshot created before read-model additions", () => {
    expect(
      reportSectionReadModelSchema.parse({
        reportSectionId: SECTION_ID,
        reportId: REPORT_ID,
        authorId: AUTHOR_ID,
        authorName: "Legacy Lead",
        version: 1,
        status: "draft",
        submittedAt: null,
        projects: [
          {
            projectId: PROJECT_ID,
            projectName: "Legacy Product",
            trafficLight: null,
          },
        ],
        items: [],
        risks: [],
        decisions: [],
      }),
    ).toMatchObject({
      authorRole: "lead",
      late: false,
      referencedProjects: [],
      activities: [],
      reviews: [],
      projects: [{ ownedStages: [], stageSet: [], ownerGroupId: null }],
    });
  });
});
