import {
  canonicalToTrafficLight,
  type TrafficLightStatus,
  trafficLightToCanonical,
  worstCanonicalStatus,
} from "@customreport/shared";

/** Return the highest-severity traffic light, ignoring missing inputs. */
export function aggregateTrafficLight(
  statuses: readonly (TrafficLightStatus | null | undefined)[],
): TrafficLightStatus | null {
  return canonicalToTrafficLight(
    worstCanonicalStatus(
      statuses.map((status) => trafficLightToCanonical(status)),
    ),
  );
}
