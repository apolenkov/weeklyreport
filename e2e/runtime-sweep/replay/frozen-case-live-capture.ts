import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import type { RuntimeEvents } from "../matrix/runtime-matrix-evidence.ts";
import { type EvidenceBundle, type EvidenceRef } from "../source/contracts.ts";
import type { PreparedRuntimeState } from "../support/state-preparation.ts";
import type { ControlActionAttemptOutcome } from "./control-action-types.ts";
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
import type { CapturedPhaseEvidence } from "./frozen-case-live-phase-evidence.ts";
import { captureEvidence } from "./frozen-case-live-phase-evidence.ts";
import { navigate } from "./navigation.ts";
import {
  createFrozenRecoveryBoundary,
  type FrozenRecoveryBoundaryRecorder,
  type FrozenRecoveryEvidenceWindows,
  type FrozenRuntimeEvidenceWindow,
} from "./recovery/frozen-case-recovery-boundary.ts";
import { captureFrozenRecoveryEvidence } from "./recovery/frozen-case-recovery-evidence.ts";

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
  recoveryRecorder: FrozenRecoveryBoundaryRecorder | undefined,
): Promise<ActionOutcome | undefined> => {
  const outcome =
    input.phase === "action"
      ? await runAction(
          input.page,
          input.source,
          input.matrixCase,
          input.runtime,
          input.prepared.plan.surface,
          recoveryRecorder?.boundary,
        )
      : undefined;
  recoveryRecorder?.finalize();
  return boundary === undefined
    ? outcome
    : settleFrozenActionNavigation(input.page, boundary, outcome);
};

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
  if (input.phase !== "action") return;
  const target = outcome?.target;
  if (target !== undefined) input.onActionTarget?.(target);
};

const phaseStartedAtFor = (input: FrozenPhaseInput): string =>
  input.phase === "before"
    ? input.initialEvents.startedAt
    : new Date().toISOString();

const navigationBoundaryFor = (
  input: FrozenPhaseInput,
  action: ReturnType<typeof actionFor>,
): FrozenActionNavigationBoundary | undefined =>
  input.phase === "action" &&
  action !== undefined &&
  action.operation !== "navigate"
    ? beginFrozenActionNavigation(input.page, action.controlKey)
    : undefined;

const navigationStatusFor = async (
  input: FrozenPhaseInput,
  action: ReturnType<typeof actionFor>,
): Promise<number | null | undefined> =>
  input.phase === "action" && action?.operation === "navigate"
    ? navigate(input.page, input.route)
    : undefined;

const withActionEvidence = async (
  input: FrozenPhaseInput,
  captured: EvidenceBundle,
  outcome: ActionOutcome | undefined,
  recoveryWindows: FrozenRecoveryEvidenceWindows | undefined,
): Promise<EvidenceBundle> => {
  if (input.phase !== "action") return captured;
  const [controlRef, database, recovery] = await Promise.all([
    actionRef(input.matrixCase, outcome, input.runtime),
    databaseRef(input.matrixCase, input.prepared, input.runtime),
    recoveryWindows === undefined
      ? Promise.resolve(undefined)
      : captureFrozenRecoveryEvidence(
          input,
          recoveryWindows.recovery,
          recoveryWindows.outcome,
        ),
  ]);
  return {
    ...captured,
    action: [
      ...captured.action,
      ...(controlRef === undefined ? [] : [controlRef]),
      ...(database === undefined ? [] : [database]),
      ...(recovery === undefined ? [] : [recovery.ref]),
    ],
    observations: [
      ...captured.observations,
      ...(recovery === undefined ? [] : [recovery.observation]),
    ],
  };
};

const captureAttemptEvidence = async (
  input: FrozenPhaseInput,
  listeners: RuntimeEvents,
  window: FrozenRuntimeEvidenceWindow,
  outcome: ControlActionAttemptOutcome,
): Promise<CapturedPhaseEvidence> => {
  const inventory = await inventoryDom(input.page);
  input.onInventory?.(inventory);
  const actionSucceeded =
    outcome.status === "pass" || input.matrixCase.execution.kind === "fault";
  return captureEvidence(
    input,
    listeners,
    input.eventCursor,
    inventory,
    input.responseStatus,
    actionSucceeded,
    false,
    undefined,
    window.startedAt,
    { evidence: window, outputCursor: window.cursor },
  );
};

const captureOrdinaryEvidence = async (
  input: FrozenPhaseInput,
  listeners: RuntimeEvents,
  action: ReturnType<typeof actionFor>,
  outcome: ActionOutcome | undefined,
  phaseStartedAt: string,
): Promise<CapturedPhaseEvidence> => {
  const navigationStatus = await navigationStatusFor(input, action);
  const inventory = await inventoryDom(input.page);
  input.onInventory?.(inventory);
  return captureEvidence(
    input,
    listeners,
    input.eventCursor,
    inventory,
    navigationStatus ?? input.responseStatus,
    actionSucceededFor(input, action, outcome),
    unavailableSurfaceExpectedFor(input, outcome),
    outcome?.surfaceObservation,
    phaseStartedAt,
  );
};

export const captureFrozenPhase = async (
  input: FrozenPhaseInput,
): Promise<CapturedPhaseEvidence> => {
  const phaseStartedAt = phaseStartedAtFor(input);
  const listeners = input.initialEvents.collector;
  const action = actionFor(input.matrixCase.execution);
  const navigationBoundary = navigationBoundaryFor(input, action);
  const actionCapture = Promise.withResolvers<CapturedPhaseEvidence>();
  const recoveryRecorder =
    input.phase === "action"
      ? createFrozenRecoveryBoundary(
          listeners,
          input.eventCursor,
          phaseStartedAt,
          async (window, outcome) =>
            actionCapture.resolve(
              await captureAttemptEvidence(input, listeners, window, outcome),
            ),
        )
      : undefined;
  try {
    const outcome = await actionOutcomeForPhase(
      input,
      navigationBoundary,
      recoveryRecorder,
    );
    const recoveryWindows = await recoveryRecorder?.result;
    publishActionTarget(input, outcome);
    const captured =
      recoveryWindows === undefined
        ? await captureOrdinaryEvidence(
            input,
            listeners,
            action,
            outcome,
            phaseStartedAt,
          )
        : await actionCapture.promise;
    return {
      bundle: await withActionEvidence(
        input,
        captured.bundle,
        outcome,
        recoveryWindows,
      ),
      cursor: recoveryWindows?.recovery.cursor ?? captured.cursor,
    };
  } finally {
    navigationBoundary?.observer.cancel();
  }
};
