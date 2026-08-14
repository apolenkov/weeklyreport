import { afterEach, describe, expect, it, vi } from "vitest";

import { VIEWER_USER_ID } from "../../../../prisma/seeds/support/seed-constants.ts";
import {
  buildStatePreparationPlan,
  prepareRuntimeStateWithMutation,
  type RuntimeStateTransaction,
} from "../../support/state-preparation.ts";
import { assertPreparedEmptyResolverState } from "./resolver-runner-guards.ts";

const request = {
  profile: "demo" as const,
  axes: {
    lifecycle: "open" as const,
    submission: "draft" as const,
    ownership: "single" as const,
    permission: "allowed" as const,
  },
  databaseUrl: "postgresql://localhost/customreport_e2e",
  repoRoot: "/workspace/customreport",
  routeRole: "viewer" as const,
  routeTarget: "active" as const,
  routeKey: "viewer:/reports/latest",
};

const prepareEmptyThroughProductionPath = async () => {
  const plan = buildStatePreparationPlan(request);
  let grants = [
    {
      id: "viewer-grant-1",
      viewerUserId: VIEWER_USER_ID,
      groupId: plan.permission.groupId,
      canReview: true,
    },
  ];
  const transaction: RuntimeStateTransaction = {
    updateReport: () => Promise.resolve(),
    updateSection: () => Promise.resolve(),
    replaceOwnership: () => Promise.resolve(),
    readSnapshot: () =>
      Promise.resolve({
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
          assignments: plan.ownership.assignments.map(
            ({ stageId, userId }) => ({
              id: `assignment-${stageId}`,
              stageId,
              userId,
            }),
          ),
        },
        permission: {
          actorId: VIEWER_USER_ID,
          actorRole: "viewer",
          authenticated: true,
          allowed: grants.some(
            ({ groupId }) => groupId === plan.permission.groupId,
          ),
          ownsTarget: false,
        },
      }),
    readMutationSentinel: () => Promise.resolve([]),
    readViewerGroupAccess: () => Promise.resolve(grants),
    removeViewerGroupAccess: () => {
      const count = grants.length;
      grants = [];
      return Promise.resolve(count);
    },
  };
  return prepareRuntimeStateWithMutation(
    request,
    { transaction: (work) => work(transaction) },
    async ({ transaction: scoped }) => {
      const viewerAccessBefore =
        await scoped.readViewerGroupAccess(VIEWER_USER_ID);
      const mutationSentinelBefore = await scoped.readMutationSentinel();
      const removedCount = await scoped.removeViewerGroupAccess(VIEWER_USER_ID);
      const viewerAccessAfter =
        await scoped.readViewerGroupAccess(VIEWER_USER_ID);
      const mutationSentinelAfter = await scoped.readMutationSentinel();
      return {
        viewerUserId: VIEWER_USER_ID,
        viewerAccessBefore,
        viewerAccessAfter,
        removedCount,
        mutationSentinelBefore,
        mutationSentinelAfter,
      };
    },
    () => undefined,
  );
};

afterEach(() => vi.unstubAllEnvs());

describe("empty resolver production preparation", () => {
  it("accepts exactly one specialized permission transition", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/customreport_dev");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");
    const prepared = await prepareEmptyThroughProductionPath();

    expect(prepared.observation).toMatchObject({
      matches: false,
      mismatches: [
        {
          axis: "permission",
          field: "allowed",
          expected: true,
          actual: false,
        },
      ],
    });
    expect(() => assertPreparedEmptyResolverState(prepared)).not.toThrow();
  });
});
