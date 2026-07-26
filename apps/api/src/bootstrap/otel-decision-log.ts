import type { OtelBootstrapResult } from "../infrastructure/otel/otel.bootstrap";
import type { AppLogger } from "../lib/logger";

// One structured line recording the OTel bootstrap decision. A prod boot with
// tracing off warns (not info) so it stands out rather than blending into
// routine startup lines.
export function logOtelDecision(
  logger: AppLogger,
  decision: OtelBootstrapResult,
): void {
  if (decision.started) {
    logger.info("otel sdk started", {
      phase: "otel",
      endpoint: decision.endpoint,
      samplingRatio: decision.samplingRatio,
    });
    return;
  }
  logger.warn("otel sdk disabled", {
    phase: "otel",
    reason: decision.reason,
  });
}
