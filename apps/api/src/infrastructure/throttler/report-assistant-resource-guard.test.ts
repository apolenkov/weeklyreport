import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const evalMock = vi.fn();

vi.mock("ioredis", () => ({
  Redis: class RedisMock {
    eval = evalMock;
    on = vi.fn();
    disconnect = vi.fn();
  },
}));

import {
  REPORT_ASSISTANT_CANCEL_SCRIPT,
  REPORT_ASSISTANT_RELEASE_SCRIPT,
  REPORT_ASSISTANT_RENEW_SCRIPT,
  ReportAssistantResourceGuard,
} from "./report-assistant-resource-guard.js";

const env = { REDIS_DB: 15, REDIS_HOST: "127.0.0.1", REDIS_PORT: 6379 };
const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(),
};

describe("ReportAssistantResourceGuard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    evalMock.mockReset();
    evalMock.mockResolvedValueOnce([1, 0, 120_000]);
  });
  afterEach(() => vi.useRealTimers());

  it("renews a long-running owned lease and releases it idempotently", async () => {
    evalMock.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    const guard = new ReportAssistantResourceGuard(env, logger);
    const decision = await guard.acquire("actor");
    if (decision.kind !== "granted") throw new Error("expected grant");

    await vi.advanceTimersByTimeAsync(40_000);
    expect(evalMock).toHaveBeenCalledWith(
      REPORT_ASSISTANT_RENEW_SCRIPT,
      1,
      expect.stringContaining("leases:actor"),
      expect.any(String),
      120_000,
    );
    await decision.lease.release();
    await decision.lease.release();
    expect(evalMock).toHaveBeenCalledWith(
      REPORT_ASSISTANT_RELEASE_SCRIPT,
      1,
      expect.stringContaining("leases:actor"),
      expect.any(String),
    );
    expect(
      evalMock.mock.calls.filter(
        ([script]) => script === REPORT_ASSISTANT_RELEASE_SCRIPT,
      ),
    ).toHaveLength(1);
    guard.onModuleDestroy();
  });

  it("aborts a lease whose ownership cannot be renewed and still releases it", async () => {
    evalMock.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const guard = new ReportAssistantResourceGuard(env, logger);
    const decision = await guard.acquire("actor");
    if (decision.kind !== "granted") throw new Error("expected grant");

    await vi.advanceTimersByTimeAsync(40_000);
    expect(decision.lease.signal.aborted).toBe(true);
    await decision.lease.release();
    expect(evalMock).toHaveBeenLastCalledWith(
      REPORT_ASSISTANT_RELEASE_SCRIPT,
      1,
      expect.stringContaining("leases:actor"),
      expect.any(String),
    );
    guard.onModuleDestroy();
  });

  it("cancels an acquire with an unknown Redis outcome before denying it", async () => {
    evalMock.mockReset();
    evalMock
      .mockRejectedValueOnce(new Error("command timed out"))
      .mockResolvedValueOnce(1);
    const guard = new ReportAssistantResourceGuard(env, logger);

    await expect(guard.acquire("actor")).resolves.toEqual({
      kind: "denied",
      reason: "unavailable",
      retryAfterSeconds: 1,
    });
    expect(evalMock).toHaveBeenLastCalledWith(
      REPORT_ASSISTANT_CANCEL_SCRIPT,
      3,
      expect.stringContaining("budget:actor"),
      expect.stringContaining("leases:actor"),
      expect.stringContaining("cancel:"),
      expect.any(String),
      240_000,
    );
    guard.onModuleDestroy();
  });
});
