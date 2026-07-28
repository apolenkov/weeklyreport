const STRESS_PROJECT_COUNT = 36;
const UUID_PREFIX = "e0000000-0000-4000-8000-";
const HEX_RADIX = 16;
const UUID_SUFFIX_WIDTH = 10;

export const STRESS_ID_KIND = {
  project: 1,
  groupProduct: 2,
  stageAssignment: 3,
  projectStatus: 4,
  stageStatus: 5,
  item: 6,
  itemStable: 7,
} as const;

const suffix = (kind: number, index: number): string =>
  `${kind.toString(HEX_RADIX).padStart(2, "0")}${index
    .toString(HEX_RADIX)
    .padStart(UUID_SUFFIX_WIDTH, "0")}`;

export const stressId = (kind: number, index: number): string =>
  `${UUID_PREFIX}${suffix(kind, index)}`;

export const STRESS_PROJECT_IDS = Array.from(
  { length: STRESS_PROJECT_COUNT },
  (_, offset) => stressId(STRESS_ID_KIND.project, offset + 1),
);
