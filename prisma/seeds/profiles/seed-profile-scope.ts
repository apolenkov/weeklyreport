import type { PrismaClient } from "@prisma/client";

import {
  LEAD_ACTIVITY_ONLY,
  LEAD_CLOUD_PM,
  LEAD_DEVOPS_PM,
  LEAD_MOBILE_PM,
  PROD_CRM,
  PROD_CRM_360,
  PROD_CRM_DATA,
  PROD_CRM_SALES,
} from "../simple/seed-simple.ids.js";
import { STRESS_PROJECT_IDS } from "../stress/seed-stress-ids.js";
import {
  ACTIVE_REPORT_ID,
  ADMIN_USER_ID,
  HEAD_USER_ID,
  LEAD_1_ID,
  LEAD_DMITRY_ID,
  LEAD_IGOR_ID,
  LEAD_MARIA_ID,
  LEAD_OLGA_ID,
  LEAD_SERGEY_ID,
  PUBLISHED_REPORT_ID,
  SEED_PRODUCTS,
  VIEWER_USER_ID,
} from "../support/seed-constants.js";
import type {
  SeedCountDimension,
  SeedProfile,
} from "./seed-profile-contract.js";

export interface SeedProfileScope {
  readonly userIds: readonly string[];
  readonly projectIds: readonly string[];
  readonly reportIds: readonly string[];
}

const CORE_USER_IDS = [
  HEAD_USER_ID,
  VIEWER_USER_ID,
  ADMIN_USER_ID,
  LEAD_1_ID,
] as const;

const MINIMAL_USER_IDS = [...CORE_USER_IDS, LEAD_MARIA_ID] as const;

const DEMO_USER_IDS = [
  ...MINIMAL_USER_IDS,
  LEAD_IGOR_ID,
  LEAD_DMITRY_ID,
  LEAD_OLGA_ID,
  LEAD_SERGEY_ID,
  LEAD_MOBILE_PM,
  LEAD_CLOUD_PM,
  LEAD_DEVOPS_PM,
  LEAD_ACTIVITY_ONLY,
] as const;

// One product per primary lead (the catalogue's even-indexed rows), plus the
// three demo CRM extras. Addressed by stable named id, not position: a
// reordered or shortened SEED_PRODUCTS must fail loudly instead of silently
// dropping products from the profile scope.
const CANONICAL_DEMO_PRODUCT_IDS = [
  "a0000000-0000-4000-8000-000000000201",
  "a0000000-0000-4000-8000-000000000203",
  "a0000000-0000-4000-8000-000000000205",
  "a0000000-0000-4000-8000-000000000207",
  "a0000000-0000-4000-8000-000000000209",
  "a0000000-0000-4000-8000-00000000020b",
] as const;

export function assertCanonicalProduct(id: string): string {
  if (!SEED_PRODUCTS.some((product) => product.id === id)) {
    throw new Error(
      `Seed profile scope: canonical product ${id} is missing from SEED_PRODUCTS`,
    );
  }
  return id;
}

const DEMO_PROJECT_IDS = [
  ...CANONICAL_DEMO_PRODUCT_IDS.map(assertCanonicalProduct),
  PROD_CRM_SALES,
  PROD_CRM_DATA,
  PROD_CRM_360,
] as const;

const FULL_PROJECT_IDS = [
  ...new Set([...DEMO_PROJECT_IDS, ...SEED_PRODUCTS.map(({ id }) => id)]),
];

const DEMO_REPORT_IDS = [
  ACTIVE_REPORT_ID,
  PUBLISHED_REPORT_ID,
  "a0000000-0000-4000-8000-000000000003",
  "a0000000-0000-4000-8000-000000000004",
  "a0000000-0000-4000-8000-000000000005",
  "a0000000-0000-4000-8000-000000000006",
  "a0000000-0000-4000-8000-000000000007",
  "a0000000-0000-4000-8000-000000000008",
] as const;

export const SEED_PROFILE_SCOPES = {
  minimal: {
    userIds: MINIMAL_USER_IDS,
    projectIds: [PROD_CRM],
    reportIds: [ACTIVE_REPORT_ID],
  },
  demo: {
    userIds: DEMO_USER_IDS,
    projectIds: DEMO_PROJECT_IDS,
    reportIds: DEMO_REPORT_IDS,
  },
  full: {
    userIds: DEMO_USER_IDS,
    projectIds: FULL_PROJECT_IDS,
    reportIds: DEMO_REPORT_IDS,
  },
  stress: {
    userIds: DEMO_USER_IDS,
    projectIds: [...FULL_PROJECT_IDS, ...STRESS_PROJECT_IDS],
    reportIds: DEMO_REPORT_IDS,
  },
} as const satisfies Record<SeedProfile, SeedProfileScope>;

export type SeedProfileCounts = Record<SeedCountDimension, number>;

export async function collectScopedSeedCounts(
  prisma: PrismaClient,
  profile: SeedProfile,
): Promise<SeedProfileCounts> {
  const scope = SEED_PROFILE_SCOPES[profile];
  const [users, projects, reports, sections, items] = await Promise.all([
    prisma.user.count({ where: { id: { in: [...scope.userIds] } } }),
    prisma.project.count({ where: { id: { in: [...scope.projectIds] } } }),
    prisma.report.count({ where: { id: { in: [...scope.reportIds] } } }),
    prisma.reportSection.count({
      where: { reportId: { in: [...scope.reportIds] } },
    }),
    prisma.item.count({
      where: {
        reportSection: { reportId: { in: [...scope.reportIds] } },
      },
    }),
  ]);
  return { users, projects, reports, sections, items };
}
