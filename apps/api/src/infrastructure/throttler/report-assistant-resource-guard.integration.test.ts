import { randomUUID } from "node:crypto";

import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assertE2eRuntimeDestructiveTarget } from "../../../../../prisma/guards/_destructive-guard.js";
import { requireEnv } from "../../lib/env.js";
import {
  REPORT_ASSISTANT_ACQUIRE_SCRIPT,
  REPORT_ASSISTANT_CANCEL_SCRIPT,
  REPORT_ASSISTANT_RELEASE_SCRIPT,
  REPORT_ASSISTANT_RENEW_SCRIPT,
} from "./report-assistant-resource-guard.js";

const SCRIPT_NAME = "report-assistant-resource-guard.integration";
const LEASE_MS = 200;
const EXPIRING_LEASE_MS = 25;
const EXPIRY_WAIT_MS = 50;
const RENEWABLE_LEASE_MS = 100;
const RENEWAL_WAIT_MS = 60;
const scope = randomUUID();
type ResourceKeys = Readonly<{ budget: string; leases: string }>;
const keysFor = (lane: string): ResourceKeys => ({
  budget: `customreport:assistant-resource:v1:integration:${scope}:${lane}:budget`,
  leases: `customreport:assistant-resource:v1:integration:${scope}:${lane}:leases`,
});
const primaryKeys = keysFor("primary");
const budgetLimitKeys = keysFor("budget-limit");
const renewalKeys = keysFor("renewal");
const cancelKeys = new Set<string>();

const redisDb = requireEnv(process.env, "REDIS_DB");
const redis = new Redis({
  db: Number(redisDb),
  host: requireEnv(process.env, "REDIS_HOST"),
  port: Number(requireEnv(process.env, "REDIS_PORT")),
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  commandTimeout: 5000,
  lazyConnect: true,
});
let connected = false;

type AcquireResult = readonly [number, number, number];

function cancelKey(token: string): string {
  const key = `customreport:assistant-resource:v1:integration:${scope}:cancel:${token}`;
  cancelKeys.add(key);
  return key;
}

function assertSafeRedisDeletion(): void {
  assertE2eRuntimeDestructiveTarget(
    SCRIPT_NAME,
    requireEnv(process.env, "E2E_DATABASE_URL"),
    process.env,
  );
  if (redisDb !== "15") {
    throw new Error(
      `[${SCRIPT_NAME}] REDIS_DB must be exactly 15 before cleanup.`,
    );
  }
}

async function acquire(
  token: string,
  options: Readonly<{
    keys?: ResourceKeys;
    leaseMs?: number;
    requestLimit?: number;
    maxInFlight?: number;
    ignoredClientClock?: string;
  }> = {},
): Promise<AcquireResult> {
  const keys = options.keys ?? primaryKeys;
  const leaseMs = options.leaseMs ?? LEASE_MS;
  const result = await redis.eval(
    REPORT_ASSISTANT_ACQUIRE_SCRIPT,
    3,
    keys.budget,
    keys.leases,
    cancelKey(token),
    1000,
    options.requestLimit ?? 100,
    options.maxInFlight ?? 2,
    leaseMs,
    token,
    ...(options.ignoredClientClock === undefined
      ? []
      : [options.ignoredClientClock]),
  );
  if (
    !Array.isArray(result) ||
    result.length !== 3 ||
    result.some((value) => typeof value !== "number")
  ) {
    throw new Error("resource guard returned an invalid Lua response");
  }
  return [result[0], result[1], result[2]];
}

async function cancel(token: string): Promise<void> {
  await redis.eval(
    REPORT_ASSISTANT_CANCEL_SCRIPT,
    3,
    primaryKeys.budget,
    primaryKeys.leases,
    cancelKey(token),
    token,
    1000,
  );
}

async function release(
  token: string,
  keys: ResourceKeys = primaryKeys,
): Promise<void> {
  await redis.eval(REPORT_ASSISTANT_RELEASE_SCRIPT, 1, keys.leases, token);
}

async function expectAbsent(token: string): Promise<void> {
  await expect(redis.zscore(primaryKeys.budget, token)).resolves.toBeNull();
  await expect(redis.zscore(primaryKeys.leases, token)).resolves.toBeNull();
}

beforeAll(async () => {
  await redis.connect();
  connected = true;
});

afterAll(async () => {
  try {
    if (!connected) return;
    // This is the first and only Redis deletion: the guard and DB-15 check run
    // immediately before it, and every target is a UUID-scoped key from this run.
    assertSafeRedisDeletion();
    await redis.del(
      primaryKeys.budget,
      primaryKeys.leases,
      budgetLimitKeys.budget,
      budgetLimitKeys.leases,
      renewalKeys.budget,
      renewalKeys.leases,
      ...cancelKeys,
    );
  } finally {
    if (connected) await redis.quit();
    else redis.disconnect();
  }
});

describe("report assistant resource guard Lua scripts (integration)", () => {
  it("enforces leases, server time, idempotency, expiry, and cancellation", async () => {
    assertSafeRedisDeletion();
    const first = randomUUID();
    const second = randomUUID();
    const deniedThird = randomUUID();
    const afterRelease = randomUUID();
    expect(await acquire(first)).toEqual([1, 0, LEASE_MS]);
    expect(await acquire(second)).toEqual([1, 0, LEASE_MS]);
    expect((await acquire(deniedThird)).slice(0, 2)).toEqual([0, 2]);
    await release(first);
    expect(await acquire(afterRelease)).toEqual([1, 0, LEASE_MS]);
    await release(second);
    await release(afterRelease);

    const crashed = randomUUID();
    const afterCrash = randomUUID();
    expect(await acquire(crashed, { leaseMs: EXPIRING_LEASE_MS })).toEqual([
      1,
      0,
      EXPIRING_LEASE_MS,
    ]);
    await new Promise((resolve) => setTimeout(resolve, EXPIRY_WAIT_MS));
    expect(await acquire(afterCrash)).toEqual([1, 0, LEASE_MS]);
    await expect(redis.zscore(primaryKeys.leases, crashed)).resolves.toBeNull();
    await release(afterCrash);

    const idempotent = randomUUID();
    expect(await acquire(idempotent)).toEqual([1, 0, LEASE_MS]);
    expect((await acquire(idempotent)).slice(0, 2)).toEqual([1, 0]);
    await expect(redis.zcard(primaryKeys.budget)).resolves.toBe(6);
    await expect(redis.zcard(primaryKeys.leases)).resolves.toBe(1);
    await release(idempotent);

    // The production call has five ARGV values and no client timestamp. Even a
    // caller appending a forged far-future clock cannot change Redis TIME.
    expect(REPORT_ASSISTANT_ACQUIRE_SCRIPT).toContain("redis.call('TIME')");
    expect(REPORT_ASSISTANT_ACQUIRE_SCRIPT).not.toContain("ARGV[6]");
    const clockForged = randomUUID();
    expect(
      await acquire(clockForged, {
        ignoredClientClock: "32503680000000",
      }),
    ).toEqual([1, 0, LEASE_MS]);
    await release(clockForged);

    const cancelledBeforeAcquire = randomUUID();
    await cancel(cancelledBeforeAcquire);
    await expectAbsent(cancelledBeforeAcquire);
    expect(await acquire(cancelledBeforeAcquire)).toEqual([0, 3, 1]);
    await expectAbsent(cancelledBeforeAcquire);

    const cancelledAfterAcquire = randomUUID();
    expect(await acquire(cancelledAfterAcquire)).toEqual([1, 0, LEASE_MS]);
    await cancel(cancelledAfterAcquire);
    await expectAbsent(cancelledAfterAcquire);
    expect(await acquire(cancelledAfterAcquire)).toEqual([0, 3, 1]);
    await expectAbsent(cancelledAfterAcquire);

    const budgetFirst = randomUUID();
    const budgetSecond = randomUUID();
    const budgetDenied = randomUUID();
    const budgetOptions = {
      keys: budgetLimitKeys,
      requestLimit: 2,
      maxInFlight: 1,
    } as const;
    expect(await acquire(budgetFirst, budgetOptions)).toEqual([1, 0, LEASE_MS]);
    await release(budgetFirst, budgetLimitKeys);
    expect(await acquire(budgetSecond, budgetOptions)).toEqual([
      1,
      0,
      LEASE_MS,
    ]);
    await release(budgetSecond, budgetLimitKeys);
    expect((await acquire(budgetDenied, budgetOptions)).slice(0, 2)).toEqual([
      0, 1,
    ]);

    const renewed = randomUUID();
    const renewalChallenger = randomUUID();
    const renewalOptions = {
      keys: renewalKeys,
      leaseMs: RENEWABLE_LEASE_MS,
      maxInFlight: 1,
    } as const;
    expect(await acquire(renewed, renewalOptions)).toEqual([
      1,
      0,
      RENEWABLE_LEASE_MS,
    ]);
    await new Promise((resolve) => setTimeout(resolve, RENEWAL_WAIT_MS));
    await expect(
      redis.eval(
        REPORT_ASSISTANT_RENEW_SCRIPT,
        1,
        renewalKeys.leases,
        renewed,
        RENEWABLE_LEASE_MS,
      ),
    ).resolves.toBe(1);
    await new Promise((resolve) => setTimeout(resolve, RENEWAL_WAIT_MS));
    expect(
      (await acquire(renewalChallenger, renewalOptions)).slice(0, 2),
    ).toEqual([0, 2]);
    await release(renewed, renewalKeys);
  });
});
