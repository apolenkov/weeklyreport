import { afterEach, describe, expect, it, vi } from "vitest";

import { decideOtelBootstrap, startOtel } from "./otel.bootstrap.js";

const { startSdk } = vi.hoisted(() => ({ startSdk: vi.fn() }));

vi.mock("@opentelemetry/sdk-node", () => ({
  NodeSDK: class {
    start = startSdk;
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it.each([undefined, "", " ".repeat(3), " \t "])(
    "returns no-endpoint when OTEL_EXPORTER_OTLP_ENDPOINT is %j",
    (OTEL_EXPORTER_OTLP_ENDPOINT) => {
      const decision = decideOtelBootstrap({
        OTEL_EXPORTER_OTLP_ENDPOINT,
      });
      expect(decision.started).toBe(false);
      if (!decision.started) {
        expect(decision.reason).toBe("no-endpoint");
      }
    },
  );

  it.each(["not-a-url", "ftp://otel:4318", "http://", "://otel"])(
    "rejects a malformed nonblank OTEL_EXPORTER_OTLP_ENDPOINT %j before exporter creation",
    (OTEL_EXPORTER_OTLP_ENDPOINT) => {
      expect(() =>
        decideOtelBootstrap({ OTEL_EXPORTER_OTLP_ENDPOINT }),
      ).toThrow(/OTEL_EXPORTER_OTLP_ENDPOINT must be an http\(s\) URL/u);
    },
  );

  it("trims surrounding whitespace on a configured endpoint", () => {
    const decision = decideOtelBootstrap({
      OTEL_EXPORTER_OTLP_ENDPOINT: "  http://otel:4318/collector  ",
    });
    expect(decision.started).toBe(true);
    if (decision.started) {
      expect(decision.endpoint).toBe("http://otel:4318/collector");
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

  it.each(["not-a-number", "2.5", "-0.5", "0,1"])(
    "rejects invalid OTEL_TRACES_SAMPLER_ARG=%s",
    (value) => {
      expect(() =>
        decideOtelBootstrap({
          OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
          OTEL_TRACES_SAMPLER_ARG: value,
        }),
      ).toThrow(/OTEL_TRACES_SAMPLER_ARG must be a number between 0 and 1/u);
    },
  );

  it.each(["", " ".repeat(3)])(
    "rejects blank OTEL_TRACES_SAMPLER_ARG=%j",
    (value) => {
      expect(() =>
        decideOtelBootstrap({
          OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
          OTEL_TRACES_SAMPLER_ARG: value,
        }),
      ).toThrow(/OTEL_TRACES_SAMPLER_ARG must not be blank/u);
    },
  );

  it("case-insensitive matching on OTEL_SDK_DISABLED", () => {
    const decision = decideOtelBootstrap({
      OTEL_SDK_DISABLED: "TRUE",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
    });
    expect(decision.started).toBe(false);
  });
});

describe("startOtel SDK start outcome", () => {
  it("reports start-failed (not started) when the SDK start throws", () => {
    startSdk.mockImplementation(() => {
      throw new Error("instrumentation conflict");
    });
    const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);

    const decision = startOtel({
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
    });

    expect(decision.started).toBe(false);
    if (!decision.started) {
      expect(decision.reason).toBe("start-failed");
    }
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("[otel] start failed"),
    );
  });
});
