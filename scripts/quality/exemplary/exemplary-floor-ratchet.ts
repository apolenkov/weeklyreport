import { readFileSync } from "node:fs";

export interface FloorSnapshot {
  readonly filesOnFloor: number;
  readonly productTotal: number;
  readonly overrideBlocks: number;
  readonly liveSuppressions: number;
}

type Counter = keyof FloorSnapshot;
type RatchetCounter = Exclude<Counter, "productTotal">;

interface JustifiedRegression {
  readonly counter: RatchetCounter;
  readonly from: number;
  readonly to: number;
  readonly reason: string;
}

export interface FloorBaseline extends FloorSnapshot {
  readonly justifiedRegressions?: readonly JustifiedRegression[];
}

const COUNTERS: readonly Counter[] = [
  "filesOnFloor",
  "productTotal",
  "overrideBlocks",
  "liveSuppressions",
];
const RATCHET_COUNTERS: readonly RatchetCounter[] = [
  "filesOnFloor",
  "overrideBlocks",
  "liveSuppressions",
];
const isRatchetCounter = (value: string): value is RatchetCounter =>
  value === "filesOnFloor" ||
  value === "overrideBlocks" ||
  value === "liveSuppressions";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const direction = (counter: RatchetCounter): "up" | "down" => {
  if (counter === "filesOnFloor") return "up";
  return "down";
};

const historyRegression = (
  counter: RatchetCounter,
  current: number,
  previous: number,
): boolean => {
  const expected = direction(counter);
  if (expected === "up") return current < previous;
  return current > previous;
};

export const ratchetViolations = (
  actual: FloorSnapshot,
  baseline: FloorBaseline,
  previousBaseline?: FloorSnapshot,
): readonly string[] => [
  ...COUNTERS.filter((counter) => actual[counter] !== baseline[counter]).map(
    (counter) =>
      `current ${counter}=${actual[counter]} does not match baseline ${baseline[counter]}`,
  ),
  ...(previousBaseline === undefined
    ? []
    : RATCHET_COUNTERS.filter(
        (counter) =>
          historyRegression(
            counter,
            baseline[counter],
            previousBaseline[counter],
          ) &&
          !baseline.justifiedRegressions?.some(
            (entry) =>
              entry.counter === counter &&
              entry.from === previousBaseline[counter] &&
              entry.to === baseline[counter] &&
              entry.reason.trim().length > 0,
          ),
      ).map(
        (counter) =>
          `baseline regressed: ${counter} ${previousBaseline[counter]} -> ${baseline[counter]}`,
      )),
];

export const parseFloorSnapshot = (raw: string): FloorBaseline => {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value)) throw new Error("Invalid exemplary-floor baseline");
  const record = value;
  for (const counter of COUNTERS) {
    const count = record[counter];
    if (typeof count !== "number" || !Number.isInteger(count) || count < 0)
      throw new Error(`Invalid exemplary-floor baseline counter: ${counter}`);
  }
  const regressions = record.justifiedRegressions;
  if (regressions !== undefined && !Array.isArray(regressions))
    throw new Error("Invalid exemplary-floor justified regressions list");
  const regressionEntries: readonly unknown[] = Array.isArray(regressions)
    ? regressions
    : [];
  const justifiedRegressions = regressionEntries.map((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      Array.isArray(entry) ||
      !("counter" in entry) ||
      typeof entry.counter !== "string" ||
      !isRatchetCounter(entry.counter) ||
      !("from" in entry) ||
      typeof entry.from !== "number" ||
      !Number.isInteger(entry.from) ||
      !("to" in entry) ||
      typeof entry.to !== "number" ||
      !Number.isInteger(entry.to) ||
      !("reason" in entry) ||
      typeof entry.reason !== "string" ||
      entry.reason.trim().length === 0
    )
      throw new Error("Invalid exemplary-floor justified regression");
    return {
      counter: entry.counter,
      from: entry.from,
      to: entry.to,
      reason: entry.reason,
    };
  });
  const filesOnFloor = record.filesOnFloor;
  const productTotal = record.productTotal;
  const overrideBlocks = record.overrideBlocks;
  const liveSuppressions = record.liveSuppressions;
  if (
    typeof filesOnFloor !== "number" ||
    typeof productTotal !== "number" ||
    typeof overrideBlocks !== "number" ||
    typeof liveSuppressions !== "number"
  )
    throw new Error("Invalid exemplary-floor baseline");
  return {
    filesOnFloor,
    productTotal,
    overrideBlocks,
    liveSuppressions,
    ...(justifiedRegressions.length === 0 ? {} : { justifiedRegressions }),
  };
};

export const readFloorBaseline = (path: string): FloorBaseline =>
  parseFloorSnapshot(readFileSync(path, "utf8"));
