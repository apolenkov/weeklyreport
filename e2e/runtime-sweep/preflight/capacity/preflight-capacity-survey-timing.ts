import {
  type CapacitySurveyCompletedSpan,
  type CapacitySurveyQueueSpan,
  type CapacitySurveyTimingSnapshot,
  type CapacitySurveyTimingStage,
} from "./preflight-capacity-survey-timing-contract.ts";
import {
  capacitySurveyTimingSnapshotFor,
  EMPTY_CAPACITY_SURVEY_TIMING_SNAPSHOT,
} from "./preflight-capacity-survey-timing-snapshot.ts";

export type { CapacitySurveyTimingStage } from "./preflight-capacity-survey-timing-contract.ts";

export class CapacitySurveyTimingError extends Error {
  override readonly name = "CapacitySurveyTimingError";
}

type TimingClock = () => number;

type OpenSpan = Readonly<{
  readonly stage: CapacitySurveyTimingStage;
  readonly startMs: number;
  readonly depth: number;
}>;

interface TimingState {
  lastNowMs: number;
  firstNowMs: number | undefined;
}

interface QueueTimingState {
  activeQueueStartMs: number | undefined;
  queues: CapacitySurveyQueueSpan[];
}

export type CapacitySurveyTiming = Readonly<{
  readonly enabled: boolean;
  readonly span: <Value>(
    stage: CapacitySurveyTimingStage,
    operation: () => Promise<Value>,
  ) => Promise<Value>;
  readonly beginCandidateQueue: () => void;
  readonly endCandidateQueue: () => void;
  readonly snapshot: () => CapacitySurveyTimingSnapshot;
}>;

const readNowFor = (clock: TimingClock, state: TimingState): number => {
  const nowMs = clock();
  if (!Number.isFinite(nowMs) || nowMs < state.lastNowMs)
    throw new CapacitySurveyTimingError(
      "Capacity survey timing clock must be finite and monotonic",
    );
  state.lastNowMs = nowMs;
  state.firstNowMs ??= nowMs;
  return nowMs;
};

const spanFor = async <Value>(input: {
  readonly stage: CapacitySurveyTimingStage;
  readonly operation: () => Promise<Value>;
  readonly readNow: () => number;
  readonly spans: CapacitySurveyCompletedSpan[];
  readonly openSpans: OpenSpan[];
}): Promise<Value> => {
  const open: OpenSpan = {
    stage: input.stage,
    startMs: input.readNow(),
    depth: input.openSpans.length,
  };
  input.openSpans.push(open);
  try {
    return await input.operation();
  } finally {
    const endMs = input.readNow();
    const index = input.openSpans.lastIndexOf(open);
    if (index === -1)
      throw new CapacitySurveyTimingError(
        "Capacity survey timing span closed more than once",
      );
    input.openSpans.splice(index, 1);
    input.spans.push({ ...open, endMs });
  }
};

const beginCandidateQueueFor = (
  readNow: () => number,
  state: QueueTimingState,
): void => {
  if (state.activeQueueStartMs !== undefined)
    throw new CapacitySurveyTimingError(
      "Capacity survey candidate queue is already active",
    );
  state.activeQueueStartMs = readNow();
};

const endCandidateQueueFor = (
  readNow: () => number,
  state: QueueTimingState,
): void => {
  if (state.activeQueueStartMs === undefined)
    throw new CapacitySurveyTimingError(
      "Capacity survey candidate queue is not active",
    );
  const endMs = readNow();
  state.queues.push({ startMs: state.activeQueueStartMs, endMs });
  state.activeQueueStartMs = undefined;
};

const snapshotForState = (input: {
  readonly readNow: () => number;
  readonly timingState: TimingState;
  readonly spans: readonly CapacitySurveyCompletedSpan[];
  readonly queueState: QueueTimingState;
}): CapacitySurveyTimingSnapshot => {
  const firstNowMs = input.timingState.firstNowMs;
  const elapsedMs =
    firstNowMs === undefined ? 0 : input.timingState.lastNowMs - firstNowMs;
  if (input.queueState.activeQueueStartMs === undefined)
    return capacitySurveyTimingSnapshotFor({
      spans: input.spans,
      queues: input.queueState.queues,
      elapsedMs,
    });
  const endMs = input.readNow();
  return capacitySurveyTimingSnapshotFor({
    spans: input.spans,
    queues: [
      ...input.queueState.queues,
      { startMs: input.queueState.activeQueueStartMs, endMs },
    ],
    elapsedMs: input.timingState.lastNowMs - (firstNowMs ?? endMs),
  });
};

const disabledCapacitySurveyTiming: CapacitySurveyTiming = {
  enabled: false,
  span: (_stage, operation) => operation(),
  beginCandidateQueue: () => undefined,
  endCandidateQueue: () => undefined,
  snapshot: () => EMPTY_CAPACITY_SURVEY_TIMING_SNAPSHOT,
};

const createEnabledCapacitySurveyTiming = (
  clock: TimingClock,
): CapacitySurveyTiming => {
  const timingState: TimingState = {
    lastNowMs: Number.NEGATIVE_INFINITY,
    firstNowMs: undefined,
  };
  const spans: CapacitySurveyCompletedSpan[] = [];
  const openSpans: OpenSpan[] = [];
  const queueState: QueueTimingState = {
    activeQueueStartMs: undefined,
    queues: [],
  };
  const readNow = (): number => readNowFor(clock, timingState);
  return {
    enabled: true,
    span: (stage, operation) =>
      spanFor({ stage, operation, readNow, spans, openSpans }),
    beginCandidateQueue: () => beginCandidateQueueFor(readNow, queueState),
    endCandidateQueue: () => endCandidateQueueFor(readNow, queueState),
    snapshot: () =>
      snapshotForState({
        readNow,
        timingState,
        spans,
        queueState,
      }),
  };
};

export const createCapacitySurveyTiming = (
  input?: Readonly<{
    readonly enabled?: boolean;
    readonly now?: TimingClock;
  }>,
): CapacitySurveyTiming => {
  if (input?.enabled !== true) return disabledCapacitySurveyTiming;
  return createEnabledCapacitySurveyTiming(
    input.now ?? (() => performance.now()),
  );
};
