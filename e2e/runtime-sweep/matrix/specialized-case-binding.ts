import type { MatrixExecutionKind } from "../source/contracts.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";

export const VIEWER_STATUS_EMPTY_DECLARATION = "viewer-status-empty";
export const VIEWER_STATUS_QUERY_ERROR_DECLARATION =
  "viewer-status-query-error";

const RESOLVER_DECLARATION_IDS = new Set([
  VIEWER_STATUS_EMPTY_DECLARATION,
  VIEWER_STATUS_QUERY_ERROR_DECLARATION,
]);

export type SpecializedCaseBindingExpectation = Readonly<{
  readonly kind?: Exclude<
    MatrixExecutionKind,
    "navigation" | "idle" | "control" | "recovery"
  >;
  readonly faultId?: string;
}>;

export const isResolverCase = (matrixCase: MatrixExecutableCase): boolean =>
  matrixCase.declarationId !== undefined &&
  RESOLVER_DECLARATION_IDS.has(matrixCase.declarationId);

export class ResolverCaseBindingError extends Error {
  override readonly name = "ResolverCaseBindingError";
}

export function assertResolverCaseBinding(
  matrixCase: MatrixExecutableCase,
  expected?: SpecializedCaseBindingExpectation,
): void {
  const { execution } = matrixCase;
  if (execution.kind !== "navigation" && execution.kind !== "fault")
    throw new ResolverCaseBindingError(
      `Resolver case ${matrixCase.caseId} has unsupported execution kind ${execution.kind}`,
    );
  const outcome = matrixCase.expectedOutcome?.identity.outcome;
  const recoveryOutcome = matrixCase.resolverRecoveryOutcome;
  const empty = matrixCase.declarationId === VIEWER_STATUS_EMPTY_DECLARATION;
  const contract = empty
    ? { executionKind: "navigation", faultMode: "none", outcome: "empty" }
    : {
        executionKind: "fault",
        faultMode: "api-error",
        outcome: "query-error",
      };
  if (
    execution.kind !== contract.executionKind ||
    matrixCase.state.fault !== contract.faultMode ||
    outcome !== contract.outcome
  )
    throw new ResolverCaseBindingError(
      `Resolver case ${matrixCase.caseId} does not match its frozen declaration contract`,
    );
  const expectedRecoveryOutcome = empty ? null : "visible-current";
  if (recoveryOutcome !== expectedRecoveryOutcome)
    throw new ResolverCaseBindingError(
      `Resolver case ${matrixCase.caseId} lacks its explicit recovery outcome contract`,
    );
  if (expected?.faultId === undefined) return;
  const actualFaultId = "faultId" in execution ? execution.faultId : undefined;
  if (actualFaultId !== expected.faultId)
    throw new ResolverCaseBindingError(
      `Case ${matrixCase.caseId} fault id ${actualFaultId ?? "none"} does not match ${expected.faultId}`,
    );
}
