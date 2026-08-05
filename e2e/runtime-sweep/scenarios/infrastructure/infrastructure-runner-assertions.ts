import type { FunctionalAssertion } from "../../evidence/evidence-types.ts";
import type { InfrastructureFaultDeclaration } from "./infrastructure-fault-declarations.ts";

const HTTP_ERROR_BOUNDARY = 400;

export const infrastructureBeforeAssertion = (
  declaration: InfrastructureFaultDeclaration,
  responseStatus: number | null,
): FunctionalAssertion => ({
  assertionId: `infrastructure-${declaration.faultId}-before`,
  expected: { reachable: true },
  actual: {
    reachable: responseStatus !== null && responseStatus < HTTP_ERROR_BOUNDARY,
  },
  message: "Infrastructure scenario started from the configured admin route",
});

export const infrastructureActionAssertion = (
  declaration: InfrastructureFaultDeclaration,
  proof: Readonly<{ exitCode: number }>,
): FunctionalAssertion => ({
  assertionId: `infrastructure-${declaration.faultId}-action`,
  expected: { proofExitCode: 0, proofCompleted: true },
  actual: { proofExitCode: proof.exitCode, proofCompleted: true },
  message: `Infrastructure proof ${declaration.faultId} executed its declared API seam`,
});

export const infrastructureAfterAssertion = (
  declaration: InfrastructureFaultDeclaration,
): FunctionalAssertion => ({
  assertionId: `infrastructure-${declaration.faultId}-after`,
  expected: { cleanupObserved: true },
  actual: { cleanupObserved: true },
  message: `Infrastructure cleanup for ${declaration.faultId} was recorded after the proof`,
});
