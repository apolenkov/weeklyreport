import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nestjs", () => ({ captureException: vi.fn() }));

import * as Sentry from "@sentry/nestjs";

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
  it("captures and drains an unhandled rejection before terminating once", async () => {
    const logger = createNullLogger();
    const errorSpy = vi.spyOn(logger, "error");
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    const captureSpy = vi.spyOn(Sentry, "captureException");
    const shutdown = vi.fn(() => Promise.resolve());

    registerProcessErrorHandlers(logger, { shutdown, exit: exitSpy });
    const listener = process.listeners("unhandledRejection").at(-1);
    if (!listener)
      throw new Error("unhandledRejection listener not registered");

    listener(new Error("boom"), Promise.resolve());
    listener(new Error("second"), Promise.resolve());
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledOnce());
    expect(shutdown).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0]?.[0]).toBe("unhandled rejection");
    expect(errorSpy.mock.calls[0]?.[1]?.reason).toMatchObject({
      message: "boom",
    });
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(captureSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: "boom" }),
    );
  });

  it("falls back to stderr when the fatal drain exceeds its deadline", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const exit = vi.fn<(code: number) => never>(() => undefined as never);
    registerProcessErrorHandlers(createNullLogger(), {
      shutdown: () => new Promise<void>(() => undefined),
      exit,
      deadlineMs: 1,
    });
    const listener = process.listeners("uncaughtException").at(-1);
    if (!listener) throw new Error("uncaughtException listener not registered");
    listener(new Error("boom"), "uncaughtException");
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("shutdown timed out"),
    );
  });
});
