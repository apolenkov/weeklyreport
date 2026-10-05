import { describe, expect, it, vi } from "vitest";

import type { AiRuntimeHealth } from "../../ai-provider/index.js";
import {
  EMPTY_REPORT_ASSISTANT_TRACE,
  type ReportAssistantTelemetryEvent,
} from "../application/report-assistant.telemetry.js";
import { ReportAssistantHealthTelemetry } from "./report-assistant-health-telemetry.adapter.js";

const event = (outcome: string): ReportAssistantTelemetryEvent => ({
  outcome,
  latencyMs: 1,
  model: "m",
  trace: EMPTY_REPORT_ASSISTANT_TRACE,
});

const setup = () => {
  const health = {
    recordFailure: vi.fn().mockResolvedValue(undefined),
    recordSuccess: vi.fn().mockResolvedValue(undefined),
    lastFailure: vi.fn(),
  } satisfies AiRuntimeHealth;
  const inner = { record: vi.fn() };
  return {
    health,
    inner,
    telemetry: new ReportAssistantHealthTelemetry(inner, health),
  };
};

describe("ReportAssistantHealthTelemetry", () => {
  it.each(["provider_unavailable", "provider_response_incomplete"])(
    "remembers a %s outcome as a runtime failure",
    (outcome) => {
      const { health, inner, telemetry } = setup();
      telemetry.record(event(outcome));
      expect(inner.record).toHaveBeenCalledOnce();
      expect(health.recordFailure).toHaveBeenCalledWith(outcome);
      expect(health.recordSuccess).not.toHaveBeenCalled();
    },
  );

  it("clears the failure after an answered request", () => {
    const { health, telemetry } = setup();
    telemetry.record(event("ok"));
    expect(health.recordSuccess).toHaveBeenCalledOnce();
    expect(health.recordFailure).not.toHaveBeenCalled();
  });

  it.each(["no_results", "resource_limited", "error", "invalid_plan"])(
    "ignores the unrelated %s outcome",
    (outcome) => {
      const { health, telemetry } = setup();
      telemetry.record(event(outcome));
      expect(health.recordFailure).not.toHaveBeenCalled();
      expect(health.recordSuccess).not.toHaveBeenCalled();
    },
  );
});
