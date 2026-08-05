import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  makeProjectReadModel,
  makeReportSectionReadModel,
} from "../../test-utils/report-section-fixtures.js";
import { buildPortfolioProductsFromSnapshotSections } from "../report-sections/index.js";
import { buildPortfolioOverview } from "./weekly-report-portfolio";

const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const FIRST_STAGE = {
  stageId: "55555555-5555-4555-8555-555555555555",
  stageName: "Development",
  sortOrder: 0,
};
const SECOND_STAGE = {
  stageId: "66666666-6666-4666-8666-666666666666",
  stageName: "Testing",
  sortOrder: 1,
};
const CO_OWNED_STAGE_SET = [FIRST_STAGE, SECOND_STAGE];

function makeCoOwnedSnapshotSections(): ReportSectionReadModel[] {
  return [
    makeReportSectionReadModel({
      authorId: "lead-a",
      authorName: "Lead A",
      projects: [
        makeProjectReadModel({
          projectId: PROJECT_ID,
          projectName: "CRM Portal",
          trafficLight: "green",
          ownedStages: [{ ...FIRST_STAGE, status: "green" }],
          stageSet: CO_OWNED_STAGE_SET,
        }),
      ],
    }),
    makeReportSectionReadModel({
      reportSectionId: "77777777-7777-4777-8777-777777777777",
      authorId: "lead-b",
      authorName: "Lead B",
      projects: [
        makeProjectReadModel({
          projectId: PROJECT_ID,
          projectName: "CRM Portal",
          trafficLight: "red",
          ownedStages: [{ ...SECOND_STAGE, status: "red" }],
          stageSet: CO_OWNED_STAGE_SET,
        }),
      ],
    }),
  ];
}

describe("buildPortfolioOverview — raw traffic-light parsing", () => {
  it("folds valid statuses into the worst-of card", () => {
    const overview = buildPortfolioOverview(
      [{ id: PROJECT_ID, name: "CRM Portal", stageAssignments: [] }],
      [
        {
          authorId: "lead-a",
          authorName: "Lead A",
          projects: [{ projectId: PROJECT_ID, trafficLight: "red" }],
        },
        {
          authorId: "lead-b",
          authorName: "Lead B",
          projects: [{ projectId: PROJECT_ID, trafficLight: "green" }],
        },
      ],
    );

    expect(overview[0]?.worstStatus).toBe("red");
    expect(overview[0]?.leadNames).toEqual(["Lead A", "Lead B"]);
  });

  it("skips an out-of-enum raw status instead of casting it through", () => {
    const overview = buildPortfolioOverview(
      [{ id: PROJECT_ID, name: "CRM Portal", stageAssignments: [] }],
      [
        {
          authorId: "lead-a",
          authorName: "Lead A",
          projects: [{ projectId: PROJECT_ID, trafficLight: "chartreuse" }],
        },
      ],
    );

    // No valid light → the worst-of fold over an empty set stays null.
    expect(overview[0]?.worstStatus).toBeNull();
  });

  it("matches the published portfolio stage count for the same assignments", () => {
    const sections = makeCoOwnedSnapshotSections();
    const publishedProducts =
      buildPortfolioProductsFromSnapshotSections(sections);
    const liveProducts = buildPortfolioOverview(
      [
        {
          id: PROJECT_ID,
          name: "CRM Portal",
          stageAssignments: CO_OWNED_STAGE_SET.map(({ stageId }) => ({
            id: stageId,
          })),
        },
      ],
      sections,
    );

    expect(publishedProducts[0]?.stageCount).toBe(liveProducts[0]?.stageCount);
  });
});
