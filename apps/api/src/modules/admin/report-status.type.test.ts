import type { ReportStatus } from "@customreport/shared";
import type { $Enums } from "@prisma/client";
import { describe, expectTypeOf, it } from "vitest";

// Identity keeps readReportForDelete accepting the raw Prisma row field.
describe("ReportStatus shared/Prisma identity", () => {
  it("shared type equals the Prisma enum", () => {
    expectTypeOf<ReportStatus>().toEqualTypeOf<$Enums.ReportStatus>();
  });
});
