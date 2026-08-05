import type { ReportAssistantTokenUsage } from "./report-assistant.ports.js";

type ReportAssistantMode = "structured" | "semantic_ranked" | "unknown";

export type ReportAssistantTrace = Readonly<{
  mode: ReportAssistantMode;
  candidateCount: number;
  evidenceCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  readThrough: boolean;
  plannerRepairCount: number;
  citationRepairCount: number;
  usage: ReportAssistantTokenUsage | null;
}>;

export type ReportAssistantTelemetryEvent = Readonly<{
  outcome: string;
  latencyMs: number;
  model: string;
  trace: ReportAssistantTrace;
}>;

export interface ReportAssistantTelemetry {
  record(event: ReportAssistantTelemetryEvent): void;
}

export const REPORT_ASSISTANT_TELEMETRY = Symbol("ReportAssistantTelemetry");

export const EMPTY_REPORT_ASSISTANT_TRACE: ReportAssistantTrace = {
  mode: "unknown",
  candidateCount: 0,
  evidenceCount: 0,
  cacheHitCount: 0,
  cacheMissCount: 0,
  readThrough: false,
  plannerRepairCount: 0,
  citationRepairCount: 0,
  usage: null,
};

export const NOOP_REPORT_ASSISTANT_TELEMETRY: ReportAssistantTelemetry = {
  record: () => undefined,
};
