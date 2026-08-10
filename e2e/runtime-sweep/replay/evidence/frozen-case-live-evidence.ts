import type { Page } from "@playwright/test";

import type { EvidencePhase } from "../../evidence/evidence-types.ts";
import type { MatrixExecutableCase } from "../../matrix/matrix-finalizer.ts";
import {
  RUNTIME_MATRIX_ORACLE,
  type RuntimeMatrixSource,
} from "../../matrix/runtime-matrix.ts";
import type { RuntimeEventCursor } from "../../matrix/runtime-matrix-evidence.ts";
import type { DOMControl } from "../../source/contracts.ts";
import type { PreparedRuntimeState } from "../../support/state-preparation.ts";
import type { DomInventory } from "../dom-inventory.ts";
import {
  type CompleteFrozenCaseEvidence,
  finalizeFrozenCaseEvidence,
  type FrozenCaseCoverageCell,
} from "../frozen-case-evidence.ts";
import {
  controlsForCase,
  type FrozenCaseLiveRuntime,
} from "../frozen-case-live-actions.ts";
import {
  captureFrozenPhase,
  initialNavigation,
} from "../frozen-case-live-capture.ts";
import type { RuntimeEventWindow } from "../frozen-case-live-capture-types.ts";
import { attachLateRuntimeEvents } from "./frozen-case-live-tail.ts";

type LivePhaseCaptureInput = Readonly<{
  page: Page;
  source: RuntimeMatrixSource;
  matrixCase: MatrixExecutableCase;
  runtime: FrozenCaseLiveRuntime;
  prepared: PreparedRuntimeState;
  route: string;
  responseStatus: number | null;
  initialEvents: RuntimeEventWindow;
  phaseInventories: Map<EvidencePhase, DomInventory>;
  actionTargets: Map<EvidencePhase, DomInventory["controls"][number]>;
}>;

const captureLivePhase = (
  input: LivePhaseCaptureInput,
  phase: EvidencePhase,
  eventCursor: RuntimeEventCursor,
) =>
  captureFrozenPhase({
    page: input.page,
    source: input.source,
    matrixCase: input.matrixCase,
    runtime: input.runtime,
    prepared: input.prepared,
    route: input.route,
    responseStatus: input.responseStatus,
    initialEvents: input.initialEvents,
    phase,
    eventCursor,
    onInventory: (inventory) => input.phaseInventories.set(phase, inventory),
    onActionTarget: (target) => input.actionTargets.set("action", target),
  });

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
  matrixCase: MatrixExecutableCase,
  prepared: PreparedRuntimeState,
  phaseInventories: Map<EvidencePhase, DomInventory>,
  actionTargets: Map<EvidencePhase, DomInventory["controls"][number]>,
  evidence: CompleteFrozenCaseEvidence,
): readonly DOMControl[] => {
  const actionInventory = phaseInventories.get("action");
  if (actionInventory === undefined)
    throw new Error(
      `Frozen case ${matrixCase.caseId} has no action-phase inventory`,
    );
  return controlsForCase(
    actionInventory,
    matrixCase,
    actionResultFor(evidence),
    prepared.plan.surface,
    actionTargets.get("action"),
  );
};

const finalizeLiveCase = (
  matrixCase: MatrixExecutableCase,
  runtime: FrozenCaseLiveRuntime,
  prepared: PreparedRuntimeState,
  phaseInventories: Map<EvidencePhase, DomInventory>,
  actionTargets: Map<EvidencePhase, DomInventory["controls"][number]>,
  evidence: CompleteFrozenCaseEvidence,
) =>
  finalizeFrozenCaseEvidence(
    {
      archiveRoot: runtime.archiveRoot,
      matrixCase,
      oracle: RUNTIME_MATRIX_ORACLE,
      surface: prepared.plan.surface,
      controls: controlsForLiveCase(
        matrixCase,
        prepared,
        phaseInventories,
        actionTargets,
        evidence,
      ),
    },
    evidence,
  );

const capturedEvidence = async (
  input: LivePhaseCaptureInput,
  initialCursor: RuntimeEventCursor,
): Promise<CompleteFrozenCaseEvidence> => {
  const before = await captureLivePhase(input, "before", initialCursor);
  const action = await captureLivePhase(input, "action", before.cursor);
  const after = await captureLivePhase(input, "after", action.cursor);
  await input.initialEvents.collector.waitForIdle();
  const tail = input.initialEvents.collector.consumeSince(after.cursor);
  input.initialEvents.collector.detach();
  return {
    before: before.bundle,
    action: action.bundle,
    after: await attachLateRuntimeEvents({
      matrixCase: input.matrixCase,
      runtime: input.runtime,
      bundle: after.bundle,
      records: tail.records,
    }),
  };
};

export const captureAndFinalizeFrozenCase = async (
  page: Page,
  source: RuntimeMatrixSource,
  matrixCase: MatrixExecutableCase,
  runtime: FrozenCaseLiveRuntime,
  prepared: PreparedRuntimeState,
  route: string,
  navigation: Awaited<ReturnType<typeof initialNavigation>>,
): Promise<FrozenCaseCoverageCell> => {
  const phaseInventories = new Map<EvidencePhase, DomInventory>();
  const actionTargets = new Map<
    EvidencePhase,
    DomInventory["controls"][number]
  >();
  try {
    const evidence = await capturedEvidence(
      {
        page,
        source,
        matrixCase,
        runtime,
        prepared,
        route,
        responseStatus: navigation.responseStatus,
        initialEvents: navigation.events,
        phaseInventories,
        actionTargets,
      },
      navigation.events.cursor,
    );
    const result = await finalizeLiveCase(
      matrixCase,
      runtime,
      prepared,
      phaseInventories,
      actionTargets,
      evidence,
    );
    return result.cell;
  } finally {
    navigation.events.collector.detach();
  }
};
