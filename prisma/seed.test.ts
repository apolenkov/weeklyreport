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
  "./guards/_destructive-guard.js",
  "./seed-ai-prompts.js",
  "./seeds/advanced/seed-advanced.active-sections.js",
  "./seeds/advanced/seed-advanced.admin-examples.js",
  "./seeds/advanced/seed-advanced.cross-author.js",
  "./seeds/advanced/seed-advanced.decisions.js",
  "./seeds/advanced/seed-advanced.history.js",
  "./seeds/advanced/seed-advanced.published-sections.js",
  "./seeds/advanced/seed-advanced.reminders.js",
  "./seeds/advanced/seed-advanced.reports.js",
  "./seeds/advanced/seed-advanced.risks.js",
  "./seeds/advanced/seed-advanced.settings.js",
  "./seeds/advanced/seed-advanced.stage-assignments.js",
  "./seeds/advanced/seed-advanced.ux-fixtures.js",
  "./seeds/support/published-snapshot.js",
  "./seeds/support/seed-assistant-readiness.js",
  "./seeds/support/seed-coverage-check.js",
  "./seeds/support/seed-org.js",
];
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  for (const module of mockedModules) vi.doUnmock(module);
});

it.each(scenarios)(
  "finalizes the actual canonical seed entrypoint: $name",
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
    }
    vi.doMock("pg", () => ({ default: { Pool } }));
    vi.doMock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
    vi.doMock("@prisma/client", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@prisma/client")>()),
      PrismaClient,
    }));
    vi.doMock("./guards/_destructive-guard.js", () => ({
      assertE2eRuntimeDestructive: () => undefined,
    }));
    const sectionCounts = {
      sections: 0,
      items: 0,
      projectStatuses: 0,
      stageStatuses: 0,
    };
    vi.doMock("./seed-ai-prompts.js", () => ({
      seedAiPromptBaseline: () => Promise.resolve(undefined),
      seedAiProviderControl: () => Promise.resolve(undefined),
    }));
    vi.doMock("./seeds/advanced/seed-advanced.active-sections.js", () => ({
      seedActiveSections: () => Promise.resolve(sectionCounts),
    }));
    vi.doMock("./seeds/advanced/seed-advanced.admin-examples.js", () => ({
      seedAdminExamples: () =>
        Promise.resolve({
          viewerGroupAccesses: 0,
          reopenRequests: 0,
          actionLogs: 0,
        }),
    }));
    vi.doMock("./seeds/advanced/seed-advanced.cross-author.js", () => ({
      seedCrossAuthorOverlay: () => Promise.resolve(undefined),
    }));
    vi.doMock("./seeds/advanced/seed-advanced.decisions.js", () => ({
      seedDecisions: () => Promise.resolve(0),
    }));
    vi.doMock("./seeds/advanced/seed-advanced.history.js", () => ({
      seedHistoryPeriods: () =>
        Promise.resolve({ reports: 0, sections: sectionCounts }),
    }));
    vi.doMock("./seeds/advanced/seed-advanced.published-sections.js", () => ({
      seedPublishedSections: () => Promise.resolve(sectionCounts),
    }));
    vi.doMock("./seeds/advanced/seed-advanced.reminders.js", () => ({
      seedReminders: () => Promise.resolve({ policies: 0, rules: 0 }),
    }));
    vi.doMock("./seeds/advanced/seed-advanced.reports.js", () => ({
      seedActiveReport: () => Promise.resolve(0),
      seedPublishedReport: () => Promise.resolve(0),
    }));
    vi.doMock("./seeds/advanced/seed-advanced.risks.js", () => ({
      seedRisks: () => Promise.resolve(0),
    }));
    vi.doMock("./seeds/advanced/seed-advanced.settings.js", () => ({
      seedSingletons: () => Promise.resolve(undefined),
    }));
    vi.doMock("./seeds/advanced/seed-advanced.stage-assignments.js", () => ({
      seedStageAssignments: () =>
        Promise.resolve({ count: 0, ownership: new Map() }),
    }));
    vi.doMock("./seeds/advanced/seed-advanced.ux-fixtures.js", () => ({
      seedUxFixtures: () => Promise.resolve({ reports: 0, sections: 0 }),
    }));
    vi.doMock("./seeds/support/published-snapshot.js", () => ({
      finalizePublishedSnapshots: () => Promise.resolve(undefined),
    }));
    vi.doMock("./seeds/support/seed-assistant-readiness.js", () => ({
      assertAssistantReadiness: () => events.push("readiness"),
    }));
    vi.doMock("./seeds/support/seed-coverage-check.js", () => ({
      assertSeedCoverage: () => {
        events.push("coverage");
        return Promise.resolve();
      },
    }));
    vi.doMock("./seeds/support/seed-org.js", () => ({
      seedOrganizationBaseline: () => {
        events.push("write");
        return scenario.primaryFailed
          ? Promise.reject(scenario.primary)
          : Promise.resolve({ groups: 0, users: 0, products: 0, stages: 0 });
      },
    }));
    vi.spyOn(console, "log").mockImplementation((...values: unknown[]) => {
      const message = String(values[0]);
      if (message.startsWith("Seeded:")) {
        events.push("summary");
        terminal.resolve(undefined);
      }
    });
    const errors = vi
      .spyOn(console, "error")
      .mockImplementation((...values: unknown[]) => {
        terminal.resolve(values[0]);
      });

    try {
      await import("./seed.js");
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
        expect(process.exitCode).toBe(1);
        expect(events).not.toContain("summary");
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
        expect(process.exitCode).toBeUndefined();
      }
      if (!hasPrimary) {
        expect(events.indexOf("coverage")).toBeLessThan(
          events.indexOf("readiness"),
        );
        if (cleanup.length === 0)
          expect(events).toEqual([
            "write",
            "coverage",
            "readiness",
            "disconnect",
            "pool.end",
            "summary",
          ]);
      }
    } finally {
      process.exitCode = previousExitCode;
    }
  },
);
