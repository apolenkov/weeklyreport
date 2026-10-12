import { beforeEach, describe, expect, it } from "vitest";

import { AiPromptPrometheusMetrics } from "./ai-prompt.metrics.js";
import { metricsRegistry } from "./metrics.registry.js";

describe("AiPromptPrometheusMetrics", () => {
  beforeEach(() => {
    metricsRegistry.resetMetrics();
  });

  it("keeps prompt lifecycle labels bounded and free of prompt identities", async () => {
    const metrics = new AiPromptPrometheusMetrics();

    metrics.record({
      feature: "lead-report-assistant",
      operation: "activation",
      outcome: "passed",
    });

    const output = await metricsRegistry.metrics();

    expect(output).toContain(
      'weeklyreport_ai_prompt_lifecycle_total{feature="lead-report-assistant",operation="activation",outcome="passed"} 1',
    );
    expect(output).not.toContain("revision");
    expect(output).not.toContain("hash");
    expect(output).not.toContain("revision_id");
    expect(output).not.toContain("content_hash");
  });
});
