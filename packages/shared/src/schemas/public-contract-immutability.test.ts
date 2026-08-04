import { describe, expect, expectTypeOf, it } from "vitest";

import { DEFAULT_REPORTING_GROUP } from "../organization/default-reporting-group";
import { ROLE_HOME_PATH, ROLE_LABEL } from "./auth";
import type { ProjectActivityCreateInput } from "./project-activity.schema";
import type { WeeklyReportReadModel } from "./report.schema";
import type { AdminSnapshot } from "./report-admin.schema";
import { adminSnapshotSchema } from "./report-admin.schema";
import type { PaginatedResult } from "./report-history.schema";
import { compiledHistoryEntrySchema } from "./report-history.schema";
import {
  CURRENT_ITEM_STATUSES,
  NEXT_ITEM_STATUSES,
} from "./report-primitives.schema";
import type {
  OwnedStage,
  ProjectReadModel,
  ReportSectionReadModel,
} from "./section.schema";
import { reportSectionReadModelSchema } from "./section.schema";
import { splitStageNames } from "./stage-names";
import { STAGE, STAGE_NAMES } from "./stage-names";

const ID = "00000000-0000-4000-8000-000000000001";
const SECOND_ID = "00000000-0000-4000-8000-000000000002";

describe("public contract immutability", () => {
  it("exposes readonly nested collections to downstream TypeScript consumers", () => {
    expectTypeOf<AdminSnapshot["users"]>().toEqualTypeOf<
      readonly AdminSnapshot["users"][number][]
    >();
    expectTypeOf<PaginatedResult<string>["items"]>().toEqualTypeOf<
      readonly string[]
    >();
    expectTypeOf<ReportSectionReadModel["projects"]>().toEqualTypeOf<
      readonly ProjectReadModel[]
    >();
    expectTypeOf<
      ReportSectionReadModel["projects"][number]["ownedStages"]
    >().toEqualTypeOf<readonly OwnedStage[]>();
    expectTypeOf<
      ReportSectionReadModel["items"][number]["stageNames"]
    >().toEqualTypeOf<readonly string[] | undefined>();
    expectTypeOf<WeeklyReportReadModel["leadSections"]>().toEqualTypeOf<
      readonly ReportSectionReadModel[]
    >();
    expectTypeOf<
      ProjectActivityCreateInput["linkedProductIds"]
    >().toEqualTypeOf<readonly string[]>();
  });

  it("freezes parsed package projections and their nested collections", () => {
    const section = reportSectionReadModelSchema.parse({
      reportSectionId: ID,
      reportId: SECOND_ID,
      authorId: ID,
      authorName: "Lead",
      authorRole: "lead",
      version: 1,
      status: "draft",
      submittedAt: null,
      late: false,
      projects: [
        {
          projectId: ID,
          projectName: "Product",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: SECOND_ID,
              stageName: "Development",
              sortOrder: 1,
              status: "green",
            },
          ],
          stageSet: [
            {
              stageId: SECOND_ID,
              stageName: "Development",
              sortOrder: 1,
            },
          ],
          ownerGroupId: null,
        },
      ],
      referencedProjects: [],
      items: [],
      risks: [],
      decisions: [],
      activities: [],
      reviews: [],
    });

    expect(Object.isFrozen(section)).toBe(true);
    expect(Object.isFrozen(section.projects)).toBe(true);
    expect(Object.isFrozen(section.projects[0])).toBe(true);
    expect(Object.isFrozen(section.projects[0]?.ownedStages)).toBe(true);
    expect(Object.isFrozen(section.projects[0]?.ownedStages[0])).toBe(true);
  });

  it("freezes history/admin arrays and derived stage-name collections", () => {
    const historyEntry = compiledHistoryEntrySchema.parse({
      reportId: ID,
      periodStart: "2026-07-20",
      periodEnd: "2026-07-26",
      publishedAt: null,
      archived: false,
      publishedByName: "Head",
      trafficLights: { green: 1, yellow: 0, red: 0 },
      itemCount: 1,
      riskCount: 0,
      decisionCount: 0,
      priorityCount: 0,
      sectionCount: 1,
      productCount: 1,
    });
    const snapshot = adminSnapshotSchema.parse({
      users: [],
      groups: [],
      projects: [],
      periods: [],
      reminderRules: [],
      reminderExecutions: [],
      policies: [],
    });
    const stageNames = splitStageNames("Development, Testing");

    expect(Object.isFrozen(historyEntry)).toBe(true);
    expect(Object.isFrozen(historyEntry.trafficLights)).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.users)).toBe(true);
    expect(Object.isFrozen(stageNames)).toBe(true);
    expect(Object.isFrozen(STAGE)).toBe(true);
    expect(Object.isFrozen(STAGE_NAMES)).toBe(true);
    expect(Object.isFrozen(DEFAULT_REPORTING_GROUP)).toBe(true);
    expect(Object.isFrozen(CURRENT_ITEM_STATUSES)).toBe(true);
    expect(Object.isFrozen(NEXT_ITEM_STATUSES)).toBe(true);
    expect(Object.isFrozen(ROLE_LABEL)).toBe(true);
    expect(Object.isFrozen(ROLE_HOME_PATH)).toBe(true);
  });
});
