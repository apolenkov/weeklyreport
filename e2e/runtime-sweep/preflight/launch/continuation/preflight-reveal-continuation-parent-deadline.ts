import { REVEAL_CONTINUATION_ATTEMPT_MAX_MS } from "../../reveal/continuation/contracts/preflight-reveal-continuation-limits.ts";

const assertDeadlineNumber = (name: string, value: number): void => {
  if (!Number.isFinite(value))
    throw new Error(`${name} must be a finite deadline`);
};

export const attemptDeadlinesFor = (input: {
  readonly deadlineAt?: number;
  readonly deadlineMonotonic?: number;
  readonly functionalDeadlineAt?: number;
  readonly functionalDeadlineMonotonic?: number;
  readonly now: () => number;
  readonly monotonicNow: () => number;
  readonly reserveMs: number;
}): Readonly<{
  readonly deadlineAt: number;
  readonly deadlineMonotonic: number;
  readonly functionalDeadlineAt: number;
  readonly functionalDeadlineMonotonic: number;
}> => {
  const deadlineAt =
    input.deadlineAt ?? input.now() + REVEAL_CONTINUATION_ATTEMPT_MAX_MS;
  const deadlineMonotonic =
    input.deadlineMonotonic ??
    input.monotonicNow() + REVEAL_CONTINUATION_ATTEMPT_MAX_MS;
  const functionalDeadlineAt =
    input.functionalDeadlineAt ?? deadlineAt - input.reserveMs;
  const functionalDeadlineMonotonic =
    input.functionalDeadlineMonotonic ?? deadlineMonotonic - input.reserveMs;
  assertDeadlineNumber("deadlineAt", deadlineAt);
  assertDeadlineNumber("deadlineMonotonic", deadlineMonotonic);
  assertDeadlineNumber("functionalDeadlineAt", functionalDeadlineAt);
  assertDeadlineNumber(
    "functionalDeadlineMonotonic",
    functionalDeadlineMonotonic,
  );
  if (
    functionalDeadlineAt !== deadlineAt - input.reserveMs ||
    functionalDeadlineMonotonic !== deadlineMonotonic - input.reserveMs
  )
    throw new Error(
      "Functional deadlines must equal cumulative deadlines minus the source-bound publication reserve",
    );
  if (
    functionalDeadlineAt >= deadlineAt ||
    functionalDeadlineMonotonic >= deadlineMonotonic
  )
    throw new Error("Functional deadlines must precede cumulative deadlines");
  return {
    deadlineAt,
    deadlineMonotonic,
    functionalDeadlineAt,
    functionalDeadlineMonotonic,
  };
};
