import { logs } from "@opentelemetry/api";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAppLogger } from "./logger.js";

describe("createAppLogger transport failures", () => {
  afterEach(() => vi.restoreAllMocks());

  it("falls back to stderr when a stdout write throws", () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => {
      throw new Error("EPIPE");
    });
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const logger = createAppLogger({ minLevel: "info" });

    expect(() => logger.info("kept")).not.toThrow();

    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining('"message":"kept"'),
    );
  });

  it("falls back to stdout when a stderr write throws", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => {
      throw new Error("EPIPE");
    });
    const logger = createAppLogger({ minLevel: "info" });

    expect(() => logger.error("kept")).not.toThrow();

    expect(stdout).toHaveBeenCalledWith(
      expect.stringContaining('"message":"kept"'),
    );
  });

  it("does not throw when both standard streams fail", () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => {
      throw new Error("EPIPE");
    });
    vi.spyOn(process.stderr, "write").mockImplementation(() => {
      throw new Error("EPIPE");
    });
    const logger = createAppLogger({ minLevel: "info" });

    expect(() => logger.error("lost")).not.toThrow();
  });

  it("reports a failing OTel emit on stderr without affecting the stdout entry", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    vi.spyOn(logs, "getLogger").mockReturnValue({
      emit: () => {
        throw new Error("exporter down");
      },
    } as never);
    const logger = createAppLogger({ minLevel: "info" });

    expect(() => logger.info("still logged")).not.toThrow();

    expect(stdout).toHaveBeenCalledWith(
      expect.stringContaining('"message":"still logged"'),
    );
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining("[logger] otel emit failed"),
    );
  });
});
