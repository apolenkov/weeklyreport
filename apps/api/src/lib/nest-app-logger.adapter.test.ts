import { ConsoleLogger, Logger } from "@nestjs/common";
import { ExceptionHandler } from "@nestjs/core/errors/exception-handler.js";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "./logger.js";
import { createAppLogger } from "./logger.js";
import { NestAppLoggerAdapter } from "./nest-app-logger.adapter.js";

function createLogger(): AppLogger {
  const logger: AppLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  return logger;
}

describe("NestAppLoggerAdapter", () => {
  it("keeps operations bound after detachment", () => {
    const logger = createLogger();
    const adapter = new NestAppLoggerAdapter(logger);
    const { log, warn, error } = adapter;

    log("started", "Bootstrap");
    warn("slow", "Bootstrap");
    error("failed", "stack", "Bootstrap");

    expect(logger.info).toHaveBeenCalledWith("started", {
      nestContext: "Bootstrap",
    });
    expect(logger.warn).toHaveBeenCalledWith("slow", {
      nestContext: "Bootstrap",
    });
    expect(logger.error).toHaveBeenCalledWith("failed", {
      nestContext: "Bootstrap",
      stack: "stack",
    });
  });

  it("routes detached operations to the replacement sink", () => {
    const initial = createLogger();
    const replacement = createLogger();
    const adapter = new NestAppLoggerAdapter(initial);
    const { log, setLogger } = adapter;

    setLogger(replacement);
    log("ready");

    expect(initial.info).not.toHaveBeenCalled();
    expect(replacement.info).toHaveBeenCalledWith("ready", undefined);
  });
});

describe("NestAppLoggerAdapter with the real Nest exception producer", () => {
  it("retains Error name and stack through the shared sink without serializing cause", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const error = new Error("synthetic Nest failure", {
      cause: new Error("private-cause-marker"),
    });
    error.name = "SyntheticError";
    Logger.overrideLogger(new NestAppLoggerAdapter(createAppLogger()));
    try {
      new ExceptionHandler().handle(error);
      expect(stderr).toHaveBeenCalledOnce();
      const entry = JSON.parse(String(stderr.mock.calls[0]?.[0])) as Record<
        string,
        unknown
      >;
      expect(entry).toMatchObject({
        message: "SyntheticError: synthetic Nest failure",
        nestContext: "ExceptionHandler",
        name: "SyntheticError",
        stack: error.stack,
      });
      expect(entry).not.toHaveProperty("cause");
      expect(JSON.stringify(entry)).not.toContain("private-cause-marker");
    } finally {
      Logger.overrideLogger(new ConsoleLogger());
      stderr.mockRestore();
    }
  });

  it("preserves caller-provided stack and context over Error defaults", () => {
    const sink = createLogger();
    const error = new Error("synthetic failure");
    new NestAppLoggerAdapter(sink).error(error, "caller stack", "Caller");
    expect(sink.error).toHaveBeenCalledWith("Error: synthetic failure", {
      nestContext: "Caller",
      stack: "caller stack",
      name: "Error",
    });
  });

  it("keeps two-argument string context unchanged without inventing a stack", () => {
    const sink = createLogger();
    new NestAppLoggerAdapter(sink).error("synthetic failure", "Caller");
    expect(sink.error).toHaveBeenCalledWith("synthetic failure", {
      nestContext: "Caller",
    });
  });
});
