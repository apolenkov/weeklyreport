import { afterEach, describe, expect, it, vi } from "vitest";

import { createShutdownCoordinator } from "./shutdown-coordinator.js";

describe("shutdown coordinator", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("cancels the fatal deadline when draining completes", async () => {
    vi.useFakeTimers();
    const exit = vi.fn();
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const drain = vi.fn().mockResolvedValue(undefined);
    const coordinator = createShutdownCoordinator(drain, { exit });

    coordinator.request("fatal");
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(5000);

    expect(drain).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(stderr).not.toHaveBeenCalled();
  });

  it.each(["resolve", "reject"] as const)(
    "exits once when the drain settles after the fatal deadline (%s)",
    async (settlement) => {
      vi.useFakeTimers();
      const exit = vi.fn();
      const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      const pending = Promise.withResolvers<void>();
      const drain = vi.fn(() => pending.promise);
      const coordinator = createShutdownCoordinator(drain, { exit });

      coordinator.request("signal");
      await vi.advanceTimersByTimeAsync(0);
      coordinator.request("fatal");
      await vi.advanceTimersByTimeAsync(4999);
      expect(exit).not.toHaveBeenCalled();
      coordinator.request("fatal");
      await vi.advanceTimersByTimeAsync(1);
      expect(exit).toHaveBeenCalledExactlyOnceWith(1);

      if (settlement === "resolve") pending.resolve();
      else pending.reject(new Error("late drain failure"));
      await vi.advanceTimersByTimeAsync(0);
      coordinator.request("signal");
      coordinator.request("fatal");

      expect(drain).toHaveBeenCalledOnce();
      expect(exit).toHaveBeenCalledExactlyOnceWith(1);
      expect(stderr).toHaveBeenCalledExactlyOnceWith(
        "[fatal] shutdown timed out\n",
      );
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each(["synchronous", "asynchronous"] as const)(
    "exits with failure when a signal drain fails (%s)",
    async (failure) => {
      vi.useFakeTimers();
      const exit = vi.fn();
      const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      const drain = vi.fn(() => {
        const error = new Error("drain failure");
        if (failure === "synchronous") throw error;
        return Promise.reject(error);
      });
      const coordinator = createShutdownCoordinator(drain, { exit });

      coordinator.request("signal");
      coordinator.request("signal");
      await vi.advanceTimersByTimeAsync(0);

      expect(drain).toHaveBeenCalledOnce();
      expect(exit).toHaveBeenCalledExactlyOnceWith(1);
      expect(stderr).toHaveBeenCalledExactlyOnceWith(
        "[shutdown] shutdown failed: drain failure\n",
      );
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
