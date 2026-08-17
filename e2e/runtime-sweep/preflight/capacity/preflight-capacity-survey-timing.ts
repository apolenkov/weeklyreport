export const CAPACITY_SURVEY_TIMING_STAGES = [
  "prepare",
  "navigate",
  "inventory",
  "freeze",
  "executeReveal",
] as const;

export type CapacitySurveyTimingStage =
  (typeof CAPACITY_SURVEY_TIMING_STAGES)[number];

export type CapacitySurveyTimingSnapshot = Readonly<{
  readonly elapsedMs: number;
  readonly prepareWallMs: number;
  readonly navigateWallMs: number;
  readonly inventoryWallMs: number;
  readonly freezeWallMs: number;
  readonly executeRevealWallMs: number;
  readonly candidateTotalWallMs: number;
  readonly externalUnionWallMs: number;
  readonly pureQueueResidualWallMs: number;
}>;

export class CapacitySurveyTimingError extends Error {
  override readonly name = "CapacitySurveyTimingError";
}

type TimingClock = () => number;

type CompletedSpan = Readonly<{
  readonly stage: CapacitySurveyTimingStage;
  readonly startMs: number;
  readonly endMs: number;
  readonly depth: number;
}>;

type QueueSpan = Readonly<{
  readonly startMs: number;
  readonly endMs: number;
}>;

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
  queues: QueueSpan[];
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

const EMPTY_SNAPSHOT: CapacitySurveyTimingSnapshot = {
  elapsedMs: 0,
  prepareWallMs: 0,
  navigateWallMs: 0,
  inventoryWallMs: 0,
  freezeWallMs: 0,
  executeRevealWallMs: 0,
  candidateTotalWallMs: 0,
  externalUnionWallMs: 0,
  pureQueueResidualWallMs: 0,
};

const unionDurationFor = (
  spans: readonly CompletedSpan[],
  queue: QueueSpan,
): number => {
  const intervals = spans
    .map(({ startMs, endMs, depth }) => ({
      startMs: Math.max(startMs, queue.startMs),
      endMs: Math.min(endMs, queue.endMs),
      depth,
    }))
    .filter(({ startMs, endMs }) => endMs > startMs)
    .toSorted(
      (left, right) =>
        left.startMs - right.startMs ||
        left.endMs - right.endMs ||
        left.depth - right.depth,
    );
  const first = intervals[0];
  if (first === undefined) return 0;
  const merged = intervals.slice(1).reduce(
    (current, interval) =>
      interval.startMs > current.endMs
        ? {
            totalMs: current.totalMs + current.endMs - current.startMs,
            startMs: interval.startMs,
            endMs: interval.endMs,
          }
        : { ...current, endMs: Math.max(current.endMs, interval.endMs) },
    { totalMs: 0, startMs: first.startMs, endMs: first.endMs },
  );
  return merged.totalMs + merged.endMs - merged.startMs;
};

const stageWallMsFor = (
  spans: readonly CompletedSpan[],
  stage: CapacitySurveyTimingStage,
): number =>
  spans
    .filter((span) => span.stage === stage)
    .reduce((total, span) => total + span.endMs - span.startMs, 0);

const snapshotFor = (
  spans: readonly CompletedSpan[],
  queues: readonly QueueSpan[],
  elapsedMs: number,
): CapacitySurveyTimingSnapshot => {
  const byStage = {
    prepare: stageWallMsFor(spans, "prepare"),
    navigate: stageWallMsFor(spans, "navigate"),
    inventory: stageWallMsFor(spans, "inventory"),
    freeze: stageWallMsFor(spans, "freeze"),
    executeReveal: stageWallMsFor(spans, "executeReveal"),
  } satisfies Record<CapacitySurveyTimingStage, number>;
  const candidateTotalWallMs = queues.reduce(
    (total, queue) => total + queue.endMs - queue.startMs,
    0,
  );
  const externalUnionWallMs = queues.reduce(
    (total, queue) => total + unionDurationFor(spans, queue),
    0,
  );
  const pureQueueResidualWallMs = Math.max(
    0,
    candidateTotalWallMs - externalUnionWallMs,
  );
  return {
    elapsedMs,
    prepareWallMs: byStage.prepare,
    navigateWallMs: byStage.navigate,
    inventoryWallMs: byStage.inventory,
    freezeWallMs: byStage.freeze,
    executeRevealWallMs: byStage.executeReveal,
    candidateTotalWallMs,
    externalUnionWallMs,
    pureQueueResidualWallMs,
  };
};

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
  readonly spans: CompletedSpan[];
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
  readonly spans: readonly CompletedSpan[];
  readonly queueState: QueueTimingState;
}): CapacitySurveyTimingSnapshot => {
  const firstNowMs = input.timingState.firstNowMs;
  const elapsedMs =
    firstNowMs === undefined ? 0 : input.timingState.lastNowMs - firstNowMs;
  if (input.queueState.activeQueueStartMs === undefined)
    return snapshotFor(input.spans, input.queueState.queues, elapsedMs);
  const endMs = input.readNow();
  return snapshotFor(
    input.spans,
    [
      ...input.queueState.queues,
      { startMs: input.queueState.activeQueueStartMs, endMs },
    ],
    input.timingState.lastNowMs - (firstNowMs ?? endMs),
  );
};

const disabledCapacitySurveyTiming: CapacitySurveyTiming = {
  enabled: false,
  span: (_stage, operation) => operation(),
  beginCandidateQueue: () => undefined,
  endCandidateQueue: () => undefined,
  snapshot: () => EMPTY_SNAPSHOT,
};

const createEnabledCapacitySurveyTiming = (
  clock: TimingClock,
): CapacitySurveyTiming => {
  const timingState: TimingState = {
    lastNowMs: Number.NEGATIVE_INFINITY,
    firstNowMs: undefined,
  };
  const spans: CompletedSpan[] = [];
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
