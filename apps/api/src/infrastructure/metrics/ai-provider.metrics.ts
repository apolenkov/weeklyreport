import { Counter, Gauge } from "@prometheus-io/client";

import type {
  AiProviderCapabilityTestMetrics,
  AiProviderMetricsSink,
  AiProviderPreparationMetrics,
  AiProviderStateMetrics,
} from "../../modules/ai-provider/index.js";
import { metricsRegistry } from "./metrics.registry.js";

const MILLISECONDS_PER_SECOND = 1000;

const customreportAiProviderState = new Gauge({
  name: "customreport_ai_provider_state",
  help: "Current configured AI provider lifecycle state",
  labelNames: ["profile", "state"] as const,
  registers: [metricsRegistry],
});

const customreportAiProviderCapabilityTestsTotal = new Counter({
  name: "customreport_ai_provider_capability_tests_total",
  help: "AI provider synthetic capability test outcomes",
  labelNames: ["profile", "result"] as const,
  registers: [metricsRegistry],
});

const customreportAiProviderPreparationCompleted = new Gauge({
  name: "customreport_ai_provider_preparation_completed",
  help: "Completed semantic preparation entries for the current provider",
  labelNames: ["profile"] as const,
  registers: [metricsRegistry],
});

const customreportAiProviderPreparationTotal = new Gauge({
  name: "customreport_ai_provider_preparation_total",
  help: "Total semantic preparation entries for the current provider",
  labelNames: ["profile"] as const,
  registers: [metricsRegistry],
});

const customreportAiProviderPreparationFailed = new Gauge({
  name: "customreport_ai_provider_preparation_failed",
  help: "Failed semantic preparation entries for the current provider",
  labelNames: ["profile"] as const,
  registers: [metricsRegistry],
});

const customreportAiProviderPreparationElapsedSeconds = new Gauge({
  name: "customreport_ai_provider_preparation_elapsed_seconds",
  help: "Elapsed semantic preparation time for the current provider",
  labelNames: ["profile"] as const,
  registers: [metricsRegistry],
});

const customreportAiProviderActivationsTotal = new Counter({
  name: "customreport_ai_provider_activations_total",
  help: "AI provider activation outcomes",
  labelNames: ["profile", "result"] as const,
  registers: [metricsRegistry],
});

export class AiProviderPrometheusMetrics implements AiProviderMetricsSink {
  recordState(input: AiProviderStateMetrics): void {
    customreportAiProviderState.reset();
    customreportAiProviderState.set(
      { profile: input.profile, state: input.state },
      1,
    );
  }

  recordCapabilityTest(input: AiProviderCapabilityTestMetrics): void {
    customreportAiProviderCapabilityTestsTotal.inc({
      profile: input.profile,
      result: input.result,
    });
  }

  recordPreparation(input: AiProviderPreparationMetrics): void {
    customreportAiProviderPreparationCompleted.set(
      { profile: input.profile },
      input.completed,
    );
    customreportAiProviderPreparationTotal.set(
      { profile: input.profile },
      input.total,
    );
    customreportAiProviderPreparationFailed.set(
      { profile: input.profile },
      input.failed,
    );
    customreportAiProviderPreparationElapsedSeconds.set(
      { profile: input.profile },
      input.elapsedMs / MILLISECONDS_PER_SECOND,
    );
  }

  recordActivation(input: {
    profile: AiProviderCapabilityTestMetrics["profile"];
    result: "requested" | "succeeded" | "failed";
  }): void {
    customreportAiProviderActivationsTotal.inc({
      profile: input.profile,
      result: input.result,
    });
  }
}
