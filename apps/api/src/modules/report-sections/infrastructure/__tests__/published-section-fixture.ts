import {
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
} from "@customreport/shared";

import {
  makeProjectReadModel,
  makeReportSectionReadModel,
  makeSectionActivity,
} from "../../../../test-utils/report-section-fixtures.js";

export const REPORT_ID = "659b2767-0f86-41e2-b025-49730ca010e4";
export const SECTION_ID = "2a223d8b-c4b2-473c-8a7b-15ecc52195c7";
export const AUTHOR_ID = "6f99661a-cac6-4d06-bf08-2a14cced554d";
export const OWNED_PRODUCT = "4ff69d14-ec8c-4f1c-b62b-73bee530fc7d";
export const OWNED_STAGE_ID = "6366e7ef-e694-454f-863a-7e112ebbc48f";
export const SECOND_STAGE_ID = "71e9d6a6-7455-4864-8de9-a48b2f25b13f";
export const OWNED_STAGE_NAME = "Development";

type ProjectFixture = Partial<ReportSectionReadModel["projects"][number]> &
  Pick<
    ReportSectionReadModel["projects"][number],
    "projectId" | "projectName" | "trafficLight"
  >;
type ActivityFixture = Partial<ReportSectionReadModel["activities"][number]> &
  Pick<
    ReportSectionReadModel["activities"][number],
    "activityId" | "activityName" | "status"
  >;
type SectionFixture = Omit<
  Partial<ReportSectionReadModel>,
  "activities" | "projects"
> & {
  activities?: ActivityFixture[];
  projects?: ProjectFixture[];
};

export function makeSection(
  overrides: SectionFixture = {},
): ReportSectionReadModel {
  const { activities = [], projects, ...sectionOverrides } = overrides;
  return reportSectionReadModelSchema.parse(
    makeReportSectionReadModel({
      reportSectionId: SECTION_ID,
      reportId: REPORT_ID,
      authorId: AUTHOR_ID,
      authorName: "Alice Lead",
      status: "submitted",
      submittedAt: null,
      projects: (
        projects ?? [
          {
            projectId: OWNED_PRODUCT,
            projectName: "CRM Portal",
            trafficLight: "green",
          },
        ]
      ).map(makeProjectReadModel),
      activities: activities.map(makeSectionActivity),
      ...sectionOverrides,
    }),
  );
}
