import { LEAD_SLOT_PRIMARY } from "../../prisma/seed-advanced.anchors.js";
import {
  PUBLISHED_SUFFIX,
  sectionId as advancedSectionId,
} from "../../prisma/seed-advanced.ids.js";
import * as seed from "../../prisma/seed-constants.js";
import { publishedSectionId } from "../../prisma/seed-simple.history.js";
import type { RouteBindingTarget, SeedProfile } from "./contracts.ts";

const MINIMAL_SECTION_ID = "f0000000-0000-4000-8000-000000000005";
const DEMO_SECTION_ID = "a0000000-0000-4000-8000-000000000401";
const FULL_SECTION_ID = "a0000000-0000-4000-8000-000000004011";

function firstId(
  values: readonly { readonly id: string }[],
  label: string,
): string {
  const value = values.at(0);
  if (!value) throw new Error(`Runtime sweep seed is missing ${label}`);
  return value.id;
}

const PRODUCT_ID = firstId(seed.SEED_PRODUCTS, "a target product");
const ALL_STAGE_IDS = Object.freeze(seed.SEED_STAGES.map(({ id }) => id));
const FIRST_STAGE_ID = firstId(seed.SEED_STAGES, "a stage");

export type StateTarget = Readonly<{
  routeTarget: RouteBindingTarget;
  reportId: string;
  sectionId: string;
  projectId: string;
  ownerId: string;
  stageIds: readonly string[];
  foreignOwnerIds: readonly string[];
  groupId: string;
}>;

function makeTarget(
  routeTarget: RouteBindingTarget,
  sectionId: string,
  stageIds: readonly string[],
): StateTarget {
  return {
    routeTarget,
    reportId:
      routeTarget === "published"
        ? seed.PUBLISHED_REPORT_ID
        : seed.ACTIVE_REPORT_ID,
    sectionId,
    projectId: PRODUCT_ID,
    ownerId: seed.LEAD_1_ID,
    stageIds,
    foreignOwnerIds: Object.freeze([seed.LEAD_MARIA_ID, seed.LEAD_IGOR_ID]),
    groupId: seed.DEFAULT_REPORTING_GROUP_ID,
  };
}

const ACTIVE_SECTION_IDS: Readonly<Record<SeedProfile, string>> = {
  minimal: MINIMAL_SECTION_ID,
  demo: DEMO_SECTION_ID,
  full: FULL_SECTION_ID,
  stress: FULL_SECTION_ID,
};
const PUBLISHED_SECTION_IDS: Readonly<Record<SeedProfile, string>> = {
  minimal: MINIMAL_SECTION_ID,
  demo: publishedSectionId(0),
  full: advancedSectionId(PUBLISHED_SUFFIX, LEAD_SLOT_PRIMARY),
  stress: advancedSectionId(PUBLISHED_SUFFIX, LEAD_SLOT_PRIMARY),
};
const PROFILE_STAGE_IDS: Readonly<Record<SeedProfile, readonly string[]>> = {
  minimal: Object.freeze([FIRST_STAGE_ID]),
  demo: ALL_STAGE_IDS,
  full: ALL_STAGE_IDS,
  stress: ALL_STAGE_IDS,
};

export function targetFor(
  profile: SeedProfile,
  routeTarget: RouteBindingTarget,
): StateTarget {
  const sectionIds =
    routeTarget === "published" ? PUBLISHED_SECTION_IDS : ACTIVE_SECTION_IDS;
  return makeTarget(
    routeTarget,
    sectionIds[profile],
    PROFILE_STAGE_IDS[profile],
  );
}
