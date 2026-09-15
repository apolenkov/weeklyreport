import {
  type DraftSaveInput,
  type ReportSectionReadModel,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { mergeSection } from "./report-section-merge";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const STAGE_ID = "55555555-5555-4555-8555-555555555555";

const section: ReportSectionReadModel = {
  reportSectionId: SECTION_ID,
  reportId: REPORT_ID,
  authorId: AUTHOR_ID,
  authorName: "Alice Lead",
  authorRole: "lead",
  version: 1,
  status: "draft",
  submittedAt: null,
  late: false,
  projects: [
    {
      projectId: PROJECT_ID,
      projectName: "CRM Portal",
      trafficLight: null,
      ownedStages: [
        {
          stageId: STAGE_ID,
          stageName: "Development",
          sortOrder: 0,
          status: null,
        },
      ],
      stageSet: [],
      ownerGroupId: null,
    },
  ],
  referencedProjects: [],
  items: [],
  risks: [],
  decisions: [],
  activities: [],
  reviews: [],
};

const baseInput: DraftSaveInput = {
  reportSectionId: SECTION_ID,
  version: 1,
  status: "draft",
  projectStatuses: [],
  stageStatuses: [],
  activityStatuses: [],
  items: [],
  risks: [],
  decisions: [],
};

// Injected at the boundary; the pure seam must never read the wall clock.
const NOW = new Date("2026-05-29T12:00:00.000Z");

describe("mergeSection traffic-light aggregation", () => {
  const greenSection: ReportSectionReadModel = {
    ...section,
    projects: [
      {
        projectId: PROJECT_ID,
        projectName: "CRM Portal",
        trafficLight: null,
        ownedStages: [
          {
            stageId: STAGE_ID,
            stageName: "Development",
            sortOrder: 0,
            status: "green",
          },
        ],
        stageSet: [],
        ownerGroupId: null,
      },
    ],
  };

  it("aggregates an already-derived red stage status into the project", () => {
    const merged = mergeSection(
      section,
      {
        ...baseInput,
        projectStatuses: [{ projectId: PROJECT_ID, status: "green" }],
        stageStatuses: [
          {
            projectId: PROJECT_ID,
            stageId: STAGE_ID,
            status: "red",
          },
        ],
      },
      "draft",
      NOW,
    );

    expect(merged.projects[0]?.trafficLight).toBe("red");
  });

  it("retains the project-status fallback when no stage status exists", () => {
    const merged = mergeSection(
      section,
      {
        ...baseInput,
        projectStatuses: [{ projectId: PROJECT_ID, status: "yellow" }],
      },
      "draft",
      NOW,
    );

    expect(merged.projects[0]?.trafficLight).toBe("yellow");
  });

  it("keeps the persisted stage status when an entry omits status (never clears)", () => {
    const merged = mergeSection(
      greenSection,
      {
        ...baseInput,
        stageStatuses: [{ projectId: PROJECT_ID, stageId: STAGE_ID }],
      },
      "draft",
      NOW,
    );

    expect(merged.projects[0]?.ownedStages[0]?.status).toBe("green");
  });

  it("clears the stage status on an explicit null (not omitted)", () => {
    const merged = mergeSection(
      greenSection,
      {
        ...baseInput,
        stageStatuses: [
          { projectId: PROJECT_ID, stageId: STAGE_ID, status: null },
        ],
      },
      "draft",
      NOW,
    );

    expect(merged.projects[0]?.ownedStages[0]?.status).toBeNull();
    expect(greenSection.projects[0]?.ownedStages[0]?.status).toBe("green");
  });

  it("stamps the injected now as submittedAt on submit (deterministic seam)", () => {
    const merged = mergeSection(section, baseInput, "submitted", NOW, false);

    expect(merged.submittedAt?.toISOString()).toBe(NOW.toISOString());
  });
});

describe("mergeSection activity title override", () => {
  const ACTIVITY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const baseActivity: ReportSectionReadModel["activities"][number] = {
    activityId: ACTIVITY_ID,
    activityName: "Catalogue duty",
    status: "green",
    jiraAccounts: [],
    linkedProducts: [],
    derivedStatus: null,
    alarmFloor: null,
  };
  const activitySection: ReportSectionReadModel = {
    ...section,
    activities: [baseActivity],
  };
  const withOverrideActivity: ReportSectionReadModel["activities"][number] = {
    ...baseActivity,
    titleOverride: "Kept",
  };

  it("folds a written title override onto the seeded activity", () => {
    const merged = mergeSection(
      activitySection,
      {
        ...baseInput,
        activityStatuses: [
          { activityId: ACTIVITY_ID, titleOverride: "Weekly duty" },
        ],
      },
      "draft",
      NOW,
    );

    expect(merged.activities[0]?.titleOverride).toBe("Weekly duty");
    expect(merged.activities[0]?.activityName).toBe("Catalogue duty");
  });

  it("preserves a persisted override when the entry omits it", () => {
    const withOverride: ReportSectionReadModel = {
      ...activitySection,
      activities: [withOverrideActivity],
    };
    const merged = mergeSection(
      withOverride,
      {
        ...baseInput,
        activityStatuses: [{ activityId: ACTIVITY_ID, status: "red" }],
      },
      "draft",
      NOW,
    );

    expect(merged.activities[0]?.titleOverride).toBe("Kept");
  });

  it("clears the override on an explicit null", () => {
    const withOverride: ReportSectionReadModel = {
      ...activitySection,
      activities: [withOverrideActivity],
    };
    const merged = mergeSection(
      withOverride,
      {
        ...baseInput,
        activityStatuses: [{ activityId: ACTIVITY_ID, titleOverride: null }],
      },
      "draft",
      NOW,
    );

    expect(merged.activities[0]?.titleOverride).toBeNull();
    expect(activitySection.activities[0]?.titleOverride).toBeUndefined();
  });
});
