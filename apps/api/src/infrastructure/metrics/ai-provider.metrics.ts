import { Counter, Gauge } from "@prometheus-io/client";

import type {
  AiProviderCapabilityTestMetrics,
  AiProviderMetricsSink,
  AiProviderPreparationMetrics,
  AiProviderStateMetrics,
} from "../../modules/ai-provider/index.js";
import { metricsRegistry } from "./metrics.registry.js";

const MILLISECONDS_PER_SECOND = 1000;

const weeklyreportAiProviderState = new Gauge({
  name: "customreport_ai_provider_state",
  help: "Current configured AI provider lifecycle state",
  labelNames: ["profile", "state"] as const,
  registers: [metricsRegistry],
});

const weeklyreportAiProviderCapabilityTestsTotal = new Counter({
  name: "customreport_ai_provider_capability_tests_total",
  help: "AI provider synthetic capability test outcomes",
  labelNames: ["profile", "result"] as const,
  registers: [metricsRegistry],
});

const weeklyreportAiProviderPreparationCompleted = new Gauge({
  name: "customreport_ai_provider_preparation_completed",
  help: "Completed semantic preparation entries for the current provider",
  labelNames: ["profile"] as const,
  registers: [metricsRegistry],
});

const weeklyreportAiProviderPreparationTotal = new Gauge({
  name: "customreport_ai_provider_preparation_total",
  help: "Total semantic preparation entries for the current provider",
  labelNames: ["profile"] as const,
  registers: [metricsRegistry],
});

const weeklyreportAiProviderPreparationFailed = new Gauge({
  name: "customreport_ai_provider_preparation_failed",
  help: "Failed semantic preparation entries for the current provider",
  labelNames: ["profile"] as const,
  registers: [metricsRegistry],
});

const weeklyreportAiProviderPreparationElapsedSeconds = new Gauge({
  name: "customreport_ai_provider_preparation_elapsed_seconds",
  help: "Elapsed semantic preparation time for the current provider",
  labelNames: ["profile"] as const,
  registers: [metricsRegistry],
});

const weeklyreportAiProviderActivationsTotal = new Counter({
  name: "customreport_ai_provider_activations_total",
  help: "AI provider activation outcomes",
  labelNames: ["profile", "result"] as const,
  registers: [metricsRegistry],
});

export class AiProviderPrometheusMetrics implements AiProviderMetricsSink {
  recordState(input: AiProviderStateMetrics): void {
    weeklyreportAiProviderState.reset();
    weeklyreportAiProviderState.set(
      { profile: input.profile, state: input.state },
      1,
    );
  }

  recordCapabilityTest(input: AiProviderCapabilityTestMetrics): void {
    weeklyreportAiProviderCapabilityTestsTotal.inc({
      profile: input.profile,
      result: input.result,
    });
  }

  recordPreparation(input: AiProviderPreparationMetrics): void {
    weeklyreportAiProviderPreparationCompleted.set(
      { profile: input.profile },
      input.completed,
    );
    weeklyreportAiProviderPreparationTotal.set(
      { profile: input.profile },
      input.total,
    );
    weeklyreportAiProviderPreparationFailed.set(
      { profile: input.profile },
      input.failed,
    );
    weeklyreportAiProviderPreparationElapsedSeconds.set(
      { profile: input.profile },
      input.elapsedMs / MILLISECONDS_PER_SECOND,
    );
  }

  recordActivation(input: {
    profile: AiProviderCapabilityTestMetrics["profile"];
    result: "requested" | "succeeded" | "failed";
  }): void {
    weeklyreportAiProviderActivationsTotal.inc({
      profile: input.profile,
      result: input.result,
    });
  }
}
