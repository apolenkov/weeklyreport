import { type EvidenceBundle } from "./contracts.ts";
import type { DomInventory } from "./dom-inventory.ts";
import { captureRouteEvidence } from "./evidence-capture.ts";
import type { FrozenPhaseInput } from "./frozen-case-live-capture-types.ts";
import type { RuntimeEvents } from "./runtime-matrix-evidence.ts";
import type { RuntimeSurfaceObservation } from "./runtime-surface-expectation.ts";
import { EXPECTED_LEAD_FORM_UNAVAILABLE_SURFACE } from "./runtime-surface-expectation.ts";

const HTTP_OK_LIMIT = 400;

export const captureEvidence = async (
  input: FrozenPhaseInput,
  listeners: RuntimeEvents,
  inventory: DomInventory,
  phaseStatus: number | null,
  actionSucceeded: boolean,
  unavailableSurfaceExpected: boolean,
  surfaceObservation: RuntimeSurfaceObservation | undefined,
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
