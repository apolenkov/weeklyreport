import { REVEAL_CONTINUATION_LIMITS } from "../../reveal/continuation/contracts/preflight-reveal-continuation-limits.ts";
import type { ParentContext } from "./preflight-reveal-continuation-parent.ts";

export const aggregatePartitionDeadlinesFor = (input: {
  readonly now: number;
  readonly monotonicNow: number;
  readonly outerDeadlineAt: number;
  readonly outerDeadlineMonotonic: number;
  readonly partitionMaxMs: number;
  readonly teardownReserveMs: number;
  readonly continuationReserveMs: number;
}): Readonly<{
  readonly deadlineAt: number;
  readonly deadlineMonotonic: number;
  readonly functionalDeadlineAt: number;
  readonly functionalDeadlineMonotonic: number;
}> => {
  const functionalOuterDeadlineAt = Number.isFinite(input.outerDeadlineAt)
    ? input.outerDeadlineAt - input.teardownReserveMs
    : input.outerDeadlineAt;
  const functionalOuterDeadlineMonotonic = Number.isFinite(
    input.outerDeadlineMonotonic,
  )
    ? input.outerDeadlineMonotonic - input.teardownReserveMs
    : input.outerDeadlineMonotonic;
  const deadlineAt = Math.min(
    input.now + input.partitionMaxMs,
    functionalOuterDeadlineAt,
  );
  const deadlineMonotonic = Math.min(
    input.monotonicNow + input.partitionMaxMs,
    functionalOuterDeadlineMonotonic,
  );
  return {
    deadlineAt,
    deadlineMonotonic,
    functionalDeadlineAt: deadlineAt - input.continuationReserveMs,
    functionalDeadlineMonotonic:
      deadlineMonotonic - input.continuationReserveMs,
  };
};

export const aggregatePartitionContextFor = (input: {
  readonly context: ParentContext;
  readonly partitionMaxMs: number;
  readonly teardownReserveMs: number;
}): ParentContext => {
  const now = input.context.now ?? Date.now;
  const monotonicNow =
    input.context.monotonicNow ?? (() => Number.POSITIVE_INFINITY);
  const wallNow = now();
  const monotonic = monotonicNow();
  const reserveMs =
    input.context.continuationLimits?.yieldReserveMs ??
    REVEAL_CONTINUATION_LIMITS.yieldReserveMs;
  const deadlines = aggregatePartitionDeadlinesFor({
    now: wallNow,
    monotonicNow: monotonic,
    outerDeadlineAt: input.context.deadlineAt ?? Number.POSITIVE_INFINITY,
    outerDeadlineMonotonic:
      input.context.deadlineMonotonic ?? Number.POSITIVE_INFINITY,
    partitionMaxMs: input.partitionMaxMs,
    teardownReserveMs: input.teardownReserveMs,
    continuationReserveMs: reserveMs,
  });
  const terminalDeadlineAt =
    input.context.terminalDeadlineAt ?? input.context.deadlineAt;
  const terminalDeadlineMonotonic =
    input.context.terminalDeadlineMonotonic ?? input.context.deadlineMonotonic;
  return {
    ...input.context,
    ...(terminalDeadlineAt === undefined ? {} : { terminalDeadlineAt }),
    ...(terminalDeadlineMonotonic === undefined
      ? {}
      : { terminalDeadlineMonotonic }),
    ...deadlines,
  };
};
