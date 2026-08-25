import { describe, expect, it, vi } from "vitest";

import {
  RuntimeApiDrainTimeoutError,
  RuntimeApiWorkTracker,
} from "./runtime-api-work-tracker.js";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe("RuntimeApiWorkTracker", () => {
  it("acknowledges an already idle process", async () => {
    const tracker = new RuntimeApiWorkTracker();

    await expect(tracker.awaitIdle()).resolves.toBeUndefined();
    expect(tracker.activeCount()).toBe(0);
  });

  it("waits for the underlying operation instead of a transport event", async () => {
    const tracker = new RuntimeApiWorkTracker();
    const work = deferred<string>();
    const tracked = tracker.track(() => work.promise);
    let drained = false;
    const drain = tracker.awaitIdle().then(() => {
      drained = true;
    });

    await Promise.resolve();
    expect(tracker.activeCount()).toBe(1);
    expect(drained).toBe(false);

    work.resolve("done");
    await expect(tracked).resolves.toBe("done");
    await drain;
    expect(tracker.activeCount()).toBe(0);
  });

  it("releases rejected work only after its rejection settles", async () => {
    const tracker = new RuntimeApiWorkTracker();
    const work = deferred<never>();
    const tracked = tracker.track(() => work.promise);

    expect(tracker.activeCount()).toBe(1);
    work.reject(new Error("operation failed"));
    await expect(tracked).rejects.toThrow("operation failed");
    await expect(tracker.awaitIdle()).resolves.toBeUndefined();
    expect(tracker.activeCount()).toBe(0);
  });

  it("fails closed on timeout and keeps the operation tracked", async () => {
    vi.useFakeTimers();
    try {
      const tracker = new RuntimeApiWorkTracker();
      const work = deferred<void>();
      const tracked = tracker.track(() => work.promise);
      const drain = tracker.awaitIdle(25).catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(25);
      await expect(drain).resolves.toBeInstanceOf(RuntimeApiDrainTimeoutError);
      expect(tracker.activeCount()).toBe(1);

      work.resolve();
      await tracked;
      await expect(tracker.awaitIdle()).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
