import { beforeEach, describe, expect, it } from "vitest";

import { AiProviderPrometheusMetrics } from "./ai-provider.metrics.js";
import { metricsRegistry } from "./metrics.registry.js";

describe("AiProviderPrometheusMetrics", () => {
  beforeEach(() => {
    metricsRegistry.resetMetrics();
  });

  it("records only bounded provider state, test, preparation, and activation labels", async () => {
    const metrics = new AiProviderPrometheusMetrics();

    metrics.recordState({
      profile: "custom-openai-compatible",
      state: "preparing",
    });
    metrics.recordCapabilityTest({
      profile: "custom-openai-compatible",
      result: "passed",
    });
    metrics.recordPreparation({
      profile: "custom-openai-compatible",
      completed: 8,
      total: 10,
      failed: 0,
      elapsedMs: 2500,
    });
    metrics.recordActivation({
      profile: "custom-openai-compatible",
      result: "succeeded",
    });

    const output = await metricsRegistry.metrics();

    expect(output).toContain(
      'weeklyreport_ai_provider_state{profile="custom-openai-compatible",state="preparing"} 1',
    );
    expect(output).toContain(
      'weeklyreport_ai_provider_capability_tests_total{profile="custom-openai-compatible",result="passed"} 1',
    );
    expect(output).toContain(
      'weeklyreport_ai_provider_preparation_completed{profile="custom-openai-compatible"} 8',
    );
    expect(output).toContain(
      'weeklyreport_ai_provider_preparation_total{profile="custom-openai-compatible"} 10',
    );
    expect(output).toContain(
      'weeklyreport_ai_provider_activations_total{profile="custom-openai-compatible",result="succeeded"} 1',
    );
    expect(output).not.toContain("ciphertext");
    expect(output).not.toContain("provider-key");
  });
});
