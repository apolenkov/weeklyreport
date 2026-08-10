import type {
  RuntimeEventCursor,
  RuntimeEventRecords,
  RuntimeEvents,
} from "../../matrix/runtime-matrix-evidence.ts";
import type {
  ControlActionAttemptOutcome,
  ControlActionRecoveryOutcome,
} from "../control-action-types.ts";
import type { ControlActionRecoveryBoundary } from "../control-actions.ts";

export type FrozenRuntimeEvidenceWindow = Readonly<{
  readonly startedAt: string;
  readonly endedAt: string;
  readonly records: RuntimeEventRecords;
  readonly cursor: RuntimeEventCursor;
}>;

export type FrozenRecoveryEvidenceWindows = Readonly<{
  readonly action: FrozenRuntimeEvidenceWindow;
  readonly recovery: FrozenRuntimeEvidenceWindow;
  readonly outcome: ControlActionRecoveryOutcome;
}>;

export type FrozenRecoveryBoundaryRecorder = Readonly<{
  readonly boundary: ControlActionRecoveryBoundary;
  readonly result: Promise<FrozenRecoveryEvidenceWindows | undefined>;
  readonly finalize: () => void;
}>;

const captureWindow = async (
  collector: RuntimeEvents,
  cursor: RuntimeEventCursor,
  startedAt: string,
): Promise<FrozenRuntimeEvidenceWindow> => {
  await collector.waitForIdle();
  const endedAt = new Date().toISOString();
  const slice = collector.consumeSince(cursor);
  return { startedAt, endedAt, ...slice };
};

export const createFrozenRecoveryBoundary = (
  collector: RuntimeEvents,
  cursor: RuntimeEventCursor,
  phaseStartedAt: string,
  captureAction: (
    window: FrozenRuntimeEvidenceWindow,
    outcome: ControlActionAttemptOutcome,
  ) => Promise<void> = () => Promise.resolve(),
): FrozenRecoveryBoundaryRecorder => {
  const actionWindow = Promise.withResolvers<FrozenRuntimeEvidenceWindow>();
  const completed = Promise.withResolvers<
    FrozenRecoveryEvidenceWindows | undefined
  >();
  return {
    boundary: {
      beforeRecovery: async (outcome) => {
        const action = await captureWindow(collector, cursor, phaseStartedAt);
        actionWindow.resolve(action);
        await captureAction(action, outcome);
      },
      afterRecovery: async (outcome) => {
        const action = await actionWindow.promise;
        completed.resolve({
          action,
          recovery: await captureWindow(
            collector,
            action.cursor,
            action.endedAt,
          ),
          outcome,
        });
      },
    },
    result: completed.promise,
    finalize: () => completed.resolve(undefined),
  };
};
