import { afterEach, describe, expect, it, vi } from "vitest";

import { ReportAssistantProviderError } from "../application/report-assistant.ports.js";
import { withTransientRetry } from "./openai-compatible.retry.js";

const rateLimit = (retryAfterMs: number): ReportAssistantProviderError =>
  new ReportAssistantProviderError(
    "planner",
    new Error("rate_limit_exceeded"),
    429,
    true,
    "rate_limit_exceeded",
    retryAfterMs,
  );

afterEach(() => vi.useRealTimers());

describe("withTransientRetry", () => {
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
