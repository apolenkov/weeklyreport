// Deterministic ID factories for the demo seed — fixed, run-stable IDs for
// demo-only rows. Canonical IDs (head/leads/products/stages/reports/group) are
// reused from seed-constants; only sections/items/statuses/etc. get these.
// Every id is a PURE function of its owner's fixture position: the caller
// passes explicit (lead, contribution, row) indices, so reordering unrelated
// calls cannot change the identity graph (no shared mutable counter).

import { SEED_STAGES } from "../support/seed-constants.js";
import type { StageName } from "./seed-demo.types.js";

const ID_TAIL_RADIX = 16;
const ID_TAIL_LENGTH = 12;
// Each factory owns one full 32-bit block of the 48-bit tail, so ids from
// different factories never collide regardless of index.
const TAIL_BLOCK_BITS = 0x1_00_00_00_00;

function makeIdFactory(block: number): (index: number) => string {
  return (index: number): string => {
    const tail = (block + index)
      .toString(ID_TAIL_RADIX)
      .padStart(ID_TAIL_LENGTH, "0");
    return `d0000000-0000-4000-8000-${tail}`;
  };
}

const GROUP_PRODUCT_BLOCK = 0;
const VIEWER_ACCESS_BLOCK = 1;
const STAGE_ASSIGNMENT_BLOCK = 2;
const SECTION_BLOCK = 3;
const ROW_BLOCK = 4;

export const makeGroupProductId = makeIdFactory(
  GROUP_PRODUCT_BLOCK * TAIL_BLOCK_BITS,
);
export const makeViewerAccessId = makeIdFactory(
  VIEWER_ACCESS_BLOCK * TAIL_BLOCK_BITS,
);
export const makeStageAssignmentId = makeIdFactory(
  STAGE_ASSIGNMENT_BLOCK * TAIL_BLOCK_BITS,
);
export const makeSectionId = makeIdFactory(SECTION_BLOCK * TAIL_BLOCK_BITS);
export const makeRowId = makeIdFactory(ROW_BLOCK * TAIL_BLOCK_BITS);

// makeRowId serves several tables (projectStatus, stageStatus, item, risk,
// decision, activity rows), so its block is sub-divided by table and writer:
// the active-period writer, the prior-period writer and the activity writer
// each start their own band, and within a band each row kind has its own slot.
const ACTIVE_WRITER = 0x0;
const PRIOR_WRITER = 0x8_00_00_00;
const ACTIVITY_WRITER = 0x10_00_00_00;

const PROJECT_STATUS_SLOT = 0x0;
const STAGE_STATUS_SLOT = 0x10_00_00;
const ITEM_SLOT = 0x20_00_00;
const RISK_SLOT = 0x30_00_00;
const DECISION_SLOT = 0x40_00_00;

const LEAD_STRIDE = 0x10_00;
const CONTRIBUTION_STRIDE = 0x1_00;
// One slot per activity row kind, inside the activity writer's band, so every
// activity's rows stay distinct.
const ACTIVITY_PRODUCT_LINK_SLOT = 1;
const ACTIVITY_LEAD_LINK_SLOT = 2;
const ACTIVITY_STATUS_SLOT = 3;
const ACTIVITY_ITEM_SLOT = 4;
const ACTIVITY_RISK_SLOT = 5;
const ACTIVITY_DECISION_SLOT = 6;

// ── Active-period rows (seed-demo.sections.ts) ──────────────────────────────
// Section rows live in their own factory block; the active writer occupies the
// low band, prior sections the band above it.
export const ACTIVE_SECTION_INDEX = 0x0;
export const PRIOR_SECTION_INDEX = 0x10_00_00;

export const activeSectionId = (leadIdx: number): string =>
  makeSectionId(ACTIVE_SECTION_INDEX + leadIdx);
export const priorSectionId = (reportIdx: number, leadIdx: number): string =>
  makeSectionId(PRIOR_SECTION_INDEX + reportIdx * LEAD_STRIDE + leadIdx);

export const activeProjectStatusId = (
  leadIdx: number,
  contributionIdx: number,
): string =>
  makeRowId(
    ACTIVE_WRITER +
      PROJECT_STATUS_SLOT +
      leadIdx * LEAD_STRIDE +
      contributionIdx,
  );
export const activeStageStatusId = (
  leadIdx: number,
  contributionIdx: number,
  stageIdx: number,
): string =>
  makeRowId(
    ACTIVE_WRITER +
      STAGE_STATUS_SLOT +
      leadIdx * LEAD_STRIDE +
      contributionIdx * CONTRIBUTION_STRIDE +
      stageIdx,
  );
export const activeItemId = (
  leadIdx: number,
  contributionIdx: number,
  itemIdx: number,
): string =>
  makeRowId(
    ACTIVE_WRITER +
      ITEM_SLOT +
      leadIdx * LEAD_STRIDE +
      contributionIdx * CONTRIBUTION_STRIDE +
      itemIdx,
  );
export const activeRiskId = (
  leadIdx: number,
  contributionIdx: number,
): string =>
  makeRowId(
    ACTIVE_WRITER + RISK_SLOT + leadIdx * LEAD_STRIDE + contributionIdx,
  );
export const activeDecisionId = (
  leadIdx: number,
  contributionIdx: number,
): string =>
  makeRowId(
    ACTIVE_WRITER + DECISION_SLOT + leadIdx * LEAD_STRIDE + contributionIdx,
  );

// ── Prior-period rows (seed-demo.prior-sections.ts) ────────────────────────
export const priorProjectStatusId = (
  reportIdx: number,
  leadIdx: number,
  contributionIdx: number,
): string =>
  makeRowId(
    PRIOR_WRITER +
      PROJECT_STATUS_SLOT +
      reportIdx * LEAD_STRIDE +
      leadIdx * CONTRIBUTION_STRIDE +
      contributionIdx,
  );
export const priorItemId = (
  reportIdx: number,
  leadIdx: number,
  contributionIdx: number,
): string =>
  makeRowId(
    PRIOR_WRITER +
      ITEM_SLOT +
      reportIdx * LEAD_STRIDE +
      leadIdx * CONTRIBUTION_STRIDE +
      contributionIdx,
  );

// ── Activity rows (seed-demo.activities.ts) ────────────────────────────────
export const activityId = (activityIdx: number): string =>
  makeRowId(ACTIVITY_WRITER + activityIdx * CONTRIBUTION_STRIDE);
export const activityProductLinkId = (activityIdx: number): string =>
  makeRowId(
    ACTIVITY_WRITER +
      ACTIVITY_PRODUCT_LINK_SLOT * CONTRIBUTION_STRIDE +
      activityIdx * CONTRIBUTION_STRIDE,
  );
export const activityLeadLinkId = (activityIdx: number): string =>
  makeRowId(
    ACTIVITY_WRITER +
      ACTIVITY_LEAD_LINK_SLOT * CONTRIBUTION_STRIDE +
      activityIdx * CONTRIBUTION_STRIDE,
  );
export const activityStatusId = (activityIdx: number): string =>
  makeRowId(
    ACTIVITY_WRITER +
      ACTIVITY_STATUS_SLOT * CONTRIBUTION_STRIDE +
      activityIdx * CONTRIBUTION_STRIDE,
  );
export const activityItemId = (activityIdx: number, itemIdx: number): string =>
  makeRowId(
    ACTIVITY_WRITER +
      ACTIVITY_ITEM_SLOT * CONTRIBUTION_STRIDE +
      activityIdx * CONTRIBUTION_STRIDE +
      itemIdx,
  );
export const activityRiskId = (activityIdx: number): string =>
  makeRowId(
    ACTIVITY_WRITER +
      ACTIVITY_RISK_SLOT * CONTRIBUTION_STRIDE +
      activityIdx * CONTRIBUTION_STRIDE,
  );
export const activityDecisionId = (activityIdx: number): string =>
  makeRowId(
    ACTIVITY_WRITER +
      ACTIVITY_DECISION_SLOT * CONTRIBUTION_STRIDE +
      activityIdx * CONTRIBUTION_STRIDE,
  );

const STAGE_ID_BY_NAME: ReadonlyMap<string, string> = new Map(
  SEED_STAGES.map((s) => [s.name, s.id]),
);

export function stageId(name: StageName): string {
  const id = STAGE_ID_BY_NAME.get(name);
  if (!id) throw new Error(`Unknown stage name: ${name}`);
  return id;
}
