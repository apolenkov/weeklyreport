import { readFileSync } from "node:fs";

export interface FloorSnapshot {
  readonly filesOnFloor: number;
  readonly productTotal: number;
  readonly overrideBlocks: number;
  readonly liveSuppressions: number;
}

type Counter = keyof FloorSnapshot;

const COUNTERS: readonly Counter[] = [
  "filesOnFloor",
  "productTotal",
  "overrideBlocks",
  "liveSuppressions",
];

const direction = (counter: Counter): "up" | "down" | "exact" => {
  if (counter === "filesOnFloor") return "up";
  if (counter === "productTotal") return "exact";
  return "down";
};

const historyRegression = (
  counter: Counter,
  current: number,
  previous: number,
): boolean => {
  const expected = direction(counter);
  if (expected === "up") return current < previous;
  if (expected === "down") return current > previous;
  return false;
};

export const ratchetViolations = (
  actual: FloorSnapshot,
  baseline: FloorSnapshot,
  previousBaseline?: FloorSnapshot,
): readonly string[] => [
  ...COUNTERS.filter((counter) => actual[counter] !== baseline[counter]).map(
    (counter) =>
      `current ${counter}=${actual[counter]} does not match baseline ${baseline[counter]}`,
  ),
  ...(previousBaseline === undefined
    ? []
    : COUNTERS.filter((counter) =>
        historyRegression(
          counter,
          baseline[counter],
          previousBaseline[counter],
        ),
      ).map(
        (counter) =>
          `baseline regressed: ${counter} ${previousBaseline[counter]} -> ${baseline[counter]}`,
      )),
];

export const parseFloorSnapshot = (raw: string): FloorSnapshot => {
  const value = JSON.parse(raw) as Partial<FloorSnapshot>;
  for (const counter of COUNTERS) {
    if (!Number.isInteger(value[counter]) || (value[counter] ?? -1) < 0)
      throw new Error(`Invalid exemplary-floor baseline counter: ${counter}`);
  }
  return value as FloorSnapshot;
};

export const readFloorBaseline = (path: string): FloorSnapshot =>
  parseFloorSnapshot(readFileSync(path, "utf8"));
