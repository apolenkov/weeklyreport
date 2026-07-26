// Deterministic ID factories for the demo seed — fixed, run-stable IDs for
// demo-only rows. Canonical IDs (head/leads/products/stages/reports/group) are
// reused from seed-constants; only sections/items/statuses/etc. get these.
// Each factory owns its counter, so IDs stay stable as long as call order does.

import { SEED_STAGES } from "./seed-constants.js";
import type { StageName } from "./seed-demo.types.js";

const ID_TAIL_RADIX = 16;
const ID_TAIL_LENGTH = 12;

function makeIdFactory(): () => string {
  let counter = 0;
  return (): string => {
    counter += 1;
    const tail = counter.toString(ID_TAIL_RADIX).padStart(ID_TAIL_LENGTH, "0");
    return `d0000000-0000-4000-8000-${tail}`;
  };
}

export const makeGroupProductId = makeIdFactory();
export const makeViewerAccessId = makeIdFactory();
export const makeStageAssignmentId = makeIdFactory();
export const makeSectionId = makeIdFactory();
export const makeRowId = makeIdFactory();

const STAGE_ID_BY_NAME: ReadonlyMap<string, string> = new Map(
  SEED_STAGES.map((s) => [s.name, s.id]),
);

export function stageId(name: StageName): string {
  const id = STAGE_ID_BY_NAME.get(name);
  if (!id) throw new Error(`Unknown stage name: ${name}`);
  return id;
}
