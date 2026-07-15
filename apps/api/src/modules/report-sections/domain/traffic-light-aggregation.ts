import type { TrafficLightStatus } from "@customreport/shared";

const TRAFFIC_LIGHT_PRECEDENCE = ["red", "yellow", "green"] as const;

/** Return the highest-severity traffic light, ignoring missing inputs. */
export function aggregateTrafficLight(
  statuses: readonly (TrafficLightStatus | null | undefined)[],
): TrafficLightStatus | null {
  return (
    TRAFFIC_LIGHT_PRECEDENCE.find((status) => statuses.includes(status)) ?? null
  );
}
