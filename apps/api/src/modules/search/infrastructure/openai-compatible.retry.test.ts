import { afterEach, describe, expect, it, vi } from "vitest";

import { ReportAssistantProviderError } from "../application/report-assistant.ports.js";
import { withTransientRetry } from "./openai-compatible.retry.js";

vi.mock("node:timers/promises", async () => {
  const { timersPromisesOnGlobalTimers } =
    await import("../../../test-utils/timers-promises-on-global-timers.js");
  return timersPromisesOnGlobalTimers;
});

const rateLimit = (retryAfterMs: number): ReportAssistantProviderError =>
  new ReportAssistantProviderError(
    "planner",
    new Error("rate_limit_exceeded"),
    {
      statusCode: 429,
      retryable: true,
      providerCode: "rate_limit_exceeded",
      retryAfterMs,
    },
  );

const networkFailure = (): ReportAssistantProviderError =>
  new ReportAssistantProviderError("planner", new TypeError("fetch failed"), {
    statusCode: undefined,
    retryable: true,
  });

afterEach(() => vi.useRealTimers());

describe("withTransientRetry", () => {
  it("does not start an attempt after its signal has already aborted", async () => {
    const controller = new AbortController();
    const reason = new Error("lease lost");
    controller.abort(reason);
    const action = vi.fn<() => Promise<string>>().mockResolvedValue("ok");

    await expect(withTransientRetry(action, controller.signal)).rejects.toBe(
      reason,
    );
    expect(action).not.toHaveBeenCalled();
  });

  it("settles a cancelled backoff without waiting or starting another attempt", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const action = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(rateLimit(2000))
      .mockResolvedValueOnce("ok");
    let settled: "resolved" | "rejected" | undefined;
    const result = withTransientRetry(action, controller.signal).then(
      () => {
        settled = "resolved";
      },
      () => {
        settled = "rejected";
      },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(action).toHaveBeenCalledOnce();

    controller.abort(new Error("lease lost"));
    await vi.advanceTimersByTimeAsync(0);

    expect(settled).toBe("rejected");
    await vi.advanceTimersByTimeAsync(5000);
    await result;
    expect(action).toHaveBeenCalledOnce();
  });

  it("fails fast on a network failure instead of repeating the connect wait", async () => {
    const failure = networkFailure();
    const action = vi.fn<() => Promise<string>>().mockRejectedValue(failure);

    await expect(withTransientRetry(action)).rejects.toBe(failure);
    expect(action).toHaveBeenCalledOnce();
  });

  it("stops after three transient attempts", async () => {
    vi.useFakeTimers();
    const failure = rateLimit(0);
    const action = vi.fn<() => Promise<string>>().mockRejectedValue(failure);
    const result = withTransientRetry(action).catch((error: unknown) => error);

    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe(failure);
    expect(action).toHaveBeenCalledTimes(3);
  });

  it("bounds the total retry wait across successive provider delays", async () => {
    vi.useFakeTimers();
    const failure = rateLimit(2501);
    const action = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(rateLimit(2500))
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce("ok");
    const result = withTransientRetry(action).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(2500);

    await expect(result).resolves.toBe(failure);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("does not hold an HTTP request for a provider delay beyond its retry budget", async () => {
    vi.useFakeTimers();
    const failure = rateLimit(5001);
    const action = vi.fn<() => Promise<string>>().mockRejectedValue(failure);

    const result = withTransientRetry(action).then(
      () => "resolved" as const,
      () => "rejected" as const,
    );
    await vi.advanceTimersByTimeAsync(0);

    await expect(
      Promise.race([result, Promise.resolve("pending" as const)]),
    ).resolves.toBe("rejected");
    expect(action).toHaveBeenCalledOnce();
  });

  it("honors a short provider delay before retrying", async () => {
    vi.useFakeTimers();
    const action = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(rateLimit(2000))
      .mockResolvedValueOnce("ok");

    const result = withTransientRetry(action);
    await vi.advanceTimersByTimeAsync(1999);
    expect(action).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toBe("ok");
    expect(action).toHaveBeenCalledTimes(2);
  });
});
