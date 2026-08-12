import type { Page, Response, TestInfo } from "@playwright/test";

import { VIEWER_USER_ID } from "../../../../prisma/seeds/support/seed-constants.ts";
import { reseedE2eDatabase } from "../../../helpers/e2e-database-setup.ts";
import { prisma } from "../../../integration/helpers/db.ts";
import { loginByCookie } from "../../../sweep/helpers/dev-auth.ts";
import type { MatrixExecutableCase } from "../../matrix/matrix-finalizer.ts";
import { controlEvidence } from "../../matrix/runtime-matrix-evidence.ts";
import {
  assertSpecializedCaseBinding,
  captureSpecializedPagePhase,
  initialSpecializedNavigation,
  type SpecializedRuntimeEventWindow,
} from "../../matrix/specialized-case-emission.ts";
import { assertResolverOutcomeUi } from "../../preflight/preflight-reveal-guards.ts";
import { createPrismaRuntimeStateDatabase } from "../../preflight/prisma-state-database.ts";
import { inventoryDom } from "../../replay/dom-inventory.ts";
import { writeFrozenCaseArtifact } from "../../replay/frozen-case-artifacts.ts";
import type { EvidenceRef } from "../../source/contracts.ts";
import type { Oracle } from "../../source/contracts.ts";
import { resolverExpectedUiFor } from "../../support/resolver-outcome-expectations.ts";
import {
  type PreparedRuntimeState,
  prepareRuntimeStateWithMutation,
  type RuntimeMutationSentinel,
  type StatePreparationRequest,
  type ViewerGroupAccessGrant,
} from "../../support/state-preparation.ts";
import { REPORTS_LATEST } from "./resolver-navigation.ts";
import {
  VIEWER_STATUS_OPERATION,
  VIEWER_STATUS_PATH,
} from "./resolver-query-fault.ts";

export const CLEANUP_MESSAGE = "canonical profile reseed completed" as const;

export interface ResolverCaseRunInput {
  readonly page: Page;
  readonly archiveRoot: string;
  readonly bugsinkDsn: string;
  readonly matrixCase: MatrixExecutableCase;
  readonly oracle: Oracle;
  readonly testInfo: TestInfo;
  readonly capturedAt: string;
  readonly databaseUrl: string;
  readonly repoRoot: string;
  readonly cleanupCanonical?: () => Promise<EvidenceRef>;
}

export type ResolverOutcome = Readonly<{ readonly reportId: string | null }>;
type EmptyMutation = Readonly<{
  readonly viewerUserId: string;
  readonly viewerAccessBefore: readonly ViewerGroupAccessGrant[];
  readonly viewerAccessAfter: readonly ViewerGroupAccessGrant[];
  readonly removedCount: number;
  readonly mutationSentinelBefore: RuntimeMutationSentinel;
  readonly mutationSentinelAfter: RuntimeMutationSentinel;
}>;
export type PreparedEmptyState = PreparedRuntimeState &
  Readonly<{ readonly mutation: EmptyMutation }>;

type ResolverPayload = Readonly<{ readonly reportId: string | null }>;

const isResolverPayload = (value: unknown): value is ResolverPayload => {
  if (
    value === null ||
    typeof value !== "object" ||
    !Object.hasOwn(value, "reportId")
  )
    return false;
  const reportId = (value as { readonly reportId?: unknown }).reportId;
  return typeof reportId === "string" || reportId === null;
};

const resolverDataFor = (value: unknown): unknown => {
  if (value === null || typeof value !== "object") return value;
  if (!Object.hasOwn(value, "json")) return value;
  return (value as { readonly json?: unknown }).json;
};

const requestFor = (
  databaseUrl: string,
  repoRoot: string,
): StatePreparationRequest => ({
  profile: "demo",
  axes: {
    lifecycle: "open",
    submission: "draft",
    ownership: "single",
    permission: "allowed",
  },
  databaseUrl,
  repoRoot,
  routeTarget: "active",
  routeRole: "viewer",
  routeKey: "viewer:/reports/latest",
});

export async function responseFor(
  response: Response,
): Promise<ResolverOutcome> {
  if (!response.ok())
    throw new Error(
      `Resolver response unexpectedly failed with HTTP ${response.status()}`,
    );
  const payload: unknown = await response.json();
  const entry = (Array.isArray(payload) ? payload[0] : payload) as
    { readonly result?: { readonly data?: unknown } } | undefined;
  const rawData = entry?.result?.data;
  const data = resolverDataFor(rawData);
  if (!isResolverPayload(data))
    throw new Error("Resolver response has no exact reportId oracle");
  return { reportId: data.reportId };
}

export const waitForResolverResponse = (page: Page): Promise<Response> =>
  page.waitForResponse((response) => {
    const request = response.request();
    return (
      new URL(response.url()).pathname === VIEWER_STATUS_PATH &&
      request.method() === "GET"
    );
  });

export const assertOutcomeUi = async (
  input: ResolverCaseRunInput,
  outcome: "empty" | "query-error" | "visible-current",
): Promise<void> => {
  const expected = input.matrixCase.expectedOutcome;
  if (expected === undefined)
    throw new Error(
      `Resolver case ${input.matrixCase.caseId} lacks an expected outcome`,
    );
  const adjusted =
    expected.identity.outcome === outcome
      ? expected
      : {
          ...expected,
          identity: { ...expected.identity, outcome },
          expectedUi: resolverExpectedUiFor(outcome),
        };
  assertResolverOutcomeUi(adjusted, await inventoryDom(input.page));
};

export const navigationFor = async (
  input: ResolverCaseRunInput,
): Promise<
  Readonly<{
    readonly responseStatus: number | null;
    readonly events: SpecializedRuntimeEventWindow;
    readonly resolver: ResolverOutcome;
  }>
> => {
  const responsePromise = waitForResolverResponse(input.page);
  const navigation = await initialSpecializedNavigation(
    input.page,
    REPORTS_LATEST,
  );
  return {
    ...navigation,
    resolver: await responseFor(await responsePromise),
  };
};

export const resolverArtifact = (
  input: ResolverCaseRunInput,
  phase: "before" | "action" | "after",
  fileName: string,
  kind: "control-action" | "db",
  dimension: "function" | "runtime",
  value: unknown,
): Promise<EvidenceRef> =>
  writeFrozenCaseArtifact({
    archiveRoot: input.archiveRoot,
    sourceSha: input.matrixCase.sourceSha,
    profile: input.matrixCase.profile,
    role: input.matrixCase.role,
    catalogRoute: input.matrixCase.catalogRoute,
    resolvedRoute: input.matrixCase.resolvedRoute,
    cellId: input.matrixCase.caseId,
    phase,
    fileName,
    kind,
    dimension,
    capturedAt: input.capturedAt,
    value,
  });

export const controlsFor = async (
  input: ResolverCaseRunInput,
): Promise<ReturnType<typeof controlEvidence>> =>
  controlEvidence(await inventoryDom(input.page), input.matrixCase.caseId);

export const prepareEmptyState = async (
  input: ResolverCaseRunInput,
): Promise<PreparedEmptyState> =>
  prepareRuntimeStateWithMutation(
    requestFor(input.databaseUrl, input.repoRoot),
    createPrismaRuntimeStateDatabase(prisma),
    async ({ transaction }) => {
      const viewerAccessBefore =
        await transaction.readViewerGroupAccess(VIEWER_USER_ID);
      if (viewerAccessBefore.length === 0)
        throw new Error("Seeded viewer has no access grants to remove");
      const mutationSentinelBefore = await transaction.readMutationSentinel();
      const removedCount =
        await transaction.removeViewerGroupAccess(VIEWER_USER_ID);
      const viewerAccessAfter =
        await transaction.readViewerGroupAccess(VIEWER_USER_ID);
      const mutationSentinelAfter = await transaction.readMutationSentinel();
      if (viewerAccessAfter.length > 0)
        throw new Error(
          "Empty resolver preparation left a viewer access grant",
        );
      if (removedCount !== viewerAccessBefore.length)
        throw new Error(
          `Empty resolver preparation removed ${removedCount} of ${viewerAccessBefore.length} viewer grants`,
        );
      return {
        viewerUserId: VIEWER_USER_ID,
        viewerAccessBefore,
        viewerAccessAfter,
        removedCount,
        mutationSentinelBefore,
        mutationSentinelAfter,
      };
    },
  );

export const sentinelsFor = (): Promise<RuntimeMutationSentinel> =>
  createPrismaRuntimeStateDatabase(prisma).transaction((transaction) =>
    transaction.readMutationSentinel(),
  );

export const viewerAccessFor = (): Promise<readonly ViewerGroupAccessGrant[]> =>
  createPrismaRuntimeStateDatabase(prisma).transaction((transaction) =>
    transaction.readViewerGroupAccess(VIEWER_USER_ID),
  );

export const loginViewer = (input: ResolverCaseRunInput): Promise<void> =>
  loginByCookie(input.page, { role: "viewer", expectRole: "viewer" });

export const reseedCanonical = (input: ResolverCaseRunInput): Promise<void> => {
  reseedE2eDatabase({
    databaseUrl: input.databaseUrl,
    profile: input.matrixCase.profile,
    repoRoot: input.repoRoot,
  });
  return Promise.resolve();
};

export const assertResolverCase = (
  input: ResolverCaseRunInput,
  expectedFaultId?: string,
): void =>
  assertSpecializedCaseBinding(
    input.matrixCase,
    expectedFaultId === undefined
      ? undefined
      : { kind: "fault", faultId: expectedFaultId },
  );

export const capturePhase = captureSpecializedPagePhase;
export { VIEWER_STATUS_OPERATION };
export {
  assertPreparedEmptyResolverState,
  assertPreparedResolverState,
  assertResolverRecovery,
  assertResolverReportId,
} from "./resolver-runner-guards.ts";
