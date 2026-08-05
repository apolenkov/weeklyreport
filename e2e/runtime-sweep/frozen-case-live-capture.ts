import type { Page } from "@playwright/test";

import { type EvidenceBundle, type EvidenceRef } from "./contracts.ts";
import { inventoryDom } from "./dom-inventory.ts";
import { captureRouteEvidence } from "./evidence-capture.ts";
import {
  beginFrozenActionNavigation,
  type FrozenActionNavigationBoundary,
  settleFrozenActionNavigation,
} from "./frozen-case-action-navigation.ts";
import { writeFrozenCaseArtifact } from "./frozen-case-artifacts.ts";
import {
  actionFor,
  type ActionOutcome,
  type FrozenCaseLiveRuntime,
  runAction,
} from "./frozen-case-live-actions.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";
import { navigate } from "./navigation.ts";
import type { RuntimeMatrixSource } from "./runtime-matrix.ts";
import { eventsFor, type RuntimeEvents } from "./runtime-matrix-evidence.ts";
import type { PreparedRuntimeState } from "./state-preparation.ts";

const HTTP_OK_LIMIT = 400;

export interface FrozenPhaseInput {
  readonly page: Page;
  readonly source: RuntimeMatrixSource;
  readonly matrixCase: MatrixExecutableCase;
  readonly runtime: FrozenCaseLiveRuntime;
  readonly prepared: PreparedRuntimeState;
  readonly route: string;
  readonly responseStatus: number | null;
  readonly phase: "before" | "action" | "after";
  readonly initialEvents: RuntimeEventWindow;
}

type RuntimeEventWindow = Pick<
  RuntimeEvents,
  "consoleMessages" | "pageErrors" | "requestFailures"
>;

export const initialNavigation = async (
  page: Page,
  route: string,
): Promise<
  Readonly<{ responseStatus: number | null; events: RuntimeEventWindow }>
> => {
  const listeners = eventsFor(page);
  try {
    const response = await page.goto(route);
    return {
      responseStatus: response?.status() ?? null,
      events: {
        consoleMessages: [...listeners.consoleMessages],
        pageErrors: [...listeners.pageErrors],
        requestFailures: [...listeners.requestFailures],
      },
    };
  } finally {
    listeners.detach();
  }
};

const databaseRef = async (
  matrixCase: MatrixExecutableCase,
  prepared: PreparedRuntimeState,
  runtime: FrozenCaseLiveRuntime,
): Promise<EvidenceRef | undefined> => {
  const needsDatabase = [
    "recovery",
    "fault",
    "concurrency",
    "infrastructure",
  ].includes(matrixCase.execution.kind);
  if (!needsDatabase) return undefined;
  return writeFrozenCaseArtifact({
    archiveRoot: runtime.archiveRoot,
    sourceSha: matrixCase.sourceSha,
    profile: matrixCase.profile,
    role: matrixCase.role,
    catalogRoute: matrixCase.catalogRoute,
    resolvedRoute: matrixCase.resolvedRoute,
    cellId: matrixCase.caseId,
    phase: "action",
    fileName: "database-oracle.json",
    kind: "db",
    dimension: "runtime",
    capturedAt: new Date().toISOString(),
    value: {
      execution: matrixCase.execution,
      actual: prepared.actual,
      observation: prepared.observation,
    },
  });
};

const actionRef = async (
  matrixCase: MatrixExecutableCase,
  outcome: ActionOutcome | undefined,
  runtime: FrozenCaseLiveRuntime,
): Promise<EvidenceRef | undefined> => {
  const action = actionFor(matrixCase.execution);
  if (action === undefined || action.operation === "navigate") return undefined;
  return writeFrozenCaseArtifact({
    archiveRoot: runtime.archiveRoot,
    sourceSha: matrixCase.sourceSha,
    profile: matrixCase.profile,
    role: matrixCase.role,
    catalogRoute: matrixCase.catalogRoute,
    resolvedRoute: matrixCase.resolvedRoute,
    cellId: matrixCase.caseId,
    phase: "action",
    fileName: "control-actions.json",
    kind: "control-action",
    dimension: "runtime",
    capturedAt: new Date().toISOString(),
    value: { action, outcome },
  });
};

const captureEvidence = async (
  input: FrozenPhaseInput,
  listeners: RuntimeEvents,
  inventory: Awaited<ReturnType<typeof inventoryDom>>,
  phaseStatus: number | null,
  actionSucceeded: boolean,
): Promise<EvidenceBundle> =>
  (
    await captureRouteEvidence({
      page: input.page,
      archiveRoot: input.runtime.archiveRoot,
      sourceSha: input.matrixCase.sourceSha,
      profile: input.matrixCase.profile,
      role: input.matrixCase.role,
      catalogRoute: input.matrixCase.catalogRoute,
      resolvedRoute: input.matrixCase.resolvedRoute,
      cellId: input.matrixCase.caseId,
      inventory,
      consoleMessages: listeners.consoleMessages,
      pageErrors: listeners.pageErrors,
      requestFailures: listeners.requestFailures,
      responseStatus: phaseStatus,
      capturedAt: new Date().toISOString(),
      capturePhase: input.phase,
      functionalAssertion: {
        assertionId: `frozen-${input.matrixCase.caseId}-${input.phase}`,
        expected: { reachable: true, actionSucceeded: true },
        actual: {
          reachable: phaseStatus !== null && phaseStatus < HTTP_OK_LIMIT,
          actionSucceeded,
        },
        message: `Frozen ${input.phase} evidence captured for ${input.matrixCase.caseId}`,
      },
      geometryOracle: {
        viewport: { width: 1440, height: 900 },
        maxHorizontalOverflow: 0,
        requireNoZeroSize: false,
      },
    })
  ).bundle;

const actionOutcomeForPhase = async (
  input: FrozenPhaseInput,
  boundary: FrozenActionNavigationBoundary | undefined,
): Promise<ActionOutcome | undefined> => {
  const outcome =
    input.phase === "action"
      ? await runAction(
          input.page,
          input.source,
          input.matrixCase,
          input.runtime,
        )
      : undefined;
  return boundary === undefined
    ? outcome
    : settleFrozenActionNavigation(input.page, boundary, outcome);
};

const phaseListenersFor = (
  input: FrozenPhaseInput,
  listeners: RuntimeEvents,
): RuntimeEvents =>
  input.phase === "before"
    ? {
        ...listeners,
        consoleMessages: [
          ...input.initialEvents.consoleMessages,
          ...listeners.consoleMessages,
        ],
        pageErrors: [
          ...input.initialEvents.pageErrors,
          ...listeners.pageErrors,
        ],
        requestFailures: [
          ...input.initialEvents.requestFailures,
          ...listeners.requestFailures,
        ],
      }
    : listeners;

export const captureFrozenPhase = async (
  input: FrozenPhaseInput,
): Promise<EvidenceBundle> => {
  const listeners = eventsFor(input.page);
  const action = actionFor(input.matrixCase.execution);
  const navigationBoundary =
    input.phase === "action" &&
    action !== undefined &&
    action.operation !== "navigate"
      ? beginFrozenActionNavigation(input.page, action.controlKey)
      : undefined;
  try {
    const outcome = await actionOutcomeForPhase(input, navigationBoundary);
    const navigationStatus =
      input.phase === "action" && action?.operation === "navigate"
        ? await navigate(input.page, input.route)
        : undefined;
    const inventory = await inventoryDom(input.page);
    const phaseStatus = navigationStatus ?? input.responseStatus;
    const actionSucceeded =
      input.phase !== "action" ||
      action === undefined ||
      action.operation === "navigate" ||
      outcome?.status === "pass" ||
      (input.matrixCase.execution.kind === "fault" &&
        outcome?.status !== "not-exercised");
    const phaseListeners = phaseListenersFor(input, listeners);
    const captured = await captureEvidence(
      input,
      phaseListeners,
      inventory,
      phaseStatus,
      actionSucceeded,
    );
    if (input.phase !== "action") return captured;
    const [controlRef, database] = await Promise.all([
      actionRef(input.matrixCase, outcome, input.runtime),
      databaseRef(input.matrixCase, input.prepared, input.runtime),
    ]);
    return {
      ...captured,
      action: [
        ...captured.action,
        ...(controlRef === undefined ? [] : [controlRef]),
        ...(database === undefined ? [] : [database]),
      ],
    };
  } finally {
    navigationBoundary?.observer.cancel();
    listeners.detach();
  }
};
