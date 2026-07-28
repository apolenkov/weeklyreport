import { readFileSync } from "node:fs";

export interface FloorSnapshot {
  readonly filesOnFloor: number;
  readonly productTotal: number;
  readonly overrideBlocks: number;
  readonly liveSuppressions: number;
}

type Counter = keyof FloorSnapshot;
type RatchetCounter = Exclude<Counter, "productTotal">;

export interface JustifiedRegression {
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
  const value = JSON.parse(raw) as Partial<FloorBaseline>;
  for (const counter of COUNTERS) {
    if (!Number.isInteger(value[counter]) || (value[counter] ?? -1) < 0)
      throw new Error(`Invalid exemplary-floor baseline counter: ${counter}`);
  }
  for (const entry of value.justifiedRegressions ?? []) {
    if (
      !RATCHET_COUNTERS.includes(entry.counter) ||
      !Number.isInteger(entry.from) ||
      !Number.isInteger(entry.to) ||
      entry.reason.trim().length === 0
    )
      throw new Error("Invalid exemplary-floor justified regression");
  }
  return value as FloorBaseline;
};

export const readFloorBaseline = (path: string): FloorBaseline =>
  parseFloorSnapshot(readFileSync(path, "utf8"));
