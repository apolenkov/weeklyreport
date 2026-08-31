import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BULLMQ_FORCE_CLOSE_TIMEOUT_MS,
  BULLMQ_GRACEFUL_CLOSE_TIMEOUT_MS,
  closeBullMqResource,
} from "./bounded-shutdown.js";

describe("closeBullMqResource", () => {
  afterEach(() => vi.useRealTimers());

  it("uses the normal close when it completes within the budget", async () => {
    const close = vi.fn(() => Promise.resolve());
    const forceClose = vi.fn(() => Promise.resolve());

    await closeBullMqResource("worker", close, forceClose);

    expect(close).toHaveBeenCalledOnce();
    expect(forceClose).not.toHaveBeenCalled();
  });

  it("force-closes a hung resource without losing the late close rejection", async () => {
    vi.useFakeTimers();
    const close = vi.fn(() => new Promise<void>(() => undefined));
    const forceClose = vi.fn(() => Promise.resolve());

    const shutdown = closeBullMqResource("queue", close, forceClose);
    await vi.advanceTimersByTimeAsync(BULLMQ_GRACEFUL_CLOSE_TIMEOUT_MS);
    await expect(shutdown).resolves.toBeUndefined();
    expect(forceClose).toHaveBeenCalledOnce();
  });

  it("fails closed when force close itself hangs, within its second deadline", async () => {
    vi.useFakeTimers();
    const close = vi.fn(() => new Promise<void>(() => undefined));
    const forceClose = vi.fn(() => new Promise<void>(() => undefined));

    const shutdown = closeBullMqResource("queue", close, forceClose);
    const rejection = shutdown.then(
      () => undefined,
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(
      BULLMQ_GRACEFUL_CLOSE_TIMEOUT_MS + BULLMQ_FORCE_CLOSE_TIMEOUT_MS,
    );
    const error = await rejection;
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: `BullMQ queue force close exceeded ${BULLMQ_FORCE_CLOSE_TIMEOUT_MS}ms`,
        }),
      ]),
    );
  });

  it("observes a force-close rejection that arrives after its deadline", async () => {
    vi.useFakeTimers();
    const late = Promise.withResolvers<void>();
    const observed: unknown[] = [];
    const close = vi.fn(() => new Promise<void>(() => undefined));
    const forceClose = vi.fn(() => late.promise);

    const shutdown = closeBullMqResource("queue", close, forceClose, (error) =>
      observed.push(error),
    );
    const rejection = shutdown.then(
      () => undefined,
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(
      BULLMQ_GRACEFUL_CLOSE_TIMEOUT_MS + BULLMQ_FORCE_CLOSE_TIMEOUT_MS,
    );
    const rejectionError = await rejection;
    expect(rejectionError).toBeInstanceOf(AggregateError);
    expect((rejectionError as AggregateError).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: `BullMQ queue force close exceeded ${BULLMQ_FORCE_CLOSE_TIMEOUT_MS}ms`,
        }),
      ]),
    );

    const error = new Error("late force close");
    late.reject(error);
    await vi.advanceTimersByTimeAsync(0);
    expect(observed).toContain(error);
  });

  it("reports both normal and force-close errors", async () => {
    const close = vi.fn(() => Promise.reject(new Error("normal")));
    const forceClose = vi.fn(() => Promise.reject(new Error("force")));

    await expect(
      closeBullMqResource("worker", close, forceClose),
    ).rejects.toMatchObject({ message: "BullMQ worker force close failed" });
  });
});
