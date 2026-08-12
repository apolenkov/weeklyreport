import type { Page } from "@playwright/test";

import type { EvidencePhase } from "../../evidence/evidence-types.ts";
import type { MatrixExecutableCase } from "../../matrix/matrix-finalizer.ts";
import {
  RUNTIME_MATRIX_ORACLE,
  type RuntimeMatrixSource,
} from "../../matrix/runtime-matrix.ts";
import type { RuntimeEventCursor } from "../../matrix/runtime-matrix-evidence.ts";
import type { DOMControl } from "../../source/contracts.ts";
import type { ResolverOutcomeExpectation } from "../../support/resolver-outcome-expectations.ts";
import type { PreparedRuntimeState } from "../../support/state-preparation.ts";
import type { DomInventory } from "../dom/dom-inventory.ts";
import {
  controlsForCase,
  type FrozenCaseLiveRuntime,
} from "../frozen-case/live/frozen-case-live-actions.ts";
import {
  captureFrozenPhase,
  initialNavigation,
} from "../frozen-case/live/frozen-case-live-capture.ts";
import type { RuntimeEventWindow } from "../frozen-case/live/frozen-case-live-capture-types.ts";
import {
  frozenActionTransitionIssues,
  resolveFrozenActionTransition,
} from "../frozen-case/validation/frozen-action-transition-validation.ts";
import {
  type CompleteFrozenCaseEvidence,
  finalizeFrozenCaseEvidence,
  type FrozenCaseCoverageCell,
} from "./frozen-case-evidence.ts";
import { attachLateRuntimeEvents } from "./frozen-case-live-tail.ts";

type LivePhaseCaptureInput = Readonly<{
  page: Page;
  source: RuntimeMatrixSource;
  matrixCase: MatrixExecutableCase;
  runtime: FrozenCaseLiveRuntime;
  prepared: PreparedRuntimeState;
  route: string;
  landingRoute?: string;
  expectedOutcome?: ResolverOutcomeExpectation;
  responseStatus: number | null;
  initialEvents: RuntimeEventWindow;
}>;

type LivePhaseCapture = Readonly<{
  evidence: Awaited<ReturnType<typeof captureFrozenPhase>>;
  inventory: DomInventory;
  url: string;
  actionTarget: DomInventory["controls"][number] | undefined;
}>;

type CapturedLiveEvidence = Readonly<{
  evidence: CompleteFrozenCaseEvidence;
  before: LivePhaseCapture;
  action: LivePhaseCapture;
  after: LivePhaseCapture;
}>;

const captureLivePhase = (
  input: LivePhaseCaptureInput,
  phase: EvidencePhase,
  eventCursor: RuntimeEventCursor,
): Promise<LivePhaseCapture> => {
  const inventory = Promise.withResolvers<DomInventory>();
  const actionTarget = Promise.withResolvers<
    DomInventory["controls"][number] | undefined
  >();
  return captureFrozenPhase({
    page: input.page,
    source: input.source,
    matrixCase: input.matrixCase,
    runtime: input.runtime,
    prepared: input.prepared,
    route: input.route,
    ...(input.landingRoute === undefined
      ? {}
      : { landingRoute: input.landingRoute }),
    ...(input.expectedOutcome === undefined
      ? {}
      : { expectedOutcome: input.expectedOutcome }),
    responseStatus: input.responseStatus,
    initialEvents: input.initialEvents,
    phase,
    eventCursor,
    onInventory: inventory.resolve,
    ...(phase === "action" ? { onActionTarget: actionTarget.resolve } : {}),
  }).then(async (evidence) => ({
    evidence,
    inventory: await inventory.promise,
    url: input.page.url(),
    actionTarget: phase === "action" ? await actionTarget.promise : undefined,
  }));
};

const actionResultFor = (
  evidence: CompleteFrozenCaseEvidence,
): DOMControl["actionResult"] => {
  const actionRef = evidence.action.action.find(
    ({ kind }) => kind === "control-action",
  );
  if (actionRef === undefined)
    return {
      kind: "not-exercised",
      policy: "inapplicable",
      reason: "Frozen case has no bounded control action",
    };
  const functional = evidence.action.observations.find(
    ({ observationId }) => observationId === "functional",
  );
  return {
    kind: "exercised",
    result: functional?.outcome === "pass" ? "pass" : "fail",
    evidenceIds: [actionRef.artifactId],
  };
};

const controlsForLiveCase = (
  source: RuntimeMatrixSource,
  matrixCase: MatrixExecutableCase,
  prepared: PreparedRuntimeState,
  actionCapture: LivePhaseCapture,
  evidence: CompleteFrozenCaseEvidence,
): readonly DOMControl[] => {
  const controls = controlsForCase(
    actionCapture.inventory,
    matrixCase,
    actionResultFor(evidence),
    prepared.plan.surface,
    actionCapture.actionTarget,
  );
  const transition = resolveFrozenActionTransition(source, matrixCase);
  if (transition === undefined) return controls;
  const frozenKeys = new Set(
    transition.after.controls.map(({ controlKey }) => controlKey),
  );
  return controls.filter(({ controlKey }) => frozenKeys.has(controlKey));
};

const finalizeLiveCase = (
  source: RuntimeMatrixSource,
  matrixCase: MatrixExecutableCase,
  runtime: FrozenCaseLiveRuntime,
  prepared: PreparedRuntimeState,
  captured: CapturedLiveEvidence,
) => {
  const runtimeIssues = frozenActionTransitionIssues({
    source,
    matrixCase,
    before: { inventory: captured.before.inventory, url: captured.before.url },
    after: { inventory: captured.action.inventory, url: captured.action.url },
  });
  return finalizeFrozenCaseEvidence(
    {
      archiveRoot: runtime.archiveRoot,
      matrixCase,
      oracle: RUNTIME_MATRIX_ORACLE,
      surface: prepared.plan.surface,
      controls: controlsForLiveCase(
        source,
        matrixCase,
        prepared,
        captured.action,
        captured.evidence,
      ),
      runtimeIssues,
    },
    captured.evidence,
  );
};

const capturedEvidence = async (
  input: LivePhaseCaptureInput,
  initialCursor: RuntimeEventCursor,
): Promise<CapturedLiveEvidence> => {
  const before = await captureLivePhase(input, "before", initialCursor);
  const action = await captureLivePhase(
    input,
    "action",
    before.evidence.cursor,
  );
  const after = await captureLivePhase(input, "after", action.evidence.cursor);
  await input.initialEvents.collector.waitForIdle();
  const tail = input.initialEvents.collector.consumeSince(
    after.evidence.cursor,
  );
  input.initialEvents.collector.detach();
  return {
    before,
    action,
    after,
    evidence: {
      before: before.evidence.bundle,
      action: action.evidence.bundle,
      after: await attachLateRuntimeEvents({
        matrixCase: input.matrixCase,
        runtime: input.runtime,
        bundle: after.evidence.bundle,
        records: tail.records,
      }),
    },
  };
};

export const captureAndFinalizeFrozenCase = async (
  page: Page,
  source: RuntimeMatrixSource,
  matrixCase: MatrixExecutableCase,
  runtime: FrozenCaseLiveRuntime,
  prepared: PreparedRuntimeState,
  route: Readonly<{
    readonly resolvedRoute: string;
    readonly landingRoute?: string;
    readonly expectedOutcome?: ResolverOutcomeExpectation;
  }>,
  navigation: Awaited<ReturnType<typeof initialNavigation>>,
): Promise<FrozenCaseCoverageCell> => {
  try {
    const captured = await capturedEvidence(
      {
        page,
        source,
        matrixCase,
        runtime,
        prepared,
        route: route.resolvedRoute,
        ...(route.landingRoute === undefined
          ? {}
          : { landingRoute: route.landingRoute }),
        ...(route.expectedOutcome === undefined
          ? {}
          : { expectedOutcome: route.expectedOutcome }),
        responseStatus: navigation.responseStatus,
        initialEvents: navigation.events,
      },
      navigation.events.cursor,
    );
    const result = await finalizeLiveCase(
      source,
      matrixCase,
      runtime,
      prepared,
      captured,
    );
    return result.cell;
  } finally {
    navigation.events.collector.detach();
  }
};
