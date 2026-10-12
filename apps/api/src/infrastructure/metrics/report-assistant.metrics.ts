import { Counter, Histogram } from "@prometheus-io/client";

import { metricsRegistry } from "./metrics.registry.js";

const FIFTY_MILLISECONDS = 0.05;
const ONE_TENTH_SECOND = 0.1;
const QUARTER_SECOND = 0.25;
const HALF_SECOND = 0.5;
const TWO_AND_A_HALF_SECONDS = 2.5;
const FIVE_SECONDS = 5;
const TEN_SECONDS = 10;
const THIRTY_SECONDS = 30;
const ONE_MINUTE = 60;
const FIVE_CANDIDATES = 5;
const TEN_CANDIDATES = 10;
const TWENTY_FIVE_CANDIDATES = 25;
const FIFTY_CANDIDATES = 50;
const ONE_HUNDRED_CANDIDATES = 100;
const TWO_HUNDRED_FIFTY_CANDIDATES = 250;
const FIVE_HUNDRED_CANDIDATES = 500;
const ONE_THOUSAND_CANDIDATES = 1000;
const DURATION_BUCKETS = [
  FIFTY_MILLISECONDS,
  ONE_TENTH_SECOND,
  QUARTER_SECOND,
  HALF_SECOND,
  1,
  TWO_AND_A_HALF_SECONDS,
  FIVE_SECONDS,
  TEN_SECONDS,
  THIRTY_SECONDS,
  ONE_MINUTE,
] as const;
const CANDIDATE_BUCKETS = [
  0,
  1,
  2,
  FIVE_CANDIDATES,
  TEN_CANDIDATES,
  TWENTY_FIVE_CANDIDATES,
  FIFTY_CANDIDATES,
  ONE_HUNDRED_CANDIDATES,
  TWO_HUNDRED_FIFTY_CANDIDATES,
  FIVE_HUNDRED_CANDIDATES,
  ONE_THOUSAND_CANDIDATES,
] as const;

export const weeklyreportAssistantRequestsTotal = new Counter({
  name: "weeklyreport_assistant_requests_total",
  help: "Total report assistant requests by bounded outcome and mode",
  labelNames: ["mode", "outcome"] as const,
  registers: [metricsRegistry],
});

export const weeklyreportAssistantDurationSeconds = new Histogram({
  name: "weeklyreport_assistant_duration_seconds",
  help: "Report assistant request duration in seconds",
  labelNames: ["mode", "outcome"] as const,
  buckets: [...DURATION_BUCKETS],
  registers: [metricsRegistry],
});

export const weeklyreportAssistantCandidateCount = new Histogram({
  name: "weeklyreport_assistant_candidate_count",
  help: "Report assistant candidate counts by bounded processing stage",
  labelNames: ["mode", "stage"] as const,
  buckets: [...CANDIDATE_BUCKETS],
  registers: [metricsRegistry],
});

export const weeklyreportAssistantCacheEventsTotal = new Counter({
  name: "weeklyreport_assistant_cache_events_total",
  help: "Report assistant semantic cache events",
  labelNames: ["mode", "result"] as const,
  registers: [metricsRegistry],
});

export const weeklyreportAssistantRepairsTotal = new Counter({
  name: "weeklyreport_assistant_repairs_total",
  help: "Report assistant structured-output repairs",
  labelNames: ["kind"] as const,
  registers: [metricsRegistry],
});

export const weeklyreportAssistantTokensTotal = new Counter({
  name: "weeklyreport_assistant_tokens_total",
  help: "Report assistant token usage by bounded direction",
  labelNames: ["kind"] as const,
  registers: [metricsRegistry],
});

export const weeklyreportAssistantResourceEventsTotal = new Counter({
  name: "weeklyreport_assistant_resource_events_total",
  help: "Assistant resource budget and lease events by bounded outcome",
  labelNames: ["outcome", "reason"] as const,
  registers: [metricsRegistry],
});
