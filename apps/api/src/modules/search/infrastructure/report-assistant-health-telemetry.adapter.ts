import type { AiRuntimeHealth } from "../../ai-provider/index.js";
import type {
  ReportAssistantTelemetry,
  ReportAssistantTelemetryEvent,
} from "../application/report-assistant.telemetry.js";

/** Feeds the admin AI status from request outcomes, then delegates metrics. */
export class ReportAssistantHealthTelemetry implements ReportAssistantTelemetry {
  constructor(
    private readonly inner: ReportAssistantTelemetry,
    private readonly health: AiRuntimeHealth,
  ) {}

  record(event: ReportAssistantTelemetryEvent): void {
    this.inner.record(event);
    if (event.outcome === "ok") void this.health.recordSuccess();
    else if (
      event.outcome === "provider_unavailable" ||
      event.outcome === "provider_response_incomplete"
    ) {
      void this.health.recordFailure(event.outcome);
    }
  }
}
