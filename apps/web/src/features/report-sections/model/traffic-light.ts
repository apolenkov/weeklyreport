/**
 * Traffic-light mapper: bridges the API enum (green/yellow/red, optionally
 * null) with the UI presentation enum (on-track/at-risk/blocked/empty).
 *
 * Both directions delegate to the shared canonical-status adapters — the
 * single home of the vocabulary mapping — so this layer only contributes the
 * feature-domain names. `StageStatus` is the feature-domain alias of the
 * canonical vocabulary.
 */

import type { CanonicalStatus, TrafficLightStatus } from "@customreport/shared";
import {
  canonicalToTrafficLight,
  trafficLightToCanonical,
} from "@customreport/shared";

export type StageStatus = CanonicalStatus;

/**
 * Converts an API TrafficLightStatus (or null for "no data") into the
 * StageStatus enum used by lead/dashboard presentation components.
 * @param trafficLight the API traffic light, or null when the API has no data
 * @returns the presentation status (`null` maps to `"empty"`)
 */
export function trafficToStageStatus(
  trafficLight: TrafficLightStatus | null,
): StageStatus {
  return trafficLightToCanonical(trafficLight);
}

/**
 * Inverse mapping: presentation StageStatus back to API TrafficLightStatus.
 * @param status the presentation status
 * @returns the equivalent traffic light, or `null` for the computed
 * `"empty"` state, which has no DB enum value
 */
export function stageStatusToTraffic(
  status: StageStatus,
): TrafficLightStatus | null {
  return canonicalToTrafficLight(status);
}
