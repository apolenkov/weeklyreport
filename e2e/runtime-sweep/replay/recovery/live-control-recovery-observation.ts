import type {
  ControlActionAttemptOutcome,
  ControlActionRecoveryBoundary,
} from "../control-actions/control-actions.ts";
import type { LiveControlObservation } from "../live-control/live-control-planning.ts";

type RecoveryObservationResult =
  | Readonly<{
      readonly captured: true;
      readonly observation: LiveControlObservation | undefined;
    }>
  | Readonly<{ readonly captured: false }>;

export type RecoveryObservationBoundary = Readonly<{
  readonly boundary: ControlActionRecoveryBoundary;
  readonly result: Promise<RecoveryObservationResult>;
  readonly finalize: () => void;
}>;

export const createRecoveryObservationBoundary = (
  delegate: ControlActionRecoveryBoundary,
  observe: (
    outcome: ControlActionAttemptOutcome,
  ) => Promise<LiveControlObservation | undefined>,
): RecoveryObservationBoundary => {
  const completed = Promise.withResolvers<RecoveryObservationResult>();
  return {
    boundary: {
      beforeRecovery: async (outcome) => {
        completed.resolve({
          captured: true,
          observation: await observe(outcome),
        });
        await delegate.beforeRecovery(outcome);
      },
      afterRecovery: (outcome) => delegate.afterRecovery(outcome),
    },
    result: completed.promise,
    finalize: () => completed.resolve({ captured: false }),
  };
};
