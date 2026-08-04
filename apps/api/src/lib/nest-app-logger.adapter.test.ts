import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "./logger.js";
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
