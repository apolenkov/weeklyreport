import { describe, it, expect } from "vitest";

import { decideOtelBootstrap } from "./otel.bootstrap.js";

/**
 * 37-01 — bootstrap-decision unit tests.
 *
 * Cover the decision logic that gates whether the SDK actually starts.
 * Doesn't exercise the live SDK (that would pull in a collector at test
 * time); instead asserts the env-knob → decision mapping that the api
 * relies on for its no-overhead-when-disabled invariant.
 */
describe("37-01 OTel bootstrap decision", () => {
  it("returns disabled-flag when OTEL_SDK_DISABLED=true (overrides endpoint)", () => {
    const decision = decideOtelBootstrap({
      OTEL_SDK_DISABLED: "true",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
    } as NodeJS.ProcessEnv);
    expect(decision.started).toBe(false);
    if (!decision.started) {
      expect(decision.reason).toBe("disabled-flag");
    }
  });

  it("returns no-endpoint when OTEL_EXPORTER_OTLP_ENDPOINT is unset", () => {
    const decision = decideOtelBootstrap({} as NodeJS.ProcessEnv);
    expect(decision.started).toBe(false);
    if (!decision.started) {
      expect(decision.reason).toBe("no-endpoint");
    }
  });

  it("returns enabled with default sampling ratio 0.1 when only endpoint is set", () => {
    const decision = decideOtelBootstrap({
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
    } as NodeJS.ProcessEnv);
    expect(decision.started).toBe(true);
    if (decision.started) {
      expect(decision.samplingRatio).toBe(0.1);
      expect(decision.endpoint).toBe("http://otel:4318");
    }
  });

  it("honours OTEL_TRACES_SAMPLER_ARG when set", () => {
    const decision = decideOtelBootstrap({
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
      OTEL_TRACES_SAMPLER_ARG: "1.0",
    } as NodeJS.ProcessEnv);
    expect(decision.started).toBe(true);
    if (decision.started) {
      expect(decision.samplingRatio).toBe(1);
    }
  });

  it("falls back to 0.1 if OTEL_TRACES_SAMPLER_ARG is malformed", () => {
    const decision = decideOtelBootstrap({
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
      OTEL_TRACES_SAMPLER_ARG: "not-a-number",
    } as NodeJS.ProcessEnv);
    expect(decision.started).toBe(true);
    if (decision.started) {
      expect(decision.samplingRatio).toBe(0.1);
    }
  });

  it("clamps out-of-range sampling ratios to default", () => {
    const tooHigh = decideOtelBootstrap({
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
      OTEL_TRACES_SAMPLER_ARG: "2.5",
    } as NodeJS.ProcessEnv);
    expect(tooHigh.started).toBe(true);
    if (tooHigh.started) expect(tooHigh.samplingRatio).toBe(0.1);

    const negative = decideOtelBootstrap({
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
      OTEL_TRACES_SAMPLER_ARG: "-0.5",
    } as NodeJS.ProcessEnv);
    expect(negative.started).toBe(true);
    if (negative.started) expect(negative.samplingRatio).toBe(0.1);
  });

  it("case-insensitive matching on OTEL_SDK_DISABLED", () => {
    const decision = decideOtelBootstrap({
      OTEL_SDK_DISABLED: "TRUE",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
    } as NodeJS.ProcessEnv);
    expect(decision.started).toBe(false);
  });
});
