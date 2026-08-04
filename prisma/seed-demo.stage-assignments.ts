// Ownership: each section's lead owns its declared stages on its product.
// `@@unique([stageId, projectId])` allows one owner per (stage, product), so
// the first section claiming a pair wins and later duplicates are dropped —
// the fold keeps that first-wins order, which the row-id sequence depends on.

import type { PrismaClient } from "@prisma/client";

import { makeStageAssignmentId, stageId } from "./seed-demo.ids.js";
import type { DemoSection } from "./seed-demo.types.js";

interface StageAssignmentRow {
  id: string;
  projectId: string;
  stageId: string;
  userId: string;
}

interface Claimed {
  keys: ReadonlySet<string>;
  rows: readonly StageAssignmentRow[];
}

// Id comes from the flatMap position of the (section, stage) pair, not a
// shared counter, so row identity is a pure function of fixture order.
function claim(
  acc: Claimed,
  section: DemoSection,
  stage: string,
  pairIndex: number,
): Claimed {
  const id = stageId(stage);
  const key = `${id}:${section.productId}`;
  if (acc.keys.has(key)) return acc;
  return {
    keys: new Set([...acc.keys, key]),
    rows: [
      ...acc.rows,
      {
        id: makeStageAssignmentId(pairIndex),
        projectId: section.productId,
        stageId: id,
        userId: section.leadId,
      },
    ],
  };
}

export async function seedStageAssignments(
  prisma: PrismaClient,
  sections: readonly DemoSection[],
): Promise<void> {
  const { rows } = sections
    .flatMap((section) =>
      section.ownedStages.map((stage) => ({ section, stage })),
    )
    .map((pair, pairIndex) => ({ ...pair, pairIndex }))
    .reduce<Claimed>(
      (acc, { section, stage, pairIndex }) =>
        claim(acc, section, stage, pairIndex),
      { keys: new Set<string>(), rows: [] },
    );
  await prisma.stageAssignment.createMany({ data: [...rows] });
}
