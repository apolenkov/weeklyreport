import { request } from "node:http";
import type { AddressInfo } from "node:net";

import express from "express";
import type { ClientRateLimitInfo, Options, Store } from "express-rate-limit";
import type { Redis } from "ioredis";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../lib/logger";
import { createFakeRedisCall } from "../../test-utils/fake-redis-call";
import { createRateLimits } from "./rate-limit.middleware";
import {
  RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS,
  RateLimitDegradedStore,
} from "./rate-limit-degraded-store";

const postStatus = (port: number): Promise<number> =>
  new Promise<number>((resolve, reject) => {
    const clientRequest = request(
      { host: "127.0.0.1", port, path: "/", method: "POST" },
      (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode ?? 0));
      },
    );
    clientRequest.on("error", reject);
    clientRequest.end();
  });

const storeOptions = { windowMs: 60_000 } as Options;

function createPrimary(overrides: Partial<Store>): Store {
  return {
    increment: () => ({
      totalHits: 1,
      resetTime: new Date(Date.now() + storeOptions.windowMs),
    }),
    decrement: () => undefined,
    resetKey: () => undefined,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("rate-limit Redis readiness", () => {
  it("falls back once and returns to Redis after a post-start outage", async () => {
    const fake = createFakeRedisCall();
    const call = vi
      .fn<typeof fake.call>()
      .mockImplementation((...args) => fake.call(...args));
    const redis = { ...fake, call };
    const storeError = vi.fn<AppLogger["error"]>();
    const logger: AppLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: storeError,
      child: () => logger,
    };
    const app = express();
    app.disable("x-powered-by");
    app.set("trust proxy", 1);
    const { authLimiter } = await createRateLimits({
      logger,
      isTest: false,
      redis: redis as unknown as Redis,
    });
    // Five independent buckets load their Redis script once (two commands per
    // store); adding an ingress must deliberately update this readiness count.
    await vi.waitFor(() => expect(call).toHaveBeenCalledTimes(10));
    app.use(authLimiter);
    app.post("/", (_request, response) => response.sendStatus(204));

    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;
    try {
      call.mockClear();
      call.mockRejectedValue(new Error("redis unavailable"));
      const degradedStatus = await postStatus(port);
      expect(degradedStatus).toBe(204);
      // rate-limit-redis retries only an explicit NOSCRIPT reply. Retrying an
      // indeterminate transport failure could double-count a committed hit.
      expect(call).toHaveBeenCalledOnce();
      expect(call.mock.calls[0]?.[0]).toBe("EVALSHA");
      expect(storeError).toHaveBeenCalledOnce();

      call.mockClear();
      call.mockImplementation((...args) => fake.call(...args));
      const recoveredStatuses = await Promise.all(
        Array.from({ length: 5 }, () => postStatus(port)),
      );
      const statuses = [degradedStatus, ...recoveredStatuses];
      expect(statuses.filter((status) => status === 204)).toHaveLength(5);
      expect(statuses.filter((status) => status === 429)).toHaveLength(1);
      expect(call.mock.calls.some(([command]) => command === "EVALSHA")).toBe(
        true,
      );
      expect(storeError).toHaveBeenCalledOnce();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("rate-limit degraded-store command bounds", () => {
  it("falls back when increment hangs and ignores its late result", async () => {
    vi.useFakeTimers();
    const deferred = Promise.withResolvers<ClientRateLimitInfo>();
    const reportError = vi.fn<(error: unknown) => void>();
    const store = new RateLimitDegradedStore(
      createPrimary({ increment: () => deferred.promise }),
      reportError,
    );
    await store.init(storeOptions);

    const resultPromise = store.increment("client");
    await vi.advanceTimersByTimeAsync(RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS);
    await expect(resultPromise).resolves.toMatchObject({ totalHits: 1 });
    expect(reportError).toHaveBeenCalledOnce();
    const firstError = reportError.mock.calls[0]?.[0];
    expect(firstError).toBeInstanceOf(Error);
    expect((firstError as Error).message).toContain("increment timed out");

    deferred.resolve({
      totalHits: 99,
      resetTime: new Date(Date.now() + storeOptions.windowMs),
    });
    await Promise.resolve();
    expect(reportError).toHaveBeenCalledOnce();
  });

  it.each(["get", "decrement", "resetKey", "resetAll"] as const)(
    "reports a bounded %s timeout and observes late rejection",
    async (operation) => {
      vi.useFakeTimers();
      const deferred = Promise.withResolvers<unknown>();
      const overrides: Partial<Store> =
        operation === "get"
          ? { get: () => deferred.promise as Promise<ClientRateLimitInfo> }
          : operation === "decrement"
            ? { decrement: () => deferred.promise as Promise<void> }
            : operation === "resetKey"
              ? { resetKey: () => deferred.promise as Promise<void> }
              : { resetAll: () => deferred.promise as Promise<void> };
      const reportError = vi.fn<(error: unknown) => void>();
      const store = new RateLimitDegradedStore(
        createPrimary(overrides),
        reportError,
      );
      await store.init(storeOptions);

      const operationPromise =
        operation === "get"
          ? store.get("client")
          : operation === "decrement"
            ? store.decrement("client")
            : operation === "resetKey"
              ? store.resetKey("client")
              : store.resetAll();
      await vi.advanceTimersByTimeAsync(RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS);
      await expect(operationPromise).resolves.toBeUndefined();
      expect(reportError).toHaveBeenCalledOnce();
      const firstError = reportError.mock.calls[0]?.[0];
      expect(firstError).toBeInstanceOf(Error);
      expect((firstError as Error).message).toContain(`${operation} timed out`);

      deferred.reject(new Error("late Redis failure"));
      await Promise.resolve();
      expect(reportError).toHaveBeenCalledOnce();
    },
  );

  it("clears the local timeout after a fast primary success", async () => {
    vi.useFakeTimers();
    const reportError = vi.fn<(error: unknown) => void>();
    const store = new RateLimitDegradedStore(
      createPrimary({
        increment: () => ({
          totalHits: 4,
          resetTime: new Date(Date.now() + storeOptions.windowMs),
        }),
      }),
      reportError,
    );
    await store.init(storeOptions);

    await expect(store.increment("client")).resolves.toMatchObject({
      totalHits: 4,
    });
    await vi.advanceTimersByTimeAsync(RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS);
    expect(reportError).not.toHaveBeenCalled();
  });
});
