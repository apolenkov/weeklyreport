import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import { FAULT_DECLARATIONS } from "../scenarios/faults/fault-declarations.ts";
import {
  VIEWER_STATUS_FAULT_ID,
  VIEWER_STATUS_FAULT_STATUS,
  VIEWER_STATUS_OPERATION,
} from "../scenarios/resolver/resolver-query-fault.ts";
import type { ExpectedFault } from "./evidence-types.ts";

const failureFor = (abortCode: "timedout" | "aborted"): string =>
  abortCode === "timedout" ? "ERR_TIMED_OUT" : "ERR_ABORTED";

export const expectedFaultFor = (
  matrixCase: MatrixExecutableCase,
  phase: "before" | "action" | "after",
): ExpectedFault | undefined => {
  if (phase !== "action" || matrixCase.execution.kind !== "fault")
    return undefined;
  const execution = matrixCase.execution;
  if (execution.faultId === VIEWER_STATUS_FAULT_ID) {
    return {
      faultId: VIEWER_STATUS_FAULT_ID,
      operation: VIEWER_STATUS_OPERATION,
      method: "GET",
      expectedStatus: VIEWER_STATUS_FAULT_STATUS,
      expectedTransportFailure: null,
      expectedCount: 1,
    };
  }
  const declaration = FAULT_DECLARATIONS.find(
    ({ id }) => id === execution.faultId,
  );
  if (declaration === undefined)
    throw new Error(`Fault ${execution.faultId} has no runtime declaration`);
  return {
    faultId: declaration.id,
    operation: declaration.operation,
    method: "POST",
    expectedStatus: declaration.response?.status ?? null,
    expectedTransportFailure:
      declaration.abortCode === null ? null : failureFor(declaration.abortCode),
    expectedCount: 1,
  };
};
