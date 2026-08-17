import type { RevealExecutionTiming } from "../preflight/reveal/interaction/preflight-reveal-types.ts";
import type { RevealNonMutationProof } from "../preflight/reveal-path.ts";
import { sha256Hex, stableSerialize } from "./ids.ts";
import type {
  PreparedRuntimeState,
  RuntimeMutationLogEntry,
  RuntimeMutationSentinel,
  RuntimeStateDatabase,
} from "./state-preparation.ts";

const snapshotFor = (
  database: RuntimeStateDatabase,
  prepared: PreparedRuntimeState,
) =>
  database.transaction(async (transaction) => ({
    targeted: await transaction.readSnapshot(
      prepared.plan.targets,
      prepared.plan.permission,
    ),
    mutationSentinel: await transaction.readMutationSentinel(),
  }));

export type PreparedStateValidationPhase =
  "before reveal" | "after reveal" | "before navigation";

type PreparedStateSnapshot = Awaited<ReturnType<typeof snapshotFor>>;

const assertPreparedSnapshot = (
  expected: PreparedRuntimeState["actual"],
  actual: PreparedRuntimeState["actual"],
  phase: PreparedStateValidationPhase,
): void => {
  if (stableSerialize(actual) !== stableSerialize(expected))
    throw new Error(`Prepared runtime database changed ${phase}`);
};

type MutationEntrySummary = Readonly<
  Pick<RuntimeMutationLogEntry, "id" | "procedure" | "targetId" | "status">
>;
type ChangedMutationEntry = Readonly<{
  readonly id: string;
  readonly expected: MutationEntrySummary;
  readonly actual: MutationEntrySummary;
}>;
type MutationSentinelDelta = Readonly<{
  readonly addedCount: number;
  readonly removedCount: number;
  readonly changedCount: number;
  readonly added: readonly MutationEntrySummary[];
  readonly removed: readonly MutationEntrySummary[];
  readonly changed: readonly ChangedMutationEntry[];
  readonly reordered: boolean;
}>;
const MAX_DIAGNOSTIC_ENTRIES = 10;

const summaryFor = ({
  id,
  procedure,
  targetId,
  status,
}: RuntimeMutationLogEntry): MutationEntrySummary => ({
  id,
  procedure,
  targetId,
  status,
});
const compareMutationIds = (left: string, right: string): number =>
  left.localeCompare(right);

const mutationSentinelDeltaFor = (
  expected: RuntimeMutationSentinel,
  actual: RuntimeMutationSentinel,
): MutationSentinelDelta => {
  const expectedById = new Map(expected.map((entry) => [entry.id, entry]));
  const actualById = new Map(actual.map((entry) => [entry.id, entry]));
  const added = actual
    .filter(({ id }) => !expectedById.has(id))
    .map(summaryFor);
  const removed = expected
    .filter(({ id }) => !actualById.has(id))
    .map(summaryFor);
  const changed = expected.flatMap((entry) => {
    const current = actualById.get(entry.id);
    return current === undefined ||
      stableSerialize(entry) === stableSerialize(current)
      ? []
      : [
          {
            id: entry.id,
            expected: summaryFor(entry),
            actual: summaryFor(current),
          },
        ];
  });
  const expectedIds = expected.map(({ id }) => id);
  const actualIds = actual.map(({ id }) => id);
  const reordered =
    expectedIds.length === actualIds.length &&
    stableSerialize(expectedIds.toSorted(compareMutationIds)) ===
      stableSerialize(actualIds.toSorted(compareMutationIds)) &&
    stableSerialize(expectedIds) !== stableSerialize(actualIds);
  return {
    addedCount: added.length,
    removedCount: removed.length,
    changedCount: changed.length,
    added: added.slice(0, MAX_DIAGNOSTIC_ENTRIES),
    removed: removed.slice(0, MAX_DIAGNOSTIC_ENTRIES),
    changed: changed.slice(0, MAX_DIAGNOSTIC_ENTRIES),
    reordered,
  };
};

const formatMutationSentinelDelta = (
  expected: RuntimeMutationSentinel,
  actual: RuntimeMutationSentinel,
): string => {
  const delta = mutationSentinelDeltaFor(expected, actual);
  const format = (entries: readonly MutationEntrySummary[]): string =>
    stableSerialize(entries);
  const changed = stableSerialize(delta.changed);
  return [
    `expectedCount=${expected.length}`,
    `actualCount=${actual.length}`,
    `addedCount=${delta.addedCount}; added=${format(delta.added)}`,
    `removedCount=${delta.removedCount}; removed=${format(delta.removed)}`,
    `changedCount=${delta.changedCount}; changed=${changed}`,
    `orderChanged=${String(delta.reordered)}`,
  ].join("; ");
};

const assertMutationSentinel = (
  expected: PreparedRuntimeState["mutationSentinel"],
  actual: PreparedRuntimeState["mutationSentinel"],
  phase: PreparedStateValidationPhase,
): void => {
  if (stableSerialize(actual) !== stableSerialize(expected))
    throw new Error(
      `Runtime mutation sentinel changed ${phase} (${formatMutationSentinelDelta(expected, actual)})`,
    );
};

type ActionResult =
  | Readonly<{ readonly status: "pass" }>
  | Readonly<{ readonly status: "error"; readonly error: unknown }>;

const assertPreparedStateSnapshot = (
  prepared: PreparedRuntimeState,
  current: PreparedStateSnapshot,
  phase: PreparedStateValidationPhase,
): void => {
  assertMutationSentinel(
    prepared.mutationSentinel,
    current.mutationSentinel,
    phase,
  );
  assertPreparedSnapshot(prepared.actual, current.targeted, phase);
};

export async function assertPreparedStateUnchanged(input: {
  readonly database: RuntimeStateDatabase;
  readonly prepared: PreparedRuntimeState;
  readonly phase: PreparedStateValidationPhase;
}): Promise<void> {
  const current = await snapshotFor(input.database, input.prepared);
  assertPreparedStateSnapshot(input.prepared, current, input.phase);
}

const captureAction = async (
  action: () => Promise<void>,
): Promise<ActionResult> => {
  try {
    await action();
    return { status: "pass" };
  } catch (error: unknown) {
    return { status: "error", error };
  }
};

export async function provePreparedStateNonMutation(input: {
  readonly database: RuntimeStateDatabase;
  readonly prepared: PreparedRuntimeState;
  readonly settle: () => Promise<void>;
  readonly action: () => Promise<void>;
  readonly timing?: RevealExecutionTiming;
}): Promise<RevealNonMutationProof> {
  const timed = <Value>(
    stage: Parameters<RevealExecutionTiming["span"]>[0],
    operation: () => Promise<Value>,
  ): Promise<Value> => input.timing?.span(stage, operation) ?? operation();
  await timed("preSettle", input.settle);
  const before = await timed("beforeSnapshot", () =>
    snapshotFor(input.database, input.prepared),
  );
  assertPreparedStateSnapshot(input.prepared, before, "before reveal");
  const actionResult = await captureAction(() => timed("action", input.action));
  const settleResult = await captureAction(() =>
    timed("postSettle", input.settle),
  );
  const after = await timed("afterSnapshot", () =>
    snapshotFor(input.database, input.prepared),
  );
  assertPreparedStateSnapshot(input.prepared, after, "after reveal");
  if (actionResult.status === "error") throw actionResult.error;
  if (settleResult.status === "error") throw settleResult.error;
  return {
    status: "unchanged",
    beforeDigest: sha256Hex({
      targeted: before.targeted,
      mutationSentinel: before.mutationSentinel,
    }),
    afterDigest: sha256Hex({
      targeted: after.targeted,
      mutationSentinel: after.mutationSentinel,
    }),
  };
}
