import type { FunctionalAssertion } from "../../evidence/evidence-types.ts";
import {
  captureFrozenCasePhases,
  type FrozenCaseReplayResult,
} from "../../replay/frozen-case-evidence.ts";
import type { EvidenceRef } from "../../source/contracts.ts";
import type { EvidenceBundle } from "../../source/contracts.ts";
import {
  assertOutcomeUi,
  assertPreparedEmptyResolverState,
  assertResolverCase,
  capturePhase,
  controlsFor,
  loginViewer,
  navigationFor,
  type PreparedEmptyState,
  prepareEmptyState,
  resolverArtifact,
  type ResolverCaseRunInput,
  responseFor,
  sentinelsFor,
  VIEWER_STATUS_OPERATION,
  viewerAccessFor,
  waitForResolverResponse,
} from "./resolver-runner-support.ts";

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
      assertionId: "viewer-status-empty-before",
      expected: { outcome: "empty", reportId: null },
      actual: { outcome: "empty", reportId: navigation.resolver.reportId },
      message: "The resolver starts from the exact no-report oracle",
    },
  });

const waitForEmptyStatus = (input: ResolverCaseRunInput): Promise<void> =>
  input.page
    .getByText("There is no report to show yet.", { exact: true })
    .waitFor();

type EmptyResolverAction = Readonly<{
  readonly responseStatus: number;
  readonly actionRefs: readonly EvidenceRef[];
  readonly functionalAssertion: FunctionalAssertion;
}>;

const performEmptyResolverRequest = async (
  input: ResolverCaseRunInput,
  prepared: PreparedEmptyState,
): Promise<EmptyResolverAction> => {
  const requestSentinelBefore = await sentinelsFor();
  const requestAccessBefore = await viewerAccessFor();
  if (requestAccessBefore.length > 0)
    throw new Error("Empty resolver request started with viewer access");
  const responsePromise = waitForResolverResponse(input.page);
  await input.page.reload();
  const response = await responsePromise;
  const resolver = await responseFor(response);
  if (resolver.reportId !== null)
    throw new Error("Empty resolver retry returned a report id");
  const requestSentinelAfter = await sentinelsFor();
  const requestAccessAfter = await viewerAccessFor();
  if (requestAccessAfter.length > 0)
    throw new Error(
      "Empty resolver request restored viewer access unexpectedly",
    );
  const resolverNonMutation =
    JSON.stringify(requestSentinelBefore) ===
    JSON.stringify(requestSentinelAfter);
  if (!resolverNonMutation)
    throw new Error("Empty resolver request changed mutation sentinels");
  await waitForEmptyStatus(input);
  await assertOutcomeUi(input, "empty");
  const oracleRef = await resolverArtifact(
    input,
    "action",
    "resolver-empty-oracle.json",
    "db",
    "function",
    {
      declarationId: input.matrixCase.declarationId,
      operation: VIEWER_STATUS_OPERATION,
      resolver,
      viewerUserId: prepared.mutation.viewerUserId,
      viewerAccessBefore: prepared.mutation.viewerAccessBefore,
      viewerAccessAfter: prepared.mutation.viewerAccessAfter,
      removedCount: prepared.mutation.removedCount,
      exactNoReport: true,
      permissionAllowed: prepared.actual.permission.allowed,
      mutationSentinelBefore: prepared.mutation.mutationSentinelBefore,
      mutationSentinelAfter: prepared.mutation.mutationSentinelAfter,
      resolverMutationSentinelBefore: requestSentinelBefore,
      resolverMutationSentinelAfter: requestSentinelAfter,
      resolverNonMutation,
      resolverViewerAccessBefore: requestAccessBefore,
      resolverViewerAccessAfter: requestAccessAfter,
    },
  );
  return {
    responseStatus: response.status(),
    actionRefs: [oracleRef],
    functionalAssertion: {
      assertionId: "viewer-status-empty-action",
      expected: { outcome: "empty", reportId: null },
      actual: { outcome: "empty", reportId: resolver.reportId },
      message:
        "The exact no-report resolver oracle is visible in the empty state",
    },
  };
};

const actionPhase = async (
  input: ResolverCaseRunInput,
  prepared: PreparedEmptyState,
): Promise<EvidenceBundle> =>
  capturePhase({
    page: input.page,
    archiveRoot: input.archiveRoot,
    bugsinkDsn: input.bugsinkDsn,
    matrixCase: input.matrixCase,
    phase: "action",
    capturedAt: input.capturedAt,
    responseStatus: null,
    functionalAssertion: {
      assertionId: "viewer-status-empty-action",
      expected: { operation: VIEWER_STATUS_OPERATION, reportId: null },
      actual: { operation: VIEWER_STATUS_OPERATION, reportId: null },
      message:
        "Resolver returned no report after every viewer grant was removed",
    },
    perform: () => performEmptyResolverRequest(input, prepared),
  });

const afterPhase = (input: ResolverCaseRunInput): Promise<EvidenceBundle> =>
  (async () => {
    if (input.cleanupCanonical === undefined)
      throw new Error("Empty resolver cleanup callback is not bound");
    const cleanupRef = await input.cleanupCanonical();
    return capturePhase({
      page: input.page,
      archiveRoot: input.archiveRoot,
      bugsinkDsn: input.bugsinkDsn,
      matrixCase: input.matrixCase,
      phase: "after",
      capturedAt: input.capturedAt,
      responseStatus: 200,
      functionalAssertion: {
        assertionId: "viewer-status-empty-after",
        expected: { cleanup: "canonical profile reseed completed" },
        actual: { cleanup: "canonical profile reseed completed" },
        message: "Canonical reseed restores the disposable resolver state",
      },
      perform: () =>
        Promise.resolve({ responseStatus: 200, actionRefs: [cleanupRef] }),
    });
  })();

export async function runEmptyResolverCase(
  input: ResolverCaseRunInput,
): Promise<FrozenCaseReplayResult> {
  assertResolverCase(input);
  const prepared = await prepareEmptyState(input);
  assertPreparedEmptyResolverState(prepared);
  await loginViewer(input);
  const navigation = await navigationFor(input);
  if (navigation.resolver.reportId !== null)
    throw new Error("Empty resolver returned a report id");
  await waitForEmptyStatus(input);
  await assertOutcomeUi(input, "empty");
  const controls = await controlsFor(input);
  return captureFrozenCasePhases({
    archiveRoot: input.archiveRoot,
    matrixCase: input.matrixCase,
    oracle: input.oracle,
    controls,
    capturePhase: (phase) => {
      if (phase === "before") return beforePhase(input, navigation);
      if (phase === "action") return actionPhase(input, prepared);
      return afterPhase(input);
    },
  });
}
