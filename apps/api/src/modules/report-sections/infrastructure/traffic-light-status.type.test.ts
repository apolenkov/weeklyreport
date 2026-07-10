import type { TrafficLightStatus } from "@customreport/shared";
import type { $Enums } from "@prisma/client";
import { describe, expectTypeOf, it } from "vitest";

/**
 * Pins the traffic-light-status-type spec's no-drift guarantee: the shared
 * `TrafficLightStatus` (inferred from `trafficLightStatusSchema`) and the
 * Prisma `TrafficLightStatus` enum must stay value-identical. If either side
 * gains, loses, or renames a member, this fails at typecheck/test time —
 * which is what makes "no DB migration needed" a durable claim.
 */
describe("TrafficLightStatus shared/Prisma identity", () => {
  it("shared type equals the Prisma enum", () => {
    expectTypeOf<TrafficLightStatus>().toEqualTypeOf<$Enums.TrafficLightStatus>();
  });
});
