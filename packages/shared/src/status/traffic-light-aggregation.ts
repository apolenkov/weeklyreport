import type { TrafficLightStatus } from "../schemas/primitives/report-primitives.schema";
import {
  canonicalToTrafficLight,
  trafficLightToCanonical,
  worstCanonicalStatus,
} from "../schemas/status/canonical-status";

/** Returns the highest-severity traffic-light status, ignoring unset values. */
export function aggregateTrafficLight(
  statuses: readonly (TrafficLightStatus | null | undefined)[],
): TrafficLightStatus | null {
  return canonicalToTrafficLight(
    worstCanonicalStatus(statuses.map(trafficLightToCanonical)),
  );
}
