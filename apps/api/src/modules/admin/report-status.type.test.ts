import type { ReportStatus } from "@customreport/shared";
import type { $Enums } from "@prisma/client";
import { describe, expectTypeOf, it } from "vitest";

// Shared status remains identical to Prisma's persisted Report enum.
describe("ReportStatus shared/Prisma identity", () => {
  it("shared type equals the Prisma enum", () => {
    expectTypeOf<ReportStatus>().toEqualTypeOf<$Enums.ReportStatus>();
  });
});
