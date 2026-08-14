import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RuntimeDatabaseSnapshot } from "./state-oracle.ts";
import {
  buildStatePreparationPlan,
  prepareRuntimeStateWithMutation,
  type RuntimeStateAxes,
  type RuntimeStateTransaction,
} from "./state-preparation.ts";

const axes: RuntimeStateAxes = {
  lifecycle: "open",
  submission: "draft",
  ownership: "single",
  permission: "allowed",
};
const request = {
  profile: "full" as const,
  axes,
  databaseUrl: "postgresql://localhost/customreport_e2e",
  repoRoot: "/workspace/customreport",
  routeRole: "lead" as const,
  routeTarget: "active" as const,
  routeKey: "lead:/lead/report/[reportId]",
};

const snapshotFor = (
  plan: ReturnType<typeof buildStatePreparationPlan>,
): RuntimeDatabaseSnapshot => ({
  report: {
    status: plan.report.status,
    periodState: plan.report.periodState,
    periodStatus: plan.report.periodStatus,
    archived: plan.report.archived,
  },
  section: { ...plan.section.state, version: 1 },
  ownership: {
    targetOwnerId: plan.targets.ownerId,
    owners: plan.ownership.assignments.map(({ userId }) => userId),
    assignments: plan.ownership.assignments.map(({ stageId, userId }) => ({
      id: `assignment-${stageId}`,
      stageId,
      userId,
    })),
  },
  permission: {
    actorId: plan.permission.actorId,
    actorRole: "lead",
    authenticated: plan.permission.actorId !== null,
    allowed: plan.permission.boundary === "allowed",
    ownsTarget: plan.permission.actorId === plan.targets.ownerId,
  },
});

beforeEach(() => {
  vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");
});

afterEach(() => vi.unstubAllEnvs());

describe("route-local state preparation mutations", () => {
  it("rejects an equivalent developer target before the injected resetter", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://developer:credentials@localhost:5432/customreport_e2e",
    );
    vi.stubEnv("NODE_ENV", "test");
    const resetAndSeed = vi.fn();

    await expect(
      prepareRuntimeStateWithMutation(
        {
          ...request,
          databaseUrl:
            "postgres://runtime:other@127.0.0.1:5432/customreport_e2e",
        },
        {} as Parameters<typeof prepareRuntimeStateWithMutation>[1],
        vi.fn(),
        resetAndSeed,
      ),
    ).rejects.toThrow(/must differ/iu);
    expect(resetAndSeed).not.toHaveBeenCalled();
  });

  it("runs the viewer grant removal inside the guarded preparation transaction", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/customreport_dev");
    vi.stubEnv("NODE_ENV", "test");
    const plan = buildStatePreparationPlan(request);
    const events: string[] = [];
    let grants = [
      {
        id: "grant-1",
        viewerUserId: "viewer",
        groupId: "group",
        canReview: false,
      },
    ];
    const transaction: RuntimeStateTransaction = {
      updateReport: () => {
        events.push("report");
        return Promise.resolve();
      },
      updateSection: () => {
        events.push("section");
        return Promise.resolve();
      },
      replaceOwnership: () => {
        events.push("ownership");
        return Promise.resolve();
      },
      readSnapshot: () => Promise.resolve(snapshotFor(plan)),
      readMutationSentinel: () => Promise.resolve([]),
      readViewerGroupAccess: () => Promise.resolve(grants),
      removeViewerGroupAccess: () => {
        events.push("remove-viewer-grants");
        const count = grants.length;
        grants = [];
        return Promise.resolve(count);
      },
    };
    const result = await prepareRuntimeStateWithMutation(
      request,
      {
        transaction: async (work) => {
          events.push("transaction");
          return work(transaction);
        },
      },
      async ({ transaction: scoped }) => {
        const before = await scoped.readViewerGroupAccess("viewer");
        const removed = await scoped.removeViewerGroupAccess("viewer");
        const after = await scoped.readViewerGroupAccess("viewer");
        return { before, removed, after };
      },
      () => {
        events.push("reset-and-seed");
      },
    );

    expect(events).toEqual([
      "reset-and-seed",
      "transaction",
      "report",
      "section",
      "ownership",
      "remove-viewer-grants",
    ]);
    expect(result.mutation).toMatchObject({
      before: [{ viewerUserId: "viewer" }],
      removed: 1,
      after: [],
    });
  });
});
