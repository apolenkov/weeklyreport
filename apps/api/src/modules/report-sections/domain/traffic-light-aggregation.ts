import {
  canonicalToTrafficLight,
  type TrafficLightStatus,
  trafficLightToCanonical,
  worstCanonicalStatus,
} from "@customreport/shared";

export function aggregateTrafficLight(
  statuses: readonly (TrafficLightStatus | null | undefined)[],
): TrafficLightStatus | null {
  return canonicalToTrafficLight(
    worstCanonicalStatus(statuses.map(trafficLightToCanonical)),
  );
}
