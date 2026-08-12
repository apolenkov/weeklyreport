import { describe, expect, it, vi } from "vitest";

import {
  ACTIVE_REPORT_ID,
  PUBLISHED_REPORT_ID,
  VIEWER_USER_ID,
} from "../../../../prisma/seeds/support/seed-constants.ts";
import {
  buildRuntimeDomainOracle,
  observeRuntimeDatabase,
  type RuntimeDatabaseSnapshot,
} from "../../support/state-oracle.ts";
import {
  assertPreparedEmptyResolverState,
  assertPreparedResolverState,
  assertResolverRecovery,
  assertResolverReportId,
} from "./resolver-runner-guards.ts";

const TARGET_GROUP_ID = "group-empty-target";
const VIEWER_GRANT = {
  id: "viewer-grant-1",
  viewerUserId: VIEWER_USER_ID,
  groupId: TARGET_GROUP_ID,
  canReview: true,
} as const;
const MUTATION_LOG_ENTRY = {
  id: "audit-1",
  userId: VIEWER_USER_ID,
  role: "viewer" as const,
  procedure: "reports.latestForViewer",
  targetId: ACTIVE_REPORT_ID,
  status: "success" as const,
  reason: null,
  ip: "127.0.0.1",
  correlationId: "correlation-1",
  durationMs: 1,
  createdAt: "2026-08-12T12:00:00.000Z",
} as const;

const emptyOracle = buildRuntimeDomainOracle({
  lifecycle: "open",
  submission: "draft",
  ownership: "single",
  permission: "allowed",
});

const emptyActual = (): RuntimeDatabaseSnapshot => ({
  report: {
    status: "draft",
    periodState: "open",
    periodStatus: "open",
    archived: false,
  },
  section: { status: "draft", submittedAt: "absent", verdict: "none" },
  ownership: { targetOwnerId: "lead-1", owners: ["lead-1"] },
  permission: {
    actorId: VIEWER_USER_ID,
    actorRole: "viewer",
    authenticated: true,
    allowed: false,
    ownsTarget: false,
  },
});

const preparedEmptyState = () => {
  const actual = emptyActual();
  return {
    plan: {
      routeRole: "viewer",
      permission: {
        boundary: "allowed" as const,
        actorId: VIEWER_USER_ID,
        groupId: TARGET_GROUP_ID,
      },
      oracle: emptyOracle,
    },
    actual,
    observation: observeRuntimeDatabase(emptyOracle, actual),
    mutationSentinel: [],
    mutation: {
      viewerUserId: VIEWER_USER_ID,
      viewerAccessBefore: [VIEWER_GRANT],
      viewerAccessAfter: [],
      removedCount: 1,
      mutationSentinelBefore: [],
      mutationSentinelAfter: [],
    },
  } as const;
};

const recoveryExpectation = {
  identity: {
    resolverKey: "viewer-status" as const,
    outcome: "visible-current" as const,
    profile: "demo" as const,
    stateId: "viewer-status-query-error",
    stateDigest: "a".repeat(64),
    sourceDigest: "b".repeat(64),
  },
  expectedTarget: `/reports/${ACTIVE_REPORT_ID}?source=status&recovery=0`,
  expectedUi: "report-detail:Status Report",
};

describe("resolver runner guards", () => {
  it("accepts the production-shaped empty state with one explicit permission transition", () => {
    expect(() =>
      assertPreparedEmptyResolverState(preparedEmptyState()),
    ).not.toThrow();
  });

  it("rejects a stale viewer grant and incomplete removal before browser evidence", () => {
    const prepared = preparedEmptyState();
    const navigation = vi.fn();
    const evidence = vi.fn();

    expect(() =>
      assertPreparedEmptyResolverState({
        ...prepared,
        mutation: {
          ...prepared.mutation,
          viewerAccessAfter: [VIEWER_GRANT],
          removedCount: 0,
        },
      }),
    ).toThrow("viewerAccessAfter must be empty");
    expect(navigation).not.toHaveBeenCalled();
    expect(evidence).not.toHaveBeenCalled();
  });

  it("rejects a viewer that still has report permission", () => {
    const prepared = preparedEmptyState();
    const actual = {
      ...prepared.actual,
      permission: { ...prepared.actual.permission, allowed: true },
    };
    expect(() =>
      assertPreparedEmptyResolverState({
        ...prepared,
        actual,
        observation: observeRuntimeDatabase(emptyOracle, actual),
      }),
    ).toThrow("specialized domain mismatch");
  });

  it("rejects a wrong report lifecycle instead of treating it as the empty transition", () => {
    const prepared = preparedEmptyState();
    const actual = {
      ...prepared.actual,
      report: { ...prepared.actual.report, status: "published" as const },
    };
    expect(() =>
      assertPreparedEmptyResolverState({
        ...prepared,
        actual,
        observation: observeRuntimeDatabase(emptyOracle, actual),
      }),
    ).toThrow("specialized domain mismatch");
  });

  it("rejects an incorrect removed count", () => {
    const prepared = preparedEmptyState();
    expect(() =>
      assertPreparedEmptyResolverState({
        ...prepared,
        mutation: { ...prepared.mutation, removedCount: 0 },
      }),
    ).toThrow("removedCount must equal viewerAccessBefore length");
  });

  it("rejects mutation-sentinel drift during grant removal", () => {
    const prepared = preparedEmptyState();
    expect(() =>
      assertPreparedEmptyResolverState({
        ...prepared,
        mutationSentinel: [MUTATION_LOG_ENTRY],
        mutation: {
          ...prepared.mutation,
          mutationSentinelAfter: [MUTATION_LOG_ENTRY],
        },
      }),
    ).toThrow("grant removal changed mutation sentinels");
  });

  it("rejects a prepared empty state mismatch before browser navigation/evidence", () => {
    const navigation = vi.fn();
    const evidence = vi.fn();

    expect(() =>
      assertPreparedResolverState(
        {
          observation: {
            matches: false,
            mismatches: [
              {
                axis: "permission",
                field: "allowed",
                expected: false,
                actual: true,
              },
            ],
          },
        },
        "Empty resolver",
      ),
    ).toThrow(
      'Empty resolver preparation mismatch: [{"axis":"permission","field":"allowed","expected":false,"actual":true}]',
    );
    expect(navigation).not.toHaveBeenCalled();
    expect(evidence).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "published report",
      reportId: PUBLISHED_REPORT_ID,
      url: `/reports/${PUBLISHED_REPORT_ID}?source=status&recovery=0`,
      message: `reportId expected=${ACTIVE_REPORT_ID} actual=${PUBLISHED_REPORT_ID}`,
    },
    {
      name: "wrong query",
      reportId: ACTIVE_REPORT_ID,
      url: `/reports/${ACTIVE_REPORT_ID}?source=status&recovery=1`,
      message: `target expected=/reports/${ACTIVE_REPORT_ID}?source=status&recovery=0 actual=/reports/${ACTIVE_REPORT_ID}?source=status&recovery=1`,
    },
  ])(
    "rejects $name during exact resolver recovery proof",
    ({ reportId, url, message }) => {
      expect(() =>
        assertResolverRecovery(recoveryExpectation, { reportId }, url),
      ).toThrow(message);
    },
  );

  it("accepts only the active report and full normalized landing query", () => {
    expect(
      assertResolverRecovery(
        recoveryExpectation,
        { reportId: ACTIVE_REPORT_ID },
        `https://runtime.example.test/reports/${ACTIVE_REPORT_ID}?source=status&recovery=0`,
      ),
    ).toBe(recoveryExpectation.expectedTarget);
  });

  it("binds the pre-retry report identity without accepting another report", () => {
    expect(
      assertResolverReportId(recoveryExpectation, {
        reportId: ACTIVE_REPORT_ID,
      }),
    ).toBe(ACTIVE_REPORT_ID);
    expect(() =>
      assertResolverReportId(recoveryExpectation, {
        reportId: PUBLISHED_REPORT_ID,
      }),
    ).toThrow(
      `Resolver report mismatch: expected=${ACTIVE_REPORT_ID} actual=${PUBLISHED_REPORT_ID}`,
    );
  });
});
