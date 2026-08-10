import { z } from "zod";

import {
  type Action,
  MATRIX_EXECUTION_KINDS,
  type MatrixExecution,
  type MatrixExecutionKind,
  matrixExecutionSchema,
  matrixInapplicableSchema,
  type MatrixObservation,
  type StateAxes,
  stateAxesSchema,
} from "../source/contracts.ts";

const executionStateSchema = stateAxesSchema;

export const matrixExecutionPolicyInputSchema = z.union([
  z
    .object({
      state: executionStateSchema,
      execution: matrixExecutionSchema,
    })
    .strict(),
  z
    .object({
      state: executionStateSchema,
      inapplicable: matrixInapplicableSchema,
    })
    .strict(),
]);

export type MatrixExecutionPolicyInput = z.infer<
  typeof matrixExecutionPolicyInputSchema
>;

type MatrixExecutionPolicyIssueCode =
  | "invalid-row"
  | "unsupported-execution-kind"
  | "missing-bounded-work"
  | "multiple-bounded-work"
  | "transition-mismatch"
  | "missing-fault-id"
  | "fabricated-fault"
  | "invalid-inapplicable";

interface MatrixExecutionPolicyIssue {
  readonly code: MatrixExecutionPolicyIssueCode;
  readonly message: string;
}

export type MatrixExecutionPolicyResult =
  | { readonly ok: true; readonly row: MatrixExecutionPolicyInput }
  | {
      readonly ok: false;
      readonly issues: readonly MatrixExecutionPolicyIssue[];
    };

class MatrixExecutionPolicyError extends Error {
  override readonly name = "MatrixExecutionPolicyError";

  constructor(readonly issues: readonly MatrixExecutionPolicyIssue[]) {
    super(issues.map(({ code, message }) => `${code}: ${message}`).join("; "));
  }
}

type BoundedWork =
  | { readonly kind: "action"; readonly value: Action }
  | { readonly kind: "observation"; readonly value: MatrixObservation };

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasKind = (
  value: unknown,
): value is Readonly<Record<string, unknown>> & { readonly kind: string } =>
  isRecord(value) && typeof value.kind === "string";

const executionKindSet: ReadonlySet<string> = new Set(MATRIX_EXECUTION_KINDS);
const knownExecutionKind = (value: string): value is MatrixExecutionKind =>
  executionKindSet.has(value);

const issue = (
  code: MatrixExecutionPolicyIssueCode,
  message: string,
): MatrixExecutionPolicyIssue => ({ code, message });

const executionParseIssue = (
  execution: unknown,
): MatrixExecutionPolicyIssue | undefined => {
  if (!hasKind(execution)) return undefined;
  if (!knownExecutionKind(execution.kind))
    return issue(
      "unsupported-execution-kind",
      `Execution kind ${execution.kind} is not declared`,
    );
  if (!isRecord(execution)) return undefined;
  const hasAction = execution.action !== undefined;
  const hasObservation = execution.observation !== undefined;
  if (!hasAction && !hasObservation)
    return issue(
      "missing-bounded-work",
      "Executable rows require exactly one action or observation",
    );
  if (hasAction && hasObservation)
    return issue(
      "multiple-bounded-work",
      "Executable rows require exactly one action or observation",
    );
  const requiresFaultId =
    execution.kind === "recovery" ||
    execution.kind === "fault" ||
    execution.kind === "concurrency" ||
    execution.kind === "infrastructure";
  return requiresFaultId && execution.faultId === undefined
    ? issue(
        "missing-fault-id",
        `Execution kind ${execution.kind} requires a stable fault id`,
      )
    : undefined;
};

const parseIssue = (input: unknown): MatrixExecutionPolicyIssue => {
  if (isRecord(input)) {
    const executionIssue = executionParseIssue(input.execution);
    if (executionIssue !== undefined) return executionIssue;
    if (input.inapplicable !== undefined)
      return issue(
        "invalid-inapplicable",
        "Inapplicable rows require a stable constraint id and reason",
      );
  }
  return issue(
    "invalid-row",
    "Matrix row does not satisfy the execution contract",
  );
};

const workFor = (execution: MatrixExecution): BoundedWork => {
  switch (execution.kind) {
    case "navigation":
    case "control":
    case "recovery":
    case "fault":
    case "concurrency":
      return { kind: "action", value: execution.action };
    case "idle":
      return { kind: "observation", value: execution.observation };
    case "infrastructure":
      return "action" in execution
        ? { kind: "action", value: execution.action }
        : { kind: "observation", value: execution.observation };
    default:
      return assertNever(execution);
  }
};

const faultIdFor = (execution: MatrixExecution): string | undefined => {
  switch (execution.kind) {
    case "navigation":
    case "idle":
    case "control":
      return undefined;
    case "recovery":
    case "fault":
    case "concurrency":
    case "infrastructure":
      return execution.faultId;
    default:
      return assertNever(execution);
  }
};

const expectedTransitionFor = (
  execution: MatrixExecution,
  work: BoundedWork,
): StateAxes["controlTransition"] =>
  work.kind === "action"
    ? work.value.transition
    : execution.kind === "idle"
      ? "idle"
      : "none";

const assertNever = (value: never): never => {
  throw new MatrixExecutionPolicyError([
    issue("invalid-row", `Unexpected execution value ${JSON.stringify(value)}`),
  ]);
};

const policyIssuesFor = (
  state: StateAxes,
  execution: MatrixExecution,
): readonly MatrixExecutionPolicyIssue[] => {
  const work = workFor(execution);
  const expectedTransition = expectedTransitionFor(execution, work);
  const transitionIssues =
    state.controlTransition === expectedTransition
      ? []
      : [
          issue(
            "transition-mismatch",
            `State transition ${state.controlTransition} does not match execution transition ${expectedTransition}`,
          ),
        ];
  const faultId = faultIdFor(execution);
  const faultIssues =
    state.fault === "none" && faultId !== undefined
      ? [
          issue(
            "fabricated-fault",
            `Fault id ${faultId} cannot be attached to a none fault state`,
          ),
        ]
      : state.fault !== "none" && faultId === undefined
        ? [
            issue(
              "missing-fault-id",
              `Fault state ${state.fault} requires a stable fault id`,
            ),
          ]
        : [];
  return [...transitionIssues, ...faultIssues];
};

export function validateLegalMatrixRow(
  input: unknown,
): MatrixExecutionPolicyResult {
  const parsed = matrixExecutionPolicyInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: [parseIssue(input)] };
  if ("inapplicable" in parsed.data) return { ok: true, row: parsed.data };
  const issues = policyIssuesFor(parsed.data.state, parsed.data.execution);
  return issues.length === 0
    ? { ok: true, row: parsed.data }
    : { ok: false, issues };
}

export function assertLegalMatrixRow(
  input: unknown,
): MatrixExecutionPolicyInput {
  const result = validateLegalMatrixRow(input);
  if (!result.ok) throw new MatrixExecutionPolicyError(result.issues);
  return result.row;
}
