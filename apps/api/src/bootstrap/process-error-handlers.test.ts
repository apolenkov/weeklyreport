import { writeSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nestjs", () => ({ captureException: vi.fn() }));
vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  writeSync: vi.fn(),
}));

import * as Sentry from "@sentry/nestjs";

import { createNullLogger } from "../lib/logger.js";
import { registerProcessErrorHandlers } from "./process-error-handlers.js";
import { createShutdownCoordinator } from "./shutdown-coordinator.js";

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
  vi.mocked(writeSync).mockReset();
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

    registerProcessErrorHandlers(
      logger,
      createShutdownCoordinator(shutdown, { exit: exitSpy }),
    );
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
    const exit = vi.fn<(code: number) => never>(() => undefined as never);
    registerProcessErrorHandlers(
      createNullLogger(),
      createShutdownCoordinator(() => new Promise<void>(() => undefined), {
        exit,
        fatalDeadlineMs: 1,
      }),
    );
    const listener = process.listeners("uncaughtException").at(-1);
    if (!listener) throw new Error("uncaughtException listener not registered");
    listener(new Error("boom"), "uncaughtException");
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    expect(writeSync).toHaveBeenCalledWith(
      process.stderr.fd,
      expect.stringContaining("shutdown timed out"),
    );
  });
});
