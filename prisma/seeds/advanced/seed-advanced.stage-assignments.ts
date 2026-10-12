import type { PrismaClient } from "@prisma/client";

import {
  LEAD_1_ID,
  LEAD_IGOR_ID,
  LEAD_MARIA_ID,
  LEAD_OLGA_ID,
  SEED_PRODUCTS,
  SEED_STAGES,
} from "../support/seed-constants.js";
import {
  PRODUCT_MARKETING_PORTAL,
  PRODUCT_PAYMENT_GATEWAY,
  STAGE_DEVOPS,
  STAGE_PLANNING,
  STAGE_SUPPORT,
  STAGE_TESTING,
} from "./seed-advanced.anchors.js";
import { CONSECUTIVE_STAGE_OFFSETS, stageAt } from "./seed-advanced.cycles.js";
import { stageAssignmentId } from "./seed-advanced.ids.js";

interface AssignmentRow {
  readonly id: string;
  readonly userId: string;
  readonly stageId: string;
  readonly projectId: string;
}

// Every product gets its lead assigned to three consecutive catalogue stages;
// the cyclic lookup reuses stages when products outnumber the catalogue.
export const DETERMINISTIC_ROWS: readonly AssignmentRow[] =
  SEED_PRODUCTS.flatMap((product, productIdx) =>
    CONSECUTIVE_STAGE_OFFSETS.map((offset) => ({
      id: stageAssignmentId(productIdx, offset),
      userId: product.leadId,
      stageId: stageAt(productIdx + offset).id,
      projectId: product.id,
    })),
  );

// Igor and Maria contribute to the primary lead's Marketing portal (he owns
// Planning/Analysis/Design, so Testing and DevOps are free), and the primary
// lead contributes to Olga's Payment gateway — that pair drives the "Other
// contributors" strip and the locked cross-author chips in her view.
export const CROSS_AUTHOR_ROWS: readonly AssignmentRow[] = [
  {
    id: "a0000000-0000-4000-8000-00000000ca01",
    userId: LEAD_IGOR_ID,
    stageId: STAGE_TESTING,
    projectId: PRODUCT_MARKETING_PORTAL,
  },
  {
    id: "a0000000-0000-4000-8000-00000000ca02",
    userId: LEAD_MARIA_ID,
    stageId: STAGE_DEVOPS,
    projectId: PRODUCT_MARKETING_PORTAL,
  },
  {
    id: "a0000000-0000-4000-8000-00000000ca03",
    userId: LEAD_1_ID,
    stageId: STAGE_SUPPORT,
    projectId: PRODUCT_PAYMENT_GATEWAY,
  },
  {
    id: "a0000000-0000-4000-8000-00000000ca04",
    userId: LEAD_1_ID,
    stageId: STAGE_PLANNING,
    projectId: PRODUCT_PAYMENT_GATEWAY,
  },
  // Olga owns Testing + DevOps on the Payment gateway with no stageStatus, so
  // deriveEffectiveStageStatus lets risk/item severity drive the chip color.
  {
    id: "a0000000-0000-4000-8000-00000000ca05",
    userId: LEAD_OLGA_ID,
    stageId: STAGE_TESTING,
    projectId: PRODUCT_PAYMENT_GATEWAY,
  },
  {
    id: "a0000000-0000-4000-8000-00000000ca06",
    userId: LEAD_OLGA_ID,
    stageId: STAGE_DEVOPS,
    projectId: PRODUCT_PAYMENT_GATEWAY,
  },
];

async function upsertAssignment(
  prisma: PrismaClient,
  row: AssignmentRow,
): Promise<void> {
  await prisma.stageAssignment.upsert({
    where: {
      stageId_projectId: { stageId: row.stageId, projectId: row.projectId },
    },
    update: {},
    create: row,
  });
}

const KEY_SEPARATOR = "|";

/** Effective stage ownership for one seed run, keyed by lead and product. */
export type StageOwnership = ReadonlyMap<string, readonly string[]>;

export const ownershipKey = (leadId: string, productId: string): string =>
  `${leadId}${KEY_SEPARATOR}${productId}`;

/** Catalogue-ordered names from a set of `(lead, product) -> stageIds`. */
export const toStageOwnership = (
  rows: readonly {
    readonly userId: string;
    readonly projectId: string;
    readonly stageId: string;
  }[],
): StageOwnership => {
  const byKey = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = ownershipKey(row.userId, row.projectId);
    const assigned = byKey.get(key) ?? new Set<string>();
    assigned.add(row.stageId);
    byKey.set(key, assigned);
  }
  return new Map(
    [...byKey].map(([key, assigned]) => [
      key,
      SEED_STAGES.filter((stage) => assigned.has(stage.id)).map(
        (stage) => stage.name,
      ),
    ]),
  );
};

/**
 * Seeds the per-product stage ownership plus the hand-written cross-author
 * rows. A `(stage, product)` pair another dataset already owns keeps its
 * owner — the composed `full`/`stress` profiles run the simple dataset first
 * over the same product ids — so the effective ownership is read back from
 * the table, not assumed from the planned rows. `count` stays the planned
 * deterministic set; cross-author demo rows are excluded from it.
 */
export async function seedStageAssignments(
  prisma: PrismaClient,
): Promise<{ ownership: StageOwnership; count: number }> {
  for (const row of [...DETERMINISTIC_ROWS, ...CROSS_AUTHOR_ROWS]) {
    const existing = await prisma.stageAssignment.findUnique({
      where: {
        stageId_projectId: {
          stageId: row.stageId,
          projectId: row.projectId,
        },
      },
    });
    if (existing !== null) continue;
    await upsertAssignment(prisma, row);
  }
  const rows = await prisma.stageAssignment.findMany();
  return {
    ownership: toStageOwnership(rows),
    count: DETERMINISTIC_ROWS.length,
  };
}
