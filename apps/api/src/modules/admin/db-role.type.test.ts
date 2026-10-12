import type { $Enums } from "@prisma/client";
import type { DbRole } from "@weeklyreport/shared";
import { describe, expectTypeOf, it } from "vitest";

// Pins the persistence-axis guarantee: shared `DbRole` and the Prisma `Role`
// enum must stay value-identical so schema-validated role writes match the
// column enum. The session `Role` type is deliberately NOT pinned here.
describe("DbRole shared/Prisma identity", () => {
  it("shared persistence type equals the Prisma enum", () => {
    expectTypeOf<DbRole>().toEqualTypeOf<$Enums.Role>();
  });
});
