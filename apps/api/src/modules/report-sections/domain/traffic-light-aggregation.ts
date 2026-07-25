import {
  canonicalToTrafficLight,
  type TrafficLightStatus,
  trafficLightToCanonical,
  worstCanonicalStatus,
} from "@customreport/shared";

/**
 * Aggregate Traffic Light.
 * @param statuses - The statuses argument.
 */
export function aggregateTrafficLight(
  statuses: readonly (TrafficLightStatus | null | undefined)[],
): TrafficLightStatus | null {
  return canonicalToTrafficLight(
    worstCanonicalStatus(
      statuses.map((status) => trafficLightToCanonical(status)),
    ),
  );
}
