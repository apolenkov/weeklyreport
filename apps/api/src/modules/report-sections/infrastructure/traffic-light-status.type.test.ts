import type { TrafficLightStatus } from "@customreport/shared";
import type { $Enums } from "@prisma/client";
import { describe, expectTypeOf, it } from "vitest";

// Type-level identity proof: if either side gains, loses, or renames a member,
// this fails at typecheck.
describe("TrafficLightStatus shared/Prisma identity", () => {
  it("shared type equals the Prisma enum", () => {
    expectTypeOf<TrafficLightStatus>().toEqualTypeOf<$Enums.TrafficLightStatus>();
  });
});
