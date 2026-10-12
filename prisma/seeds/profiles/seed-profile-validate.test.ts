import { afterEach, describe, expect, it, vi } from "vitest";

import { formatSeedProfileValidationSummary } from "./seed-profile-validate.js";

describe("seed profile validation summary", () => {
  it("prints only the profile and bounded row counts", () => {
    const summary = formatSeedProfileValidationSummary({
      profile: "full",
      counts: {
        users: 13,
        projects: 15,
        reports: 8,
        sections: 55,
        items: 221,
      },
      userIds: ["user-id"],
      projectIds: ["project-id"],
      reportIds: ["report-id"],
      itemRecords: [
        {
          id: "item-id",
          reportSectionId: "section-id",
          stableId: "stable-id",
          text: "must not be printed",
        },
      ],
      riskRecords: [
        {
          id: "risk-id",
          reportSectionId: "section-id",
          stableId: "stable-id",
          risk: "must not be printed",
          impact: "must not be printed",
          mitigation: "must not be printed",
        },
      ],
      decisionRecords: [
        {
          id: "decision-id",
          reportSectionId: "section-id",
          stableId: "stable-id",
          text: "must not be printed",
        },
      ],
      stableText: ["must not be printed"],
    });

    expect(summary).toBe(
      "[seed-profile:full] validated: users=13, projects=15, reports=8, sections=55, items=221",
    );
    expect(summary).not.toContain("item-id");
    expect(summary).not.toContain("must not be printed");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  for (const module of [
    "pg",
    "@prisma/adapter-pg",
    "@prisma/client",
    "../../guards/_entrypoint.js",
    "../../guards/_destructive-guard.js",
    "./seed-profile-validator.js",
  ])
    vi.doUnmock(module);
});

const operationError = new Error("Synthetic validation failure");
const disconnectError = new Error("Synthetic disconnect failure");
const poolError = new Error("Synthetic pool failure");
const constructorError = new Error("Synthetic constructor failure");
const cases = [
  {
    name: "success",
    primaryFailed: false,
    primary: undefined,
    construct: false,
    disconnect: false,
    pool: false,
  },
  {
    name: "validation failure",
    primaryFailed: true,
    primary: operationError,
    construct: false,
    disconnect: false,
    pool: false,
  },
  {
    name: "throw undefined",
    primaryFailed: true,
    primary: undefined,
    construct: false,
    disconnect: false,
    pool: false,
  },
  {
    name: "non-Error primary",
    primaryFailed: true,
    primary: "Synthetic primary",
    construct: false,
    disconnect: false,
    pool: false,
  },
  {
    name: "constructor failure",
    primaryFailed: false,
    primary: undefined,
    construct: true,
    disconnect: false,
    pool: false,
  },
  {
    name: "disconnect failure",
    primaryFailed: false,
    primary: undefined,
    construct: false,
    disconnect: true,
    pool: false,
  },
  {
    name: "pool failure",
    primaryFailed: false,
    primary: undefined,
    construct: false,
    disconnect: false,
    pool: true,
  },
  {
    name: "all failures",
    primaryFailed: true,
    primary: operationError,
    construct: false,
    disconnect: true,
    pool: true,
  },
];

it.each(cases)(
  "finalizes the actual validation entrypoint: $name",
  async (scenario) => {
    vi.resetModules();
    const events: string[] = [];
    const terminal = Promise.withResolvers<{
      failed: boolean;
      error: unknown;
    }>();
    const previousExitCode = process.exitCode;
    const previousArgv = process.argv;
    process.argv = [
      process.execPath,
      "synthetic-profile-validate.ts",
      "minimal",
    ];
    process.exitCode = undefined;
    class Pool {
      end() {
        events.push("pool.end");
        return scenario.pool ? Promise.reject(poolError) : Promise.resolve();
      }
    }
    class PrismaClient {
      constructor() {
        if (scenario.construct) throw constructorError;
      }
      $disconnect() {
        events.push("disconnect");
        return scenario.disconnect
          ? Promise.reject(disconnectError)
          : Promise.resolve();
      }
    }
    vi.doMock("pg", () => ({ default: { Pool } }));
    vi.doMock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
    vi.doMock("@prisma/client", () => ({ PrismaClient }));
    vi.doMock("../../guards/_entrypoint.js", () => ({
      isEntrypoint: () => true,
    }));
    vi.doMock("../../guards/_destructive-guard.js", () => ({
      assertE2eRuntimeDestructive: () => undefined,
    }));
    vi.doMock("./seed-profile-validator.js", () => ({
      validateSeedProfile: () => {
        events.push("validate");
        if (scenario.primaryFailed) return Promise.reject(scenario.primary);
        return Promise.resolve({
          profile: "minimal",
          counts: { users: 5, projects: 1, reports: 1, sections: 1, items: 1 },
        });
      },
    }));
    const logs = vi
      .spyOn(console, "log")
      .mockImplementation((...values: unknown[]) => {
        if (String(values[0]).includes("validated:")) {
          events.push("validated-summary");
          terminal.resolve({ failed: false, error: undefined });
        }
      });
    vi.spyOn(console, "error").mockImplementation(
      (_message: unknown, error: unknown) =>
        terminal.resolve({ failed: true, error }),
    );
    try {
      await import("./seed-profile-validate.js");
      const reported = await terminal.promise;
      expect(events).toContain("pool.end");
      expect(events.filter((event) => event === "disconnect")).toHaveLength(
        scenario.construct ? 0 : 1,
      );
      const primary = scenario.construct ? constructorError : scenario.primary;
      const hasPrimary = scenario.construct || scenario.primaryFailed;
      const cleanup = [
        scenario.disconnect ? disconnectError : null,
        scenario.pool ? poolError : null,
      ].filter((error) => error !== null);
      if (hasPrimary || cleanup.length > 0) {
        expect(reported.failed).toBe(true);
        expect(process.exitCode).toBe(1);
        expect(logs).not.toHaveBeenCalled();
        if (cleanup.length > 0) {
          expect(reported.error).toBeInstanceOf(AggregateError);
          const aggregate = reported.error as AggregateError;
          expect(aggregate.errors).toEqual(
            hasPrimary ? [primary, ...cleanup] : cleanup,
          );
          expect(aggregate.cause).toBe(hasPrimary ? primary : undefined);
        } else {
          expect(reported.error).toBe(primary);
        }
      } else {
        expect(reported.failed).toBe(false);
        expect(events).toEqual([
          "validate",
          "disconnect",
          "pool.end",
          "validated-summary",
        ]);
        expect(process.exitCode).toBeUndefined();
      }
    } finally {
      process.exitCode = previousExitCode;
      process.argv = previousArgv;
    }
  },
);
