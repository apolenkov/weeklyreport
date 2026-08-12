import { request } from "node:http";
import type { AddressInfo } from "node:net";

import express from "express";
import type Redis from "ioredis";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../lib/logger";
import { createFakeRedisCall } from "../../test-utils/fake-redis-call";
import { createRateLimits } from "./rate-limit.middleware";

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
    await vi.waitFor(() => expect(call).toHaveBeenCalledTimes(8));
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
      expect(call).toHaveBeenCalledTimes(2);
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
