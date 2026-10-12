import {
  weeklyreportAssistantCacheEventsTotal,
  weeklyreportAssistantCandidateCount,
  weeklyreportAssistantDurationSeconds,
  weeklyreportAssistantRepairsTotal,
  weeklyreportAssistantRequestsTotal,
  weeklyreportAssistantTokensTotal,
} from "../../../infrastructure/metrics/report-assistant.metrics.js";
import type {
  ReportAssistantTelemetry,
  ReportAssistantTelemetryEvent,
} from "../application/report-assistant.telemetry.js";

const MILLISECONDS_PER_SECOND = 1000;

export class ReportAssistantPrometheusTelemetry implements ReportAssistantTelemetry {
  record(event: ReportAssistantTelemetryEvent): void {
    const { trace } = event;
    weeklyreportAssistantRequestsTotal.inc({
      mode: trace.mode,
      outcome: event.outcome,
    });
    weeklyreportAssistantDurationSeconds.observe(
      { mode: trace.mode, outcome: event.outcome },
      event.latencyMs / MILLISECONDS_PER_SECOND,
    );
    weeklyreportAssistantCandidateCount.observe(
      { mode: trace.mode, stage: "retrieved" },
      trace.candidateCount,
    );
    weeklyreportAssistantCandidateCount.observe(
      { mode: trace.mode, stage: "evidence" },
      trace.evidenceCount,
    );
    this.recordCache(trace);
    this.recordRepairs(trace);
    this.recordUsage(trace);
  }

  private recordCache(trace: ReportAssistantTelemetryEvent["trace"]): void {
    if (trace.cacheHitCount > 0) {
      weeklyreportAssistantCacheEventsTotal.inc(
        { mode: trace.mode, result: "hit" },
        trace.cacheHitCount,
      );
    }
    if (trace.cacheMissCount > 0) {
      weeklyreportAssistantCacheEventsTotal.inc(
        { mode: trace.mode, result: "miss" },
        trace.cacheMissCount,
      );
    }
    if (trace.readThrough) {
      weeklyreportAssistantCacheEventsTotal.inc({
        mode: trace.mode,
        result: "read_through",
      });
    }
  }

  private recordRepairs(trace: ReportAssistantTelemetryEvent["trace"]): void {
    if (trace.plannerRepairCount > 0) {
      weeklyreportAssistantRepairsTotal.inc(
        { kind: "planner" },
        trace.plannerRepairCount,
      );
    }
    if (trace.citationRepairCount > 0) {
      weeklyreportAssistantRepairsTotal.inc(
        { kind: "citation" },
        trace.citationRepairCount,
      );
    }
  }

  private recordUsage(trace: ReportAssistantTelemetryEvent["trace"]): void {
    if (trace.usage === null) return;
    weeklyreportAssistantTokensTotal.inc(
      { kind: "input" },
      trace.usage.promptTokens,
    );
    weeklyreportAssistantTokensTotal.inc(
      { kind: "output" },
      trace.usage.completionTokens,
    );
    weeklyreportAssistantTokensTotal.inc(
      { kind: "total" },
      trace.usage.totalTokens,
    );
  }
}
