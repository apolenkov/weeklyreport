// Pure derivation tests for `buildAccordionModel`'s `draftCount`.
import { type WeeklyReportReadModel } from "@weeklyreport/shared";

import {
  makeWeeklyReportFixture,
  type WeeklyReportFixture,
} from "../../../../test-utils/report-section-fixtures";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const AUTHOR_A = "22222222-2222-4222-8222-222222222222";
const PRODUCT_A = "33333333-3333-4333-8333-333333333333";
const ACTIVITY_A = "44444444-4444-4444-8444-444444444444";
const SECTION_A = "55555555-5555-4555-8555-555555555555";

function baseReport(
  overrides: WeeklyReportFixture = {},
): WeeklyReportReadModel {
  return makeWeeklyReportFixture({
    reportId: REPORT_ID,
    totalLeads: 1,
    ...overrides,
  });
}
export { ACTIVITY_A, AUTHOR_A, baseReport, PRODUCT_A, REPORT_ID, SECTION_A };
