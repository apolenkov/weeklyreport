// Stage selection for authored demo rows. `demo-seed-datasets` requires every
// seeded item, risk and decision to carry a stage the section author owns on
// that row's product, otherwise the lead cannot save the populated draft at all
// (the product guard rejects the whole payload).
//
// Ownership comes from the effective assignment table for this seed run, not
// from the static row list: the `full` and `stress` profiles compose this
// dataset with the simple one over the same product ids, and a pair another
// dataset already owns must keep its owner. An explicit map fails closed — a
// missing key means the pair owns nothing. The static list stays the fallback
// only for callers that pass no map at all (unit tests without a database).

import { SEED_STAGES } from "../support/seed-constants.js";
import {
  CROSS_AUTHOR_ROWS,
  DETERMINISTIC_ROWS,
  ownershipKey,
  type StageOwnership,
  toStageOwnership,
} from "./seed-advanced.stage-assignments.js";

export { ownershipKey, toStageOwnership };
export type { StageOwnership };

const ASSIGNMENT_ROWS = [...DETERMINISTIC_ROWS, ...CROSS_AUTHOR_ROWS];

const EMPTY_OWNERSHIP = "Seed stage selection: owned stage cycle is empty";

const catalogueIndex = (stageName: string): number =>
  SEED_STAGES.findIndex((stage) => stage.name === stageName);

const requireOwned = (
  leadId: string,
  productId: string,
  ownership: StageOwnership | undefined,
): readonly string[] => {
  const names =
    ownership === undefined
      ? SEED_STAGES.filter((stage) =>
          ASSIGNMENT_ROWS.some(
            (row) =>
              row.userId === leadId &&
              row.projectId === productId &&
              row.stageId === stage.id,
          ),
        ).map((stage) => stage.name)
      : (ownership.get(ownershipKey(leadId, productId)) ?? []);
  if (names.length === 0) {
    throw new Error(
      `Seed stage selection: lead ${leadId} owns no stage on ${productId}`,
    );
  }
  return names;
};

/** Catalogue-ordered stage names the lead owns on the product. */
export const ownedStageNames = (
  leadId: string,
  productId: string,
  ownership?: StageOwnership,
): readonly string[] => requireOwned(leadId, productId, ownership);

/** Cycles the owned stages so repeated rows on one product keep varying. */
export const ownedStageNameAt = (
  leadId: string,
  productId: string,
  seed: number,
  ownership?: StageOwnership,
): string => {
  const names = requireOwned(leadId, productId, ownership);
  const name = names[seed % names.length];
  if (name === undefined) {
    throw new Error(EMPTY_OWNERSHIP);
  }
  return name;
};

/**
 * The owned stage closest to `preferred` in catalogue order, so a hand-written
 * row keeps its phase meaning when that exact stage belongs to another lead.
 * Catalogue order is the stable tie-break.
 */
export const ownedStageName = (
  leadId: string,
  productId: string,
  preferred: string,
  ownership?: StageOwnership,
): string => {
  const names = requireOwned(leadId, productId, ownership);
  if (names.includes(preferred)) {
    return preferred;
  }
  const target = catalogueIndex(preferred);
  if (target === -1) {
    return ownedStageNameAt(leadId, productId, 0, ownership);
  }
  const [closest] = [...names].sort(
    (a, b) =>
      Math.abs(catalogueIndex(a) - target) -
      Math.abs(catalogueIndex(b) - target),
  );
  if (closest === undefined) {
    throw new Error(EMPTY_OWNERSHIP);
  }
  return closest;
};
