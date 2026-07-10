import type { ReportStatus } from "@customreport/shared";
import type { $Enums } from "@prisma/client";
import { describe, expectTypeOf, it } from "vitest";

/**
 * Pins the report-status-type spec's no-drift guarantee: the shared
 * `ReportStatus` (inferred from `reportStatusSchema`) and the Prisma
 * `ReportStatus` enum must stay value-identical, so the admin port's
 * shared-typed `readReportForDelete` keeps accepting the raw row field.
 */
describe("ReportStatus shared/Prisma identity", () => {
  it("shared type equals the Prisma enum", () => {
    expectTypeOf<ReportStatus>().toEqualTypeOf<$Enums.ReportStatus>();
  });
});
