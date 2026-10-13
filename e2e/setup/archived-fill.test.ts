import assert from "node:assert/strict";
import { mock, test } from "node:test";

interface Scenario {
  readonly name: string;
  readonly construct?: boolean;
  readonly primaryFailed?: boolean;
  readonly primary?: unknown;
  readonly disconnect?: boolean;
  readonly pool?: boolean;
}

const constructorError = new Error("Synthetic constructor failure");
const operationError = new Error("Synthetic fixture failure");
const disconnectError = new Error("Synthetic disconnect failure");
const poolError = new Error("Synthetic pool failure");
const events: string[] = [];
let scenario: Scenario = { name: "success" };

class Pool {
  end() {
    events.push("pool.end");
    if (scenario.pool) throw poolError;
    return Promise.resolve();
  }
}
class PrismaClient {
  constructor() {
    if (scenario.construct) throw constructorError;
  }
  user = {
    findUniqueOrThrow: () => Promise.resolve({ id: "head", name: "Head" }),
  };
  report = {
    create: () => {
      events.push("write");
      return scenario.primaryFailed
        ? Promise.reject(scenario.primary)
        : Promise.resolve();
    },
  };
  $disconnect() {
    events.push("disconnect");
    return scenario.disconnect
      ? Promise.reject(disconnectError)
      : Promise.resolve();
  }
}

mock.module("pg", { exports: { default: { Pool } } });
mock.module("@prisma/adapter-pg", {
  exports: {
    PrismaPg: function PrismaPg() {
      return {};
    },
  },
});
mock.module("@prisma/client", {
  exports: { ...(await import("@prisma/client")), PrismaClient },
});
mock.module(new URL("./runtime-target.ts", import.meta.url).href, {
  exports: {
    validateE2eRuntimeTarget: () => ({
      e2eDatabaseUrl: "postgresql://fixture.invalid/unused",
    }),
  },
});
mock.module(
  new URL("../../prisma/seeds/support/published-snapshot.ts", import.meta.url)
    .href,
  {
    exports: {
      provisionalPublishedSnapshot: () => ({}),
      finalizePublishedSnapshots: () => {
        events.push("finalize");
        return Promise.resolve();
      },
    },
  },
);
const { applyArchivedFillFixture } = await import("./archived-fill.js");

const scenarios: readonly Scenario[] = [
  { name: "success" },
  { name: "constructor failure", construct: true },
  { name: "disconnect failure", disconnect: true },
  { name: "pool failure", pool: true },
  { name: "both cleanup failures", disconnect: true, pool: true },
  { name: "fixture failure", primaryFailed: true, primary: operationError },
  { name: "undefined fixture failure", primaryFailed: true },
  {
    name: "fixture failure with pool failure",
    primaryFailed: true,
    primary: operationError,
    pool: true,
  },
  {
    name: "fixture failure with both cleanup failures",
    primaryFailed: true,
    primary: operationError,
    disconnect: true,
    pool: true,
  },
  {
    name: "undefined fixture failure with both cleanup failures",
    primaryFailed: true,
    disconnect: true,
    pool: true,
  },
  { name: "constructor and pool failures", construct: true, pool: true },
];

for (const current of scenarios) {
  void test(`archived Fill fixture releases resources: ${current.name}`, async () => {
    scenario = current;
    events.length = 0;
    let failed = false;
    let reported: unknown;
    try {
      await applyArchivedFillFixture();
    } catch (error) {
      failed = true;
      reported = error;
    }

    assert.equal(events.filter((event) => event === "pool.end").length, 1);
    assert.equal(
      events.filter((event) => event === "disconnect").length,
      current.construct ? 0 : 1,
    );
    const hasPrimary =
      current.construct === true || current.primaryFailed === true;
    const primary = current.construct ? constructorError : current.primary;
    const cleanup = [
      current.disconnect ? disconnectError : null,
      current.pool ? poolError : null,
    ].filter((error) => error !== null);
    assert.equal(failed, hasPrimary || cleanup.length > 0);
    if (cleanup.length > 0) {
      assert(reported instanceof AggregateError);
      assert.deepEqual(
        reported.errors,
        hasPrimary ? [primary, ...cleanup] : cleanup,
      );
      assert.equal(reported.cause, hasPrimary ? primary : undefined);
    } else assert.equal(reported, primary);
    assert.equal(events.includes("write"), !current.construct);
    assert.equal(events.includes("finalize"), !hasPrimary);
  });
}
