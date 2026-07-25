import { describe, expect, it } from "vitest";

import { decideOtelBootstrap } from "./otel.bootstrap.js";

// Env-knob → decision only; avoids pulling a live collector into the unit suite.
describe("OTel bootstrap decision", () => {
  it("returns disabled-flag when OTEL_SDK_DISABLED=true (overrides endpoint)", () => {
    const decision = decideOtelBootstrap({
      OTEL_SDK_DISABLED: "true",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
    });
    expect(decision.started).toBe(false);
    if (!decision.started) {
      expect(decision.reason).toBe("disabled-flag");
    }
  });

  it("returns no-endpoint when OTEL_EXPORTER_OTLP_ENDPOINT is unset", () => {
    const decision = decideOtelBootstrap({});
    expect(decision.started).toBe(false);
    if (!decision.started) {
      expect(decision.reason).toBe("no-endpoint");
    }
  });

  it("returns enabled with default sampling ratio 1.0 when only endpoint is set", () => {
    const decision = decideOtelBootstrap({
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
    });
    expect(decision.started).toBe(true);
    if (decision.started) {
      expect(decision.samplingRatio).toBe(1.0);
      expect(decision.endpoint).toBe("http://otel:4318");
    }
  });

  it("honours OTEL_TRACES_SAMPLER_ARG when set", () => {
    const decision = decideOtelBootstrap({
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
      OTEL_TRACES_SAMPLER_ARG: "1.0",
    });
    expect(decision.started).toBe(true);
    if (decision.started) {
      expect(decision.samplingRatio).toBe(1);
    }
  });

  it("falls back to 1.0 if OTEL_TRACES_SAMPLER_ARG is malformed", () => {
    const decision = decideOtelBootstrap({
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
      OTEL_TRACES_SAMPLER_ARG: "not-a-number",
    });
    expect(decision.started).toBe(true);
    if (decision.started) {
      expect(decision.samplingRatio).toBe(1.0);
    }
  });

  it("clamps out-of-range sampling ratios to default", () => {
    const tooHigh = decideOtelBootstrap({
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
      OTEL_TRACES_SAMPLER_ARG: "2.5",
    });
    expect(tooHigh.started).toBe(true);
    if (tooHigh.started) expect(tooHigh.samplingRatio).toBe(1.0);

    const negative = decideOtelBootstrap({
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
      OTEL_TRACES_SAMPLER_ARG: "-0.5",
    });
    expect(negative.started).toBe(true);
    if (negative.started) expect(negative.samplingRatio).toBe(1.0);
  });

  it("case-insensitive matching on OTEL_SDK_DISABLED", () => {
    const decision = decideOtelBootstrap({
      OTEL_SDK_DISABLED: "TRUE",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
    });
    expect(decision.started).toBe(false);
  });
});
