import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../lib/logger.js";
import { resolveAllowedOrigins } from "./cors-origins.js";
import { logOtelDecision } from "./otel-decision-log.js";

describe("resolveAllowedOrigins", () => {
  it("returns the single FRONTEND_URL when FRONTEND_URLS is absent", () => {
    expect(
      resolveAllowedOrigins({
        FRONTEND_URL: "http://localhost:3000",
        FRONTEND_URLS: undefined,
      }),
    ).toEqual(["http://localhost:3000"]);
  });

  it("merges CSV entries with the single URL, trimmed and deduped", () => {
    expect(
      resolveAllowedOrigins({
        FRONTEND_URL: "http://app.example.com",
        FRONTEND_URLS: " http://other.example.com ,http://app.example.com,",
      }),
    ).toEqual(["http://app.example.com", "http://other.example.com"]);
  });

  it("returns only the single URL when the CSV is empty or blank", () => {
    expect(
      resolveAllowedOrigins({
        FRONTEND_URL: "http://a.example.com",
        FRONTEND_URLS: " , ",
      }),
    ).toEqual(["http://a.example.com"]);
  });
});

describe("logOtelDecision", () => {
  it("logs an info line with endpoint and sampling when started", () => {
    const info = vi.fn();
    const warn = vi.fn();
    const logger = { ...createNullLogger(), info, warn };

    logOtelDecision(logger, {
      started: true,
      endpoint: "http://otel:4318",
      samplingRatio: 0.05,
      reason: "enabled",
    });

    expect(info).toHaveBeenCalledWith("otel sdk started", {
      phase: "otel",
      endpoint: "http://otel:4318",
      samplingRatio: 0.05,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs a warn line with the reason when tracing is disabled", () => {
    const info = vi.fn();
    const warn = vi.fn();
    const logger = { ...createNullLogger(), info, warn };

    logOtelDecision(logger, {
      started: false,
      reason: "disabled-flag",
    });

    expect(warn).toHaveBeenCalledWith("otel sdk disabled", {
      phase: "otel",
      reason: "disabled-flag",
    });
    expect(info).not.toHaveBeenCalled();
  });
});
