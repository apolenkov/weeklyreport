import type { Page } from "@playwright/test";

import { prisma } from "../../../integration/helpers/db.ts";
import { createPrismaRuntimeStateDatabase } from "../../preflight/prisma-state-database.ts";
import { canonicalRevealUrlFor } from "../../preflight/reveal-path.ts";
import {
  captureFrozenCasePhases,
  type FrozenCaseReplayResult,
} from "../../replay/frozen-case-evidence.ts";
import type { EvidenceBundle, EvidenceRef } from "../../source/contracts.ts";
import { resolverRecoveryExpectationFor } from "../../support/resolver-recovery-expectations.ts";
import { prepareRuntimeState } from "../../support/state-preparation.ts";

const QUERY_ERROR_MESSAGE = "Could not load the status report." as const;
const RETRY_CONTROL = "Try again" as const;
const VISIBLE_CURRENT_OUTCOME = "visible-current" as const;
const ACTION_ASSERTION = {
  assertionId: "viewer-status-query-error-action",
  expected: {
    operation: VIEWER_STATUS_OPERATION,
    status: VIEWER_STATUS_FAULT_STATUS,
    message: QUERY_ERROR_MESSAGE,
    retry: RETRY_CONTROL,
  },
  actual: {
    operation: VIEWER_STATUS_OPERATION,
    status: VIEWER_STATUS_FAULT_STATUS,
    message: QUERY_ERROR_MESSAGE,
    retry: RETRY_CONTROL,
  },
  message: "The exact resolver fault renders the error and retry control",
} as const;
import { navigateToResolverRequest } from "./resolver-navigation.ts";
import {
  VIEWER_STATUS_FAULT_ID,
  VIEWER_STATUS_FAULT_STATUS,
  VIEWER_STATUS_PATH,
  withResolverQueryFault,
} from "./resolver-query-fault.ts";
import {
  assertOutcomeUi,
  assertPreparedResolverState,
  assertResolverCase,
  assertResolverRecovery,
  assertResolverReportId,
  capturePhase,
  controlsFor,
  loginViewer,
  navigationFor,
  resolverArtifact,
  type ResolverCaseRunInput,
  responseFor,
  sentinelsFor,
  VIEWER_STATUS_OPERATION,
  waitForResolverResponse,
} from "./resolver-runner-support.ts";

const requestFor = (input: ResolverCaseRunInput) => ({
  profile: "demo" as const,
  axes: {
    lifecycle: "open" as const,
    submission: "draft" as const,
    ownership: "single" as const,
    permission: "allowed" as const,
  },
  databaseUrl: input.databaseUrl,
  repoRoot: input.repoRoot,
  routeTarget: "active" as const,
  routeRole: "viewer" as const,
  routeKey: "viewer:/reports/latest",
});

const recoveryExpectationFor = (input: ResolverCaseRunInput) =>
  resolverRecoveryExpectationFor(
    input.matrixCase.expectedOutcome,
    input.matrixCase.resolverRecoveryOutcome,
  );

const waitForRecoveryUrl = async (page: Page, expectedTarget: string) => {
  await page.waitForURL((url) => {
    try {
      return canonicalRevealUrlFor(url.href) === expectedTarget;
    } catch {
      return false;
    }
  });
};

const beforePhase = (
  input: ResolverCaseRunInput,
  navigation: Awaited<ReturnType<typeof navigationFor>>,
): Promise<EvidenceBundle> =>
  capturePhase({
    page: input.page,
    archiveRoot: input.archiveRoot,
    bugsinkDsn: input.bugsinkDsn,
    matrixCase: input.matrixCase,
    phase: "before",
    capturedAt: input.capturedAt,
    responseStatus: navigation.responseStatus,
    initialEvents: navigation.events,
    functionalAssertion: {
      assertionId: "viewer-status-query-error-before",
      expected: { outcome: VISIBLE_CURRENT_OUTCOME },
      actual: {
        outcome: VISIBLE_CURRENT_OUTCOME,
        reportId: navigation.resolver.reportId,
      },
      message: "The query-error scenario starts from a visible current report",
    },
  });

const performQueryFault = async (
  input: ResolverCaseRunInput,
): Promise<{
  readonly responseStatus: number;
  readonly actionRefs: readonly EvidenceRef[];
}> => {
  const sentinelsBefore = await sentinelsFor();
  const responsePromise = waitForResolverResponse(input.page);
  const faultResult = await withResolverQueryFault(input.page, () =>
    navigateToResolverRequest(input.page, responsePromise),
  );
  const response = faultResult.result;
  if (response.status() !== VIEWER_STATUS_FAULT_STATUS)
    throw new Error(`Resolver fault returned HTTP ${response.status()}`);
  await input.page.getByText(QUERY_ERROR_MESSAGE, { exact: true }).waitFor();
  await input.page
    .getByRole("button", { name: RETRY_CONTROL, exact: true })
    .waitFor();
  await assertOutcomeUi(input, "query-error");
  const sentinelsAfter = await sentinelsFor();
  if (JSON.stringify(sentinelsBefore) !== JSON.stringify(sentinelsAfter))
    throw new Error("Resolver query fault changed mutation sentinels");
  const faultRef = await resolverArtifact(
    input,
    "action",
    "resolver-query-error-fault.json",
    "control-action",
    "runtime",
    {
      declarationId: input.matrixCase.declarationId,
      faultId: VIEWER_STATUS_FAULT_ID,
      operation: VIEWER_STATUS_OPERATION,
      recoveryOutcome: VISIBLE_CURRENT_OUTCOME,
      path: VIEWER_STATUS_PATH,
      method: "GET",
      status: faultResult.fault.status,
      count: faultResult.fault.count,
      exactError: QUERY_ERROR_MESSAGE,
      retryControl: RETRY_CONTROL,
    },
  );
  const oracleRef = await resolverArtifact(
    input,
    "action",
    "resolver-query-error-oracle.json",
    "db",
    "function",
    {
      declarationId: input.matrixCase.declarationId,
      operation: VIEWER_STATUS_OPERATION,
      recoveryOutcome: VISIBLE_CURRENT_OUTCOME,
      mutationSentinelBefore: sentinelsBefore,
      mutationSentinelAfter: sentinelsAfter,
      nonMutation:
        JSON.stringify(sentinelsBefore) === JSON.stringify(sentinelsAfter),
    },
  );
  return {
    responseStatus: response.status(),
    actionRefs: [faultRef, oracleRef],
  };
};

const actionPhase = (input: ResolverCaseRunInput): Promise<EvidenceBundle> =>
  capturePhase({
    page: input.page,
    archiveRoot: input.archiveRoot,
    bugsinkDsn: input.bugsinkDsn,
    matrixCase: input.matrixCase,
    phase: "action",
    capturedAt: input.capturedAt,
    responseStatus: null,
    functionalAssertion: ACTION_ASSERTION,
    perform: () => performQueryFault(input),
  });

const afterPhase = async (
  input: ResolverCaseRunInput,
): Promise<EvidenceBundle> => {
  const recoveryExpectation = recoveryExpectationFor(input);
  const sentinelsBefore = await sentinelsFor();
  const responsePromise = waitForResolverResponse(input.page);
  await input.page.getByRole("button", { name: "Try again" }).click();
  const response = await responsePromise;
  const resolver = await responseFor(response);
  await waitForRecoveryUrl(input.page, recoveryExpectation.expectedTarget);
  const recoveryTarget = assertResolverRecovery(
    recoveryExpectation,
    resolver,
    input.page.url(),
  );
  await assertOutcomeUi(input, "visible-current");
  const sentinelsAfter = await sentinelsFor();
  if (JSON.stringify(sentinelsBefore) !== JSON.stringify(sentinelsAfter))
    throw new Error("Resolver retry changed mutation sentinels");
  const recoveryRef = await resolverArtifact(
    input,
    "after",
    "resolver-query-error-retry.json",
    "db",
    "runtime",
    {
      declarationId: input.matrixCase.declarationId,
      operation: VIEWER_STATUS_OPERATION,
      recoveryOutcome: VISIBLE_CURRENT_OUTCOME,
      recoveryExpectation,
      recoveryTarget,
      resolver,
      mutationSentinelBefore: sentinelsBefore,
      mutationSentinelAfter: sentinelsAfter,
      nonMutation:
        JSON.stringify(sentinelsBefore) === JSON.stringify(sentinelsAfter),
      retry: "successful fault-free retry",
    },
  );
  if (input.cleanupCanonical === undefined)
    throw new Error("Query-error resolver cleanup callback is not bound");
  const cleanupRef = await input.cleanupCanonical();
  return capturePhase({
    page: input.page,
    archiveRoot: input.archiveRoot,
    bugsinkDsn: input.bugsinkDsn,
    matrixCase: input.matrixCase,
    phase: "after",
    capturedAt: input.capturedAt,
    responseStatus: response.status(),
    functionalAssertion: {
      assertionId: "viewer-status-query-error-after",
      expected: {
        outcome: VISIBLE_CURRENT_OUTCOME,
        retry: "successful",
        target: recoveryExpectation.expectedTarget,
      },
      actual: {
        outcome: VISIBLE_CURRENT_OUTCOME,
        reportId: resolver.reportId,
        target: recoveryTarget,
      },
      message: "The resolver succeeds after the bounded fault is removed",
    },
    perform: () => Promise.resolve({ actionRefs: [recoveryRef, cleanupRef] }),
  });
};

export async function runQueryErrorResolverCase(
  input: ResolverCaseRunInput,
): Promise<FrozenCaseReplayResult> {
  assertResolverCase(input, VIEWER_STATUS_FAULT_ID);
  const prepared = await prepareRuntimeState(
    requestFor(input),
    createPrismaRuntimeStateDatabase(prisma),
  );
  assertPreparedResolverState(prepared, "Resolver query-error");
  await loginViewer(input);
  const navigation = await navigationFor(input);
  assertResolverReportId(recoveryExpectationFor(input), navigation.resolver);
  await assertOutcomeUi(input, VISIBLE_CURRENT_OUTCOME);
  const controls = await controlsFor(input);
  return captureFrozenCasePhases({
    archiveRoot: input.archiveRoot,
    matrixCase: input.matrixCase,
    oracle: input.oracle,
    controls,
    capturePhase: (phase) => {
      if (phase === "before") return beforePhase(input, navigation);
      if (phase === "action") return actionPhase(input);
      return afterPhase(input);
    },
  });
}
