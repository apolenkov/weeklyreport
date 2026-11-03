import type { ReportSectionReadModel } from "@weeklyreport/shared";

import { createDemoSection } from "../../../../test-utils/fixtures";
import {
  makeReportSectionFixture,
  type ReportSectionFixture,
} from "../../../../test-utils/report-section-fixtures";

const ACTIVITY_ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACTIVITY_ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function sectionWithActivities(
  overrides: ReportSectionFixture,
): ReportSectionReadModel {
  return makeReportSectionFixture({ ...createDemoSection(), ...overrides });
}
export { ACTIVITY_ID_A, ACTIVITY_ID_B, sectionWithActivities };
