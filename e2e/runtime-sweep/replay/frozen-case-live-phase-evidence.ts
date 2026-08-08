import { captureRouteEvidence } from "../evidence/evidence-capture.ts";
import { expectedFaultFor } from "../evidence/expected-fault.ts";
import type {
  RuntimeEventCursor,
  RuntimeEvents,
} from "../matrix/runtime-matrix-evidence.ts";
import type { RuntimeSurfaceObservation } from "../preflight/runtime-surface-expectation.ts";
import { EXPECTED_LEAD_FORM_UNAVAILABLE_SURFACE } from "../preflight/runtime-surface-expectation.ts";
import { type EvidenceBundle } from "../source/contracts.ts";
import type { DomInventory } from "./dom-inventory.ts";
import type { FrozenPhaseInput } from "./frozen-case-live-capture-types.ts";
import type { FrozenRuntimeEvidenceWindow } from "./recovery/frozen-case-recovery-boundary.ts";

const HTTP_OK_LIMIT = 400;

export type CapturedPhaseEvidence = Readonly<{
  readonly bundle: EvidenceBundle;
  readonly cursor: RuntimeEventCursor;
}>;

export type FrozenPhaseEventBoundary = Readonly<{
  readonly evidence: FrozenRuntimeEvidenceWindow;
  readonly outputCursor: RuntimeEventCursor;
}>;

const eventsForCapture = async (
  listeners: RuntimeEvents,
  eventCursor: RuntimeEventCursor,
  boundary: FrozenPhaseEventBoundary | undefined,
) => {
  if (boundary !== undefined) return boundary.evidence;
  await listeners.waitForIdle();
  return listeners.consumeSince(eventCursor);
};

export const captureEvidence = async (
  input: FrozenPhaseInput,
  listeners: RuntimeEvents,
  eventCursor: RuntimeEventCursor,
  inventory: DomInventory,
  phaseStatus: number | null,
  actionSucceeded: boolean,
  unavailableSurfaceExpected: boolean,
  surfaceObservation: RuntimeSurfaceObservation | undefined,
  phaseStartedAt: string,
  eventBoundary?: FrozenPhaseEventBoundary,
): Promise<CapturedPhaseEvidence> => {
  const events = await eventsForCapture(listeners, eventCursor, eventBoundary);
  const expectedFault = expectedFaultFor(input.matrixCase, input.phase);
  const bundle = (
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
      consoleMessages: events.records.consoleMessages,
      pageErrors: events.records.pageErrors,
      requestFailures: events.records.requestFailures,
      bugsinkDsn: input.runtime.bugsinkDsn,
      responses: events.records.responses,
      ...(expectedFault === undefined ? {} : { expectedFault }),
      settleRuntimeEvents: () => Promise.resolve(),
      serverLogPath: input.runtime.apiLogPath,
      phaseStartedAt,
      ...(eventBoundary === undefined
        ? {}
        : { phaseEndedAt: eventBoundary.evidence.endedAt }),
      responseStatus: phaseStatus,
      capturedAt: new Date().toISOString(),
      capturePhase: input.phase,
      functionalAssertion: {
        assertionId: `frozen-${input.matrixCase.caseId}-${input.phase}`,
        expected: unavailableSurfaceExpected
          ? { reachable: true, surface: EXPECTED_LEAD_FORM_UNAVAILABLE_SURFACE }
          : { reachable: true, actionSucceeded: true },
        actual: unavailableSurfaceExpected
          ? {
              reachable: phaseStatus !== null && phaseStatus < HTTP_OK_LIMIT,
              surface: surfaceObservation ?? null,
            }
          : {
              reachable: phaseStatus !== null && phaseStatus < HTTP_OK_LIMIT,
              actionSucceeded,
            },
        message: unavailableSurfaceExpected
          ? `Frozen ${input.phase} unavailable-surface evidence for ${input.matrixCase.caseId}`
          : `Frozen ${input.phase} evidence captured for ${input.matrixCase.caseId}`,
      },
      geometryOracle: {
        viewport: { width: 1440, height: 900 },
        maxHorizontalOverflow: 0,
        requireNoZeroSize: false,
      },
    })
  ).bundle;
  return {
    bundle,
    cursor: eventBoundary?.outputCursor ?? events.cursor,
  };
};
