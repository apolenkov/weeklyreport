import {
  customreportAssistantCacheEventsTotal,
  customreportAssistantCandidateCount,
  customreportAssistantDurationSeconds,
  customreportAssistantRepairsTotal,
  customreportAssistantRequestsTotal,
  customreportAssistantTokensTotal,
} from "../../../infrastructure/metrics/report-assistant.metrics.js";
import type {
  ReportAssistantTelemetry,
  ReportAssistantTelemetryEvent,
} from "../application/report-assistant.telemetry.js";

const MILLISECONDS_PER_SECOND = 1000;

export class ReportAssistantPrometheusTelemetry implements ReportAssistantTelemetry {
  record(event: ReportAssistantTelemetryEvent): void {
    const { trace } = event;
    customreportAssistantRequestsTotal.inc({
      mode: trace.mode,
      outcome: event.outcome,
      model: event.model,
    });
    customreportAssistantDurationSeconds.observe(
      { mode: trace.mode, outcome: event.outcome },
      event.latencyMs / MILLISECONDS_PER_SECOND,
    );
    customreportAssistantCandidateCount.observe(
      { mode: trace.mode, stage: "retrieved" },
      trace.candidateCount,
    );
    customreportAssistantCandidateCount.observe(
      { mode: trace.mode, stage: "evidence" },
      trace.evidenceCount,
    );
    this.recordCache(trace);
    this.recordRepairs(trace, event.model);
    this.recordUsage(trace, event.model);
  }

  private recordCache(trace: ReportAssistantTelemetryEvent["trace"]): void {
    if (trace.cacheHitCount > 0) {
      customreportAssistantCacheEventsTotal.inc(
        { mode: trace.mode, result: "hit" },
        trace.cacheHitCount,
      );
    }
    if (trace.cacheMissCount > 0) {
      customreportAssistantCacheEventsTotal.inc(
        { mode: trace.mode, result: "miss" },
        trace.cacheMissCount,
      );
    }
    if (trace.readThrough) {
      customreportAssistantCacheEventsTotal.inc({
        mode: trace.mode,
        result: "read_through",
      });
    }
  }

  private recordRepairs(
    trace: ReportAssistantTelemetryEvent["trace"],
    model: string,
  ): void {
    if (trace.plannerRepairCount > 0) {
      customreportAssistantRepairsTotal.inc(
        { model, kind: "planner" },
        trace.plannerRepairCount,
      );
    }
    if (trace.citationRepairCount > 0) {
      customreportAssistantRepairsTotal.inc(
        { model, kind: "citation" },
        trace.citationRepairCount,
      );
    }
  }

  private recordUsage(
    trace: ReportAssistantTelemetryEvent["trace"],
    model: string,
  ): void {
    if (trace.usage === null) return;
    customreportAssistantTokensTotal.inc(
      { model, kind: "input" },
      trace.usage.promptTokens,
    );
    customreportAssistantTokensTotal.inc(
      { model, kind: "output" },
      trace.usage.completionTokens,
    );
    customreportAssistantTokensTotal.inc(
      { model, kind: "total" },
      trace.usage.totalTokens,
    );
  }
}
