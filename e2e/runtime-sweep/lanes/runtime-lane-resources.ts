export const RUNTIME_LANE_IDS = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
] as const;

export const DEFAULT_RUNTIME_LANE_COUNT = 3;
export const MIN_RUNTIME_LANE_COUNT = 1;
export const MAX_RUNTIME_LANE_COUNT = RUNTIME_LANE_IDS.length;

export type RuntimeLaneId = (typeof RUNTIME_LANE_IDS)[number];

export interface RuntimeLaneResource {
  readonly laneId: RuntimeLaneId;
  readonly databaseName: string;
  readonly redisPort: number;
  readonly apiPort: number;
  readonly webPort: number;
}

const FIRST_REDIS_PORT = 6381;
const FIRST_API_PORT = 3112;
const FIRST_WEB_PORT = 3115;
const LANE_PORT_STEP = 10;

export const runtimeLaneResources = (
  laneCount: number,
): readonly RuntimeLaneResource[] => {
  if (
    !Number.isInteger(laneCount) ||
    laneCount < MIN_RUNTIME_LANE_COUNT ||
    laneCount > MAX_RUNTIME_LANE_COUNT
  )
    throw new Error(
      `Runtime lane count must be an integer from ${MIN_RUNTIME_LANE_COUNT} to ${MAX_RUNTIME_LANE_COUNT}`,
    );
  return RUNTIME_LANE_IDS.slice(0, laneCount).map((laneId, index) => ({
    laneId,
    databaseName: `customreport_e2e_lane_${laneId}_test`,
    redisPort: FIRST_REDIS_PORT + index,
    apiPort: FIRST_API_PORT + index * LANE_PORT_STEP,
    webPort: FIRST_WEB_PORT + index * LANE_PORT_STEP,
  }));
};
