import { Counter } from "@prometheus-io/client";

import type { AiPromptMetricsSink } from "../../modules/ai-prompts/index.js";
import { metricsRegistry } from "./metrics.registry.js";

const aiPromptLifecycleTotal = new Counter({
  name: "weeklyreport_ai_prompt_lifecycle_total",
  help: "AI prompt lifecycle operation outcomes",
  labelNames: ["feature", "operation", "outcome"] as const,
  registers: [metricsRegistry],
});

export class AiPromptPrometheusMetrics implements AiPromptMetricsSink {
  record(input: Parameters<AiPromptMetricsSink["record"]>[0]): void {
    aiPromptLifecycleTotal.inc({
      feature: input.feature,
      operation: input.operation,
      outcome: input.outcome,
    });
  }
}
