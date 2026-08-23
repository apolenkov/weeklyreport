import {
  type DiagnosticHostEnvelopeCounters,
  type DiagnosticHostEnvelopeSnapshot,
  EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
  HOST_ENVELOPE_THRESHOLDS,
  type HostEnvelopeBreachStreaks,
  type HostEnvelopeEvaluation,
} from "./preflight-diagnostic-host-envelope.ts";

const MAX_PRESSURE_FREE_PERCENT = 100;

const finiteNonNegative = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value >= 0;

const finitePercent = (value: number | null): value is number =>
  finiteNonNegative(value) && value <= MAX_PRESSURE_FREE_PERCENT;

const nextStreakFor = (current: number, breached: boolean): number =>
  breached ? current + 1 : 0;

type CompleteHostEnvelopeSnapshot = Readonly<{
  readonly rawFreeBytes: number;
  readonly availableBytes: number;
  readonly totalBytes: number;
  readonly compressedBytes: number;
  readonly swapUsedBytes: number;
  readonly swapFreeBytes: number;
  readonly pressureFreePercent: number;
  readonly pressureState: "normal" | "warning" | "critical";
  readonly pageins: number;
  readonly pageouts: number;
  readonly swapins: number;
  readonly swapouts: number;
}>;

const requiredSnapshotFields = [
  "rawFreeBytes",
  "availableBytes",
  "totalBytes",
  "compressedBytes",
  "swapUsedBytes",
  "swapFreeBytes",
  "pressureFreePercent",
  "pressureState",
  "pageins",
  "pageouts",
  "swapins",
  "swapouts",
] as const satisfies readonly (keyof DiagnosticHostEnvelopeSnapshot)[];

const completeSnapshotFor = (
  snapshot: DiagnosticHostEnvelopeSnapshot,
): CompleteHostEnvelopeSnapshot | undefined => {
  if (
    !finiteNonNegative(snapshot.rawFreeBytes) ||
    !finiteNonNegative(snapshot.availableBytes) ||
    !finiteNonNegative(snapshot.totalBytes) ||
    !finiteNonNegative(snapshot.compressedBytes) ||
    !finiteNonNegative(snapshot.swapUsedBytes) ||
    !finiteNonNegative(snapshot.swapFreeBytes) ||
    !finitePercent(snapshot.pressureFreePercent) ||
    snapshot.pressureState === null ||
    !finiteNonNegative(snapshot.pageins) ||
    !finiteNonNegative(snapshot.pageouts) ||
    !finiteNonNegative(snapshot.swapins) ||
    !finiteNonNegative(snapshot.swapouts) ||
    snapshot.availableBytes > snapshot.totalBytes
  )
    return undefined;
  return {
    rawFreeBytes: snapshot.rawFreeBytes,
    availableBytes: snapshot.availableBytes,
    totalBytes: snapshot.totalBytes,
    compressedBytes: snapshot.compressedBytes,
    swapUsedBytes: snapshot.swapUsedBytes,
    swapFreeBytes: snapshot.swapFreeBytes,
    pressureFreePercent: snapshot.pressureFreePercent,
    pressureState: snapshot.pressureState,
    pageins: snapshot.pageins,
    pageouts: snapshot.pageouts,
    swapins: snapshot.swapins,
    swapouts: snapshot.swapouts,
  };
};

const invalidSnapshotReasonsFor = (
  snapshot: DiagnosticHostEnvelopeSnapshot,
): string[] => {
  const reasons = requiredSnapshotFields.flatMap((field) =>
    snapshot[field] === null ? [`missing ${field}`] : [],
  );
  if (snapshot.pressureState === null) reasons.push("missing pressure state");
  if (
    finiteNonNegative(snapshot.totalBytes) &&
    finiteNonNegative(snapshot.availableBytes) &&
    snapshot.availableBytes > snapshot.totalBytes
  )
    reasons.push("available memory exceeds total memory");
  if (!finitePercent(snapshot.pressureFreePercent))
    reasons.push("invalid pressure free percentage");
  return reasons;
};

const countersFor = (
  snapshot: DiagnosticHostEnvelopeSnapshot,
): DiagnosticHostEnvelopeCounters | undefined => {
  if (
    !finiteNonNegative(snapshot.pageins) ||
    !finiteNonNegative(snapshot.pageouts) ||
    !finiteNonNegative(snapshot.swapins) ||
    !finiteNonNegative(snapshot.swapouts)
  )
    return undefined;
  return {
    pageins: snapshot.pageins,
    pageouts: snapshot.pageouts,
    swapins: snapshot.swapins,
    swapouts: snapshot.swapouts,
  };
};

const counterReset = (
  current: DiagnosticHostEnvelopeCounters,
  previous: DiagnosticHostEnvelopeCounters | undefined,
): boolean =>
  previous !== undefined &&
  (current.pageins < previous.pageins ||
    current.pageouts < previous.pageouts ||
    current.swapins < previous.swapins ||
    current.swapouts < previous.swapouts);

const counterInvalidReasonsFor = (input: {
  readonly nextCounters: DiagnosticHostEnvelopeCounters | undefined;
  readonly priorCounters: DiagnosticHostEnvelopeCounters | undefined;
}): string[] => {
  const reasons: string[] = [];
  if (input.nextCounters === undefined)
    reasons.push("missing cumulative counter");
  else if (counterReset(input.nextCounters, input.priorCounters))
    reasons.push("cumulative counter reset or wrap");
  return reasons;
};

const baselineReasonsFor = (
  snapshot: CompleteHostEnvelopeSnapshot,
): string[] => {
  const reasons: string[] = [];
  if (snapshot.availableBytes < HOST_ENVELOPE_THRESHOLDS.baselineAvailableBytes)
    reasons.push("available memory below baseline");
  if (
    snapshot.pressureFreePercent < HOST_ENVELOPE_THRESHOLDS.baselineFreePercent
  )
    reasons.push("memory pressure free percentage below baseline");
  if (snapshot.swapUsedBytes > HOST_ENVELOPE_THRESHOLDS.baselineSwapUsedBytes)
    reasons.push("swap used above baseline");
  if (
    snapshot.compressedBytes > HOST_ENVELOPE_THRESHOLDS.baselineCompressedBytes
  )
    reasons.push("compressed memory above baseline");
  if (snapshot.pressureState !== "normal")
    reasons.push("memory pressure state is not normal");
  return reasons;
};

const runtimeReasonsFor = (
  snapshot: CompleteHostEnvelopeSnapshot,
  baselineSwapUsedBytes: number,
): Readonly<{
  readonly reasons: readonly string[];
  readonly gaugeBreaches: Readonly<{
    readonly rawFreeBytes: boolean;
    readonly availableBytes: boolean;
    readonly pressureFreePercent: boolean;
    readonly compressedBytes: boolean;
  }>;
  readonly immediate: boolean;
}> => {
  const reasons: string[] = [];
  const swapGrowthBytes = snapshot.swapUsedBytes - baselineSwapUsedBytes;
  if (snapshot.availableBytes < HOST_ENVELOPE_THRESHOLDS.abortAvailableBytes)
    reasons.push("available memory below abort threshold");
  if (snapshot.pressureFreePercent < HOST_ENVELOPE_THRESHOLDS.abortFreePercent)
    reasons.push("memory pressure free percentage below abort threshold");
  if (snapshot.swapUsedBytes > HOST_ENVELOPE_THRESHOLDS.abortSwapUsedBytes)
    reasons.push("swap used above abort threshold");
  if (swapGrowthBytes > HOST_ENVELOPE_THRESHOLDS.abortSwapGrowthBytes)
    reasons.push("swap growth above abort threshold");
  if (snapshot.compressedBytes > HOST_ENVELOPE_THRESHOLDS.abortCompressedBytes)
    reasons.push("compressed memory above abort threshold");
  if (snapshot.pressureState !== "normal")
    reasons.push("memory pressure state is not normal");
  return {
    reasons,
    gaugeBreaches: {
      rawFreeBytes: false,
      availableBytes:
        snapshot.availableBytes < HOST_ENVELOPE_THRESHOLDS.abortAvailableBytes,
      pressureFreePercent:
        snapshot.pressureFreePercent <
        HOST_ENVELOPE_THRESHOLDS.abortFreePercent,
      compressedBytes:
        snapshot.compressedBytes >
        HOST_ENVELOPE_THRESHOLDS.abortCompressedBytes,
    },
    immediate:
      snapshot.pressureState !== "normal" ||
      snapshot.swapUsedBytes > HOST_ENVELOPE_THRESHOLDS.abortSwapUsedBytes ||
      swapGrowthBytes > HOST_ENVELOPE_THRESHOLDS.abortSwapGrowthBytes,
  };
};

const runtimeBreachStreaksFor = (input: {
  readonly prior: HostEnvelopeBreachStreaks;
  readonly gaugeBreaches: Readonly<{
    readonly rawFreeBytes: boolean;
    readonly availableBytes: boolean;
    readonly pressureFreePercent: boolean;
    readonly compressedBytes: boolean;
  }>;
}): HostEnvelopeBreachStreaks => ({
  rawFreeBytes: nextStreakFor(
    input.prior.rawFreeBytes,
    input.gaugeBreaches.rawFreeBytes,
  ),
  availableBytes: nextStreakFor(
    input.prior.availableBytes,
    input.gaugeBreaches.availableBytes,
  ),
  pressureFreePercent: nextStreakFor(
    input.prior.pressureFreePercent,
    input.gaugeBreaches.pressureFreePercent,
  ),
  compressedBytes: nextStreakFor(
    input.prior.compressedBytes,
    input.gaugeBreaches.compressedBytes,
  ),
});

export const evaluateHostEnvelopeSample = (input: {
  readonly snapshot: DiagnosticHostEnvelopeSnapshot;
  readonly mode?: "baseline" | "runtime";
  readonly baselineSwapUsedBytes: number;
  readonly priorCounters: DiagnosticHostEnvelopeCounters | undefined;
  readonly breachStreaks: HostEnvelopeBreachStreaks;
}): HostEnvelopeEvaluation => {
  const invalidReasons = invalidSnapshotReasonsFor(input.snapshot);
  const completeSnapshot = completeSnapshotFor(input.snapshot);
  const nextCounters = countersFor(input.snapshot);
  invalidReasons.push(
    ...counterInvalidReasonsFor({
      nextCounters,
      priorCounters: input.priorCounters,
    }),
  );
  if (invalidReasons.length > 0 || completeSnapshot === undefined)
    return {
      status: "invalid",
      reasons:
        completeSnapshot === undefined && invalidReasons.length === 0
          ? ["invalid host envelope snapshot"]
          : invalidReasons,
      breachStreaks: input.breachStreaks,
      nextCounters,
    };

  if ((input.mode ?? "runtime") === "baseline") {
    const reasons = baselineReasonsFor(completeSnapshot);
    return {
      status: reasons.length === 0 ? "healthy" : "breach",
      reasons,
      breachStreaks: EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
      nextCounters,
    };
  }

  const runtime = runtimeReasonsFor(
    completeSnapshot,
    input.baselineSwapUsedBytes,
  );
  if (runtime.reasons.length === 0)
    return {
      status: "healthy",
      reasons: [],
      breachStreaks: EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
      nextCounters,
    };
  const nextBreachStreaks = runtimeBreachStreaksFor({
    prior: input.breachStreaks,
    gaugeBreaches: runtime.gaugeBreaches,
  });
  const gaugeBreach = Object.values(nextBreachStreaks).some(
    (streak) => streak >= HOST_ENVELOPE_THRESHOLDS.hysteresisSamples,
  );
  return {
    status: runtime.immediate || gaugeBreach ? "breach" : "healthy",
    reasons: runtime.reasons,
    breachStreaks: nextBreachStreaks,
    nextCounters,
  };
};
