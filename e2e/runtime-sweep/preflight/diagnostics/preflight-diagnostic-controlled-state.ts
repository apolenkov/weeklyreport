import {
  type DiagnosticHostEnvelopeCounters,
  EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
} from "./preflight-diagnostic-host-envelope.ts";

export interface ControlledDiagnosticState {
  childExitCode: number | undefined;
  childError: Error | undefined;
  monitorError: Error | undefined;
  monitorStatus: "breach" | "invalid" | "inconclusive";
  receiptError: Error | undefined;
  terminationRequested: boolean;
  childCompletionObserved: boolean;
  monitorFailureBeforeChild: boolean;
  monitorStopped: boolean;
  monitorTask: Promise<void>;
  previousCounters: DiagnosticHostEnvelopeCounters | undefined;
  breachStreaks: typeof EMPTY_HOST_ENVELOPE_BREACH_STREAKS;
  terminationTask: Promise<void> | undefined;
  readonly terminationSettled: Promise<void>;
  readonly resolveTermination: () => void;
}

export const createControlledDiagnosticState =
  (): ControlledDiagnosticState => {
    const termination = Promise.withResolvers<void>();
    return {
      childExitCode: undefined,
      childError: undefined,
      monitorError: undefined,
      monitorStatus: "inconclusive",
      receiptError: undefined,
      terminationRequested: false,
      childCompletionObserved: false,
      monitorFailureBeforeChild: false,
      monitorStopped: false,
      monitorTask: Promise.resolve(),
      previousCounters: undefined,
      breachStreaks: EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
      terminationTask: undefined,
      terminationSettled: termination.promise,
      resolveTermination: termination.resolve,
    };
  };
