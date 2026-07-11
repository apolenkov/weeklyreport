import type { DbRole } from "@customreport/shared";
import type { $Enums } from "@prisma/client";
import { describe, expectTypeOf, it } from "vitest";

/**
 * Pins the role-type spec's persistence-axis guarantee: the shared `DbRole`
 * (inferred from `roleSchema`) and the Prisma `Role` enum must stay
 * value-identical, so DB-bound role writes validated by the shared schema
 * keep matching the column's enum. The session `Role` type is deliberately
 * NOT pinned here — the two axes are free to diverge.
 */
describe("DbRole shared/Prisma identity", () => {
  it("shared persistence type equals the Prisma enum", () => {
    expectTypeOf<DbRole>().toEqualTypeOf<$Enums.Role>();
  });
});
