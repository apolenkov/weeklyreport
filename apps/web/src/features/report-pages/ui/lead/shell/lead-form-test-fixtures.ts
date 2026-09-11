import type { ReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";

export function makeLeadFormSectionFixture(
  overrides: ReportSectionFixture = {},
) {
  return makeReportSectionFixture({
    authorName: "Test Lead",
    authorRole: "lead",
    status: "draft",
    submittedAt: null,
    ...overrides,
  });
}
