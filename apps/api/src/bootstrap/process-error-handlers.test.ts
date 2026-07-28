import { afterEach, describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../lib/logger.js";
import { registerProcessErrorHandlers } from "./process-error-handlers.js";

const originalUncaughtListeners = process.listeners("uncaughtException");
const originalRejectionListeners = process.listeners("unhandledRejection");

afterEach(() => {
  process.removeAllListeners("uncaughtException");
  process.removeAllListeners("unhandledRejection");
  for (const listener of originalUncaughtListeners) {
    process.on("uncaughtException", listener);
  }
  for (const listener of originalRejectionListeners) {
    process.on("unhandledRejection", listener);
  }
  vi.restoreAllMocks();
});

describe("registerProcessErrorHandlers", () => {
  it("terminates after logging an unhandled rejection", () => {
    const logger = createNullLogger();
    const errorSpy = vi.spyOn(logger, "error");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`exit:${String(code)}`);
    });

    registerProcessErrorHandlers(logger);
    const listener = process.listeners("unhandledRejection").at(-1);
    if (!listener)
      throw new Error("unhandledRejection listener not registered");

    expect(() => listener(new Error("boom"), Promise.resolve())).toThrow(
      "exit:1",
    );
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0]?.[0]).toBe("unhandled rejection");
    expect(errorSpy.mock.calls[0]?.[1]?.reason).toMatchObject({
      message: "boom",
    });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
