import {
  type DiagnosticHostEnvelopeCounters,
  type DiagnosticHostEnvelopeSnapshot,
  EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
  HOST_ENVELOPE_THRESHOLDS,
} from "../preflight-diagnostic-host-envelope.ts";
import { evaluateHostEnvelopeSample } from "../preflight-diagnostic-host-envelope-evaluator.ts";

const RECORD_KEYS = [
  "t",
  "p",
  "f",
  "a",
  "n",
  "c",
  "u",
  "v",
  "q",
  "x",
  "i",
  "o",
  "si",
  "so",
  "st",
  "r",
  "k",
] as const;
export const POST_INFRASTRUCTURE_RECORD_COUNT = 60;
const MAX_PRESSURE_FREE_PERCENT = 100;
const REQUIRED_BREACH_STREAK_COUNT = 4;

export type HealthyPostInfrastructureRecords = Readonly<{
  readonly recordCount: typeof POST_INFRASTRUCTURE_RECORD_COUNT;
  readonly lastSnapshot: DiagnosticHostEnvelopeSnapshot;
  readonly lastCounters: DiagnosticHostEnvelopeCounters;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finiteNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const finitePercent = (value: unknown): value is number =>
  finiteNonNegative(value) && value <= MAX_PRESSURE_FREE_PERCENT;

const safeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const parseCanonicalJson = (text: string, label: string): unknown => {
  if (!text.endsWith("\n"))
    throw new Error(`${label} is not newline terminated`);
  const value: unknown = JSON.parse(text);
  if (`${JSON.stringify(value)}\n` !== text)
    throw new Error(`${label} is not canonical JSON`);
  return value;
};

const bytesFor = (value: unknown, label: string): number => {
  if (!finiteNonNegative(value) || !Number.isSafeInteger(value))
    throw new Error(`Host baseline record has invalid ${label}`);
  return value;
};

const snapshotFor = (value: unknown): DiagnosticHostEnvelopeSnapshot => {
  if (!isRecord(value))
    throw new Error("Host baseline record is not an object");
  if (Object.keys(value).join("\0") !== RECORD_KEYS.join("\0"))
    throw new Error("Host baseline record keys are not canonical");
  if (value.p !== "post-infrastructure" || value.st !== "healthy")
    throw new Error(
      "Host baseline record is not a healthy post-infrastructure sample",
    );
  const rawFreeBytes = bytesFor(value.f, "raw free bytes");
  const availableBytes = bytesFor(value.a, "available bytes");
  const totalBytes = bytesFor(value.n, "total bytes");
  const compressedBytes = bytesFor(value.c, "compressed bytes");
  const swapUsedBytes = bytesFor(value.u, "swap used bytes");
  const swapFreeBytes = bytesFor(value.v, "swap free bytes");
  if (!finitePercent(value.q) || value.x !== "normal")
    throw new Error("Host baseline record pressure is not healthy");
  if (!Array.isArray(value.r) || value.r.length > 0)
    throw new Error("Host baseline record reasons are invalid");
  if (
    !Array.isArray(value.k) ||
    value.k.length !== REQUIRED_BREACH_STREAK_COUNT ||
    value.k.some((streak) => !safeInteger(streak) || streak !== 0)
  )
    throw new Error("Host baseline record breach streaks are invalid");
  return {
    timestampWall: bytesFor(value.t, "timestamp"),
    phase: "post-infrastructure",
    rawFreeBytes,
    availableBytes,
    totalBytes,
    compressedBytes,
    swapUsedBytes,
    swapFreeBytes,
    pressureFreePercent: value.q,
    pressureState: "normal",
    pageins: bytesFor(value.i, "pageins"),
    pageouts: bytesFor(value.o, "pageouts"),
    swapins: bytesFor(value.si, "swapins"),
    swapouts: bytesFor(value.so, "swapouts"),
  };
};

const recordsFor = (
  payload: Buffer,
): readonly DiagnosticHostEnvelopeSnapshot[] => {
  const lines = payload.toString("utf8").split("\n");
  if (lines.at(-1) !== "")
    throw new Error("Host baseline payload is not newline terminated");
  lines.pop();
  if (lines.length !== POST_INFRASTRUCTURE_RECORD_COUNT)
    throw new Error("Host baseline record count is not exactly 60");
  return lines.map((line, index) => {
    if (
      Buffer.byteLength(`${line}\n`, "utf8") >
      HOST_ENVELOPE_THRESHOLDS.maxRecordBytes
    )
      throw new Error(
        `Host baseline record ${String(index + 1)} exceeds byte bound`,
      );
    return snapshotFor(
      parseCanonicalJson(
        `${line}\n`,
        `Host baseline record ${String(index + 1)}`,
      ),
    );
  });
};

export const readHealthyPostInfrastructureRecords = (
  payload: Buffer,
): HealthyPostInfrastructureRecords => {
  const snapshots = recordsFor(payload);
  const folded = snapshots.reduce<{
    readonly priorCounters: DiagnosticHostEnvelopeCounters | undefined;
    readonly lastSnapshot: DiagnosticHostEnvelopeSnapshot | undefined;
  }>(
    (state, snapshot, index) => {
      if (
        state.lastSnapshot !== undefined &&
        snapshot.timestampWall <= state.lastSnapshot.timestampWall
      )
        throw new Error(
          `Host baseline timestamp did not advance at sample ${String(index + 1)}`,
        );
      const evaluation = evaluateHostEnvelopeSample({
        snapshot,
        mode: "baseline",
        baselineSwapUsedBytes: snapshot.swapUsedBytes ?? 0,
        priorCounters: state.priorCounters,
        breachStreaks: EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
      });
      if (
        evaluation.status !== "healthy" ||
        evaluation.nextCounters === undefined
      )
        throw new Error(
          `Host baseline sample ${String(index + 1)} is not healthy`,
        );
      return {
        priorCounters: evaluation.nextCounters,
        lastSnapshot: snapshot,
      };
    },
    { priorCounters: undefined, lastSnapshot: undefined },
  );
  if (folded.lastSnapshot === undefined || folded.priorCounters === undefined)
    throw new Error("Host baseline has no samples");
  return {
    recordCount: POST_INFRASTRUCTURE_RECORD_COUNT,
    lastSnapshot: folded.lastSnapshot,
    lastCounters: folded.priorCounters,
  };
};
