import { afterEach, expect, it, vi } from "vitest";

const operationError = new Error("Synthetic operation failure");
const constructorError = new Error("Synthetic constructor failure");
const disconnectError = new Error("Synthetic disconnect failure");
const poolError = new Error("Synthetic pool failure");
const scenarios = [
  {
    name: "success",
    primaryFailed: false,
    primary: undefined,
    construct: false,
    disconnect: false,
    pool: false,
  },
  {
    name: "operation failure",
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
    primary: "Synthetic failure",
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

const mockedModules = [
  "pg",
  "@prisma/adapter-pg",
  "@prisma/client",
  "../../guards/_destructive-guard.js",
  "../support/published-snapshot.js",
  "../support/seed-assistant-readiness.js",
  "../support/seed-coverage-check.js",
  "../support/wipe-seed-data.js",
  "./seed-simple.access-and-policies.js",
  "./seed-simple.activities.js",
  "./seed-simple.activity-records.js",
  "./seed-simple.cross-author-overlay.js",
  "./seed-simple.history.js",
  "./seed-simple.organization.js",
  "./seed-simple.products.js",
  "./seed-simple.reports.js",
  "./seed-simple.sections.js",
  "./seed-simple.stages.js",
  "./seed-simple.users.js",
];
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  for (const module of mockedModules) vi.doUnmock(module);
});

it.each(scenarios)(
  "finalizes the actual simple seed entrypoint: $name",
  async (scenario) => {
    vi.resetModules();
    const events: string[] = [];
    const terminal = Promise.withResolvers<unknown>();
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;
    class Pool {
      end() {
        events.push("pool.end");
        if (scenario.pool) throw poolError;
        if (
          !scenario.primaryFailed &&
          !scenario.construct &&
          !scenario.disconnect
        )
          terminal.resolve(undefined);
        return Promise.resolve();
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
      user = {
        count: () => {
          events.push("count");
          return Promise.resolve(0);
        },
      };
      project = {
        count: () => {
          events.push("count");
          return Promise.resolve(0);
        },
      };
      stage = {
        count: () => {
          events.push("count");
          return Promise.resolve(0);
        },
      };
      stageStatus = {
        count: () => {
          events.push("count");
          return Promise.resolve(0);
        },
      };
      report = {
        count: () => {
          events.push("count");
          return Promise.resolve(0);
        },
      };
      reportSection = {
        count: () => {
          events.push("count");
          return Promise.resolve(0);
        },
      };
      item = {
        count: () => {
          events.push("count");
          return Promise.resolve(0);
        },
      };
      projectStatus = {
        count: () => {
          events.push("count");
          return Promise.resolve(0);
        },
      };
      projectActivity = {
        count: () => {
          events.push("count");
          return Promise.resolve(0);
        },
      };
      activityStatus = {
        count: () => {
          events.push("count");
          return Promise.resolve(0);
        },
      };
      projectActivityProduct = {
        count: () => {
          events.push("count");
          return Promise.resolve(0);
        },
      };
      risk = {
        count: () => {
          events.push("count");
          return Promise.resolve(0);
        },
      };
      decision = {
        count: () => {
          events.push("count");
          return Promise.resolve(0);
        },
      };
      reminderPolicy = {
        count: () => {
          events.push("count");
          return Promise.resolve(0);
        },
      };
      reminderRule = {
        count: () => {
          events.push("count");
          return Promise.resolve(0);
        },
      };
      reopenRequest = {
        count: () => {
          events.push("count");
          return Promise.resolve(0);
        },
      };
      userActionLog = {
        count: () => {
          events.push("count");
          return Promise.resolve(0);
        },
      };
      organization = {
        count: () => {
          events.push("count");
          return Promise.resolve(0);
        },
      };
      appSettings = {
        count: () => {
          events.push("count");
          return Promise.resolve(0);
        },
      };
    }
    vi.doMock("pg", () => ({ default: { Pool } }));
    vi.doMock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
    vi.doMock("@prisma/client", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@prisma/client")>()),
      PrismaClient,
    }));
    vi.doMock("../../guards/_destructive-guard.js", () => ({
      assertE2eRuntimeDestructive: () => undefined,
    }));
    vi.doMock("../support/published-snapshot.js", () => ({
      finalizePublishedSnapshots: () => Promise.resolve(),
    }));
    vi.doMock("../support/seed-assistant-readiness.js", () => ({
      assertAssistantReadiness: () => events.push("readiness"),
    }));
    vi.doMock("../support/seed-coverage-check.js", () => ({
      assertSeedCoverage: () => {
        events.push("coverage");
        return Promise.resolve();
      },
    }));
    vi.doMock("../support/wipe-seed-data.js", () => ({
      wipeSeedData: () => {
        events.push("write");
        return scenario.primaryFailed
          ? Promise.reject(scenario.primary)
          : Promise.resolve();
      },
    }));
    vi.doMock("./seed-simple.access-and-policies.js", () => ({
      seedActionLog: () => Promise.resolve(),
      seedGroupLeaderAndViewer: () => Promise.resolve(),
      seedReminderPolicies: () => Promise.resolve(),
      seedReopenRequest: () => Promise.resolve(),
    }));
    vi.doMock("./seed-simple.activities.js", () => ({
      seedProjectActivities: () => Promise.resolve(),
    }));
    vi.doMock("./seed-simple.activity-records.js", () => ({
      seedActivityOnlyLead: () => Promise.resolve(),
      seedActivityParentedRecords: () => Promise.resolve(),
    }));
    vi.doMock("./seed-simple.cross-author-overlay.js", () => ({
      seedCrossAuthorOverlay: () => Promise.resolve(),
    }));
    vi.doMock("./seed-simple.history.js", () => ({
      seedArchivedHistory: () => Promise.resolve(),
      seedPublishedWeekSections: () => Promise.resolve(),
    }));
    vi.doMock("./seed-simple.organization.js", () => ({
      seedOrganizationSettings: () => Promise.resolve(),
      seedReportingGroups: () => Promise.resolve(),
    }));
    vi.doMock("./seed-simple.products.js", () => ({
      seedProducts: () => Promise.resolve(),
    }));
    vi.doMock("./seed-simple.reports.js", () => ({
      seedReports: () => Promise.resolve(),
    }));
    vi.doMock("./seed-simple.sections.js", () => ({
      seedActiveSections: () => Promise.resolve(),
    }));
    vi.doMock("./seed-simple.stages.js", () => ({
      seedStageAssignments: () => Promise.resolve(),
      seedStages: () => Promise.resolve(),
    }));
    vi.doMock("./seed-simple.users.js", () => ({
      seedUsers: () => Promise.resolve(),
    }));
    vi.spyOn(console, "log").mockImplementation((...values: unknown[]) => {
      const message = String(values[0]);
      if (message.includes("Done:")) events.push("count-summary");
      if (message.includes("Active period:")) events.push("period-summary");
    });
    const errors = vi
      .spyOn(console, "error")
      .mockImplementation((...values: unknown[]) => {
        terminal.resolve(values[1]);
      });
    const exit = vi.spyOn(process, "exit").mockReturnValue(undefined as never);
    try {
      await import("./seed-simple.js");
      const reported = await terminal.promise;
      expect(events).toContain("pool.end");
      expect(events.filter((event) => event === "disconnect")).toHaveLength(
        scenario.construct ? 0 : 1,
      );
      const hasPrimary = scenario.construct || scenario.primaryFailed;
      const primary = scenario.construct ? constructorError : scenario.primary;
      const cleanup = [
        scenario.disconnect ? disconnectError : null,
        scenario.pool ? poolError : null,
      ].filter((error) => error !== null);
      if (hasPrimary || cleanup.length > 0) {
        expect(errors).toHaveBeenCalledOnce();
        expect(exit).toHaveBeenCalledWith(1);
        expect(events.indexOf("pool.end")).toBeLessThan(events.length);
        if (cleanup.length > 0) {
          expect(reported).toBeInstanceOf(AggregateError);
          const aggregate = reported as AggregateError;
          expect(aggregate.errors).toEqual(
            hasPrimary ? [primary, ...cleanup] : cleanup,
          );
          expect(aggregate.cause).toBe(hasPrimary ? primary : undefined);
        } else expect(reported).toBe(primary);
      } else {
        expect(errors).not.toHaveBeenCalled();
        expect(exit).not.toHaveBeenCalled();
      }
      if (!hasPrimary) {
        expect(events.filter((event) => event === "count")).toHaveLength(21);
        expect(events.indexOf("coverage")).toBeLessThan(
          events.indexOf("readiness"),
        );
        expect(events.indexOf("readiness")).toBeLessThan(
          events.indexOf("count-summary"),
        );
        expect(events.indexOf("count-summary")).toBeLessThan(
          events.indexOf("period-summary"),
        );
        expect(events.indexOf("period-summary")).toBeLessThan(
          events.indexOf("disconnect"),
        );
      } else expect(events).not.toContain("count-summary");
    } finally {
      process.exitCode = previousExitCode;
    }
  },
);
