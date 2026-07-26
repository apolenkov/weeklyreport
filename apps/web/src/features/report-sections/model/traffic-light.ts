// Feature-domain bridge for traffic-light ↔ StageStatus. Both directions
// delegate to the shared canonical adapters — the single home of the vocabulary.

import type { CanonicalStatus, TrafficLightStatus } from "@customreport/shared";
import {
  canonicalToTrafficLight,
  trafficLightToCanonical,
} from "@customreport/shared";

export type StageStatus = CanonicalStatus;

export function trafficToStageStatus(
  trafficLight: TrafficLightStatus | null,
): StageStatus {
  return trafficLightToCanonical(trafficLight);
}

export function stageStatusToTraffic(
  status: StageStatus,
): TrafficLightStatus | null {
  return canonicalToTrafficLight(status);
}
