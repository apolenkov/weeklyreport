import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import {
  eventsFor,
  type RuntimeEvents,
} from "../matrix/runtime-matrix-evidence.ts";
import { type EvidenceBundle, type EvidenceRef } from "../source/contracts.ts";
import type { PreparedRuntimeState } from "../support/state-preparation.ts";
import { inventoryDom } from "./dom-inventory.ts";
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
import type { FrozenPhaseInput } from "./frozen-case-live-capture-types.ts";
import { captureEvidence } from "./frozen-case-live-phase-evidence.ts";
import { navigate } from "./navigation.ts";

const INAPPLICABLE_ACTIONS = "inapplicable" as const;
const NOT_EXERCISED_ACTION = "not-exercised" as const;

export type { FrozenPhaseInput } from "./frozen-case-live-capture-types.ts";
export { initialNavigation } from "./frozen-case-live-navigation.ts";

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
    value: { action, target: outcome?.target ?? null, outcome },
  });
};

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
          input.prepared.plan.surface,
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

const actionSucceededFor = (
  input: FrozenPhaseInput,
  action: ReturnType<typeof actionFor>,
  outcome: ActionOutcome | undefined,
): boolean =>
  input.phase !== "action" ||
  action === undefined ||
  action.operation === "navigate" ||
  outcome?.status === "pass" ||
  (input.matrixCase.execution.kind === "fault" &&
    outcome?.status !== NOT_EXERCISED_ACTION);

const unavailableSurfaceExpectedFor = (
  input: FrozenPhaseInput,
  outcome: ActionOutcome | undefined,
): boolean =>
  input.phase === "action" &&
  input.prepared.plan.surface.productActions === INAPPLICABLE_ACTIONS &&
  outcome?.status === NOT_EXERCISED_ACTION;

const publishActionTarget = (
  input: FrozenPhaseInput,
  outcome: ActionOutcome | undefined,
): void => {
  if (input.phase !== "action" || outcome?.status !== "pass") return;
  const target = outcome.target;
  if (target !== undefined) input.onActionTarget?.(target);
};

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
    publishActionTarget(input, outcome);
    const navigationStatus =
      input.phase === "action" && action?.operation === "navigate"
        ? await navigate(input.page, input.route)
        : undefined;
    const inventory = await inventoryDom(input.page);
    input.onInventory?.(inventory);
    const phaseStatus = navigationStatus ?? input.responseStatus;
    const actionSucceeded = actionSucceededFor(input, action, outcome);
    const unavailableSurfaceExpected = unavailableSurfaceExpectedFor(
      input,
      outcome,
    );
    const phaseListeners = phaseListenersFor(input, listeners);
    const captured = await captureEvidence(
      input,
      phaseListeners,
      inventory,
      phaseStatus,
      actionSucceeded,
      unavailableSurfaceExpected,
      outcome?.surfaceObservation,
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
