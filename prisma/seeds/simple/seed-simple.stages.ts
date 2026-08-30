import type { PrismaClient } from "@prisma/client";

import {
  LEAD_1,
  LEAD_CLOUD_PM,
  LEAD_DEVOPS_PM,
  LEAD_DMITRY,
  LEAD_IGOR,
  LEAD_MARIA,
  LEAD_MOBILE_PM,
  LEAD_OLGA,
  LEAD_SERGEY,
  PROD_CLOUD,
  PROD_CRM,
  PROD_CRM_360,
  PROD_CRM_DATA,
  PROD_CRM_SALES,
  PROD_DEVOPS,
  PROD_HR,
  PROD_MOBILE,
  PROD_PAYMENTS,
  STAGE_ANALYSIS,
  STAGE_DESIGN,
  STAGE_DEV,
  STAGE_DEVOPS,
  STAGE_PLAN,
  STAGE_SUPPORT,
  STAGE_TEST,
} from "./seed-simple.ids.js";

const STAGE_ROWS = [
  { id: STAGE_PLAN, name: "Planning", sortOrder: 0 },
  { id: STAGE_ANALYSIS, name: "Analysis", sortOrder: 1 },
  { id: STAGE_DESIGN, name: "Design", sortOrder: 2 },
  { id: STAGE_DEV, name: "Development", sortOrder: 3 },
  { id: STAGE_TEST, name: "Testing", sortOrder: 4 },
  { id: STAGE_DEVOPS, name: "DevOps", sortOrder: 5 },
  { id: STAGE_SUPPORT, name: "Support", sortOrder: 6 },
];

const ALL_STAGE_IDS = [
  STAGE_PLAN,
  STAGE_ANALYSIS,
  STAGE_DESIGN,
  STAGE_DEV,
  STAGE_TEST,
  STAGE_DEVOPS,
  STAGE_SUPPORT,
];

// Vasily owns only the tech stages (4/7) on PROD_CRM; Boris (LEAD_MOBILE_PM)
// owns the PM stages (3/7), demonstrating cross-author read-only visibility.
const VASILY_CRM_STAGES = [STAGE_DEV, STAGE_TEST, STAGE_DEVOPS, STAGE_SUPPORT];

// Ids stay deterministic per product block so a re-run is idempotent: the last
// segment is a fixed 10-char block prefix plus the two-digit stage position.
const blockAssignmentId = (blockPrefix: string, idx: number) =>
  `b0000000-0000-4000-8000-${blockPrefix}${(idx + 1).toString().padStart(2, "0")}`;

const STAGE_ASSIGNMENT_ROWS = [
  ...VASILY_CRM_STAGES.map((stageId, idx) => ({
    id: blockAssignmentId("0000000010", idx),
    projectId: PROD_CRM,
    stageId,
    userId: LEAD_1,
  })),
  {
    id: "b0000000-0000-4000-8000-000000000002",
    projectId: PROD_MOBILE,
    stageId: STAGE_DEV,
    userId: LEAD_MARIA,
  },
  {
    id: "b0000000-0000-4000-8000-000000000003",
    projectId: PROD_CLOUD,
    stageId: STAGE_DEV,
    userId: LEAD_IGOR,
  },
  {
    id: "b0000000-0000-4000-8000-000000000004",
    projectId: PROD_DEVOPS,
    stageId: STAGE_DEV,
    userId: LEAD_DMITRY,
  },
  {
    id: "b0000000-0000-4000-8000-000000000005",
    projectId: PROD_PAYMENTS,
    stageId: STAGE_DEV,
    userId: LEAD_OLGA,
  },
  {
    id: "b0000000-0000-4000-8000-000000000006",
    projectId: PROD_HR,
    stageId: STAGE_DEV,
    userId: LEAD_SERGEY,
  },
  // PM leads own Plan + Analysis + Design on their own product (non-tech focus).
  {
    id: "b0000000-0000-4000-8000-000000000023",
    projectId: PROD_MOBILE,
    stageId: STAGE_PLAN,
    userId: LEAD_MOBILE_PM,
  },
  {
    id: "b0000000-0000-4000-8000-000000000024",
    projectId: PROD_MOBILE,
    stageId: STAGE_ANALYSIS,
    userId: LEAD_MOBILE_PM,
  },
  {
    id: "b0000000-0000-4000-8000-000000000025",
    projectId: PROD_MOBILE,
    stageId: STAGE_DESIGN,
    userId: LEAD_MOBILE_PM,
  },
  {
    id: "b0000000-0000-4000-8000-000000000026",
    projectId: PROD_CLOUD,
    stageId: STAGE_PLAN,
    userId: LEAD_CLOUD_PM,
  },
  {
    id: "b0000000-0000-4000-8000-000000000027",
    projectId: PROD_CLOUD,
    stageId: STAGE_ANALYSIS,
    userId: LEAD_CLOUD_PM,
  },
  {
    id: "b0000000-0000-4000-8000-000000000028",
    projectId: PROD_CLOUD,
    stageId: STAGE_DESIGN,
    userId: LEAD_CLOUD_PM,
  },
  {
    id: "b0000000-0000-4000-8000-000000000029",
    projectId: PROD_DEVOPS,
    stageId: STAGE_PLAN,
    userId: LEAD_DEVOPS_PM,
  },
  {
    id: "b0000000-0000-4000-8000-000000000030",
    projectId: PROD_DEVOPS,
    stageId: STAGE_ANALYSIS,
    userId: LEAD_DEVOPS_PM,
  },
  {
    id: "b0000000-0000-4000-8000-000000000031",
    projectId: PROD_DEVOPS,
    stageId: STAGE_DESIGN,
    userId: LEAD_DEVOPS_PM,
  },
  // 3-contributor split on PROD_CRM for cross-author read-only visibility.
  // Boris=Planning, Victor=Analysis, Galina=Design (@@unique([stageId, projectId])).
  {
    id: "b0000000-0000-4000-8000-000000000033",
    projectId: PROD_CRM,
    stageId: STAGE_PLAN,
    userId: LEAD_MOBILE_PM,
  },
  {
    id: "b0000000-0000-4000-8000-000000000034",
    projectId: PROD_CRM,
    stageId: STAGE_ANALYSIS,
    userId: LEAD_CLOUD_PM,
  },
  {
    id: "b0000000-0000-4000-8000-000000000035",
    projectId: PROD_CRM,
    stageId: STAGE_DESIGN,
    userId: LEAD_DEVOPS_PM,
  },
  // On PROD_CRM_SALES Boris owns STAGE_PLAN (co-author demo), so Vasily gets
  // the remaining 6 stages; on PROD_CRM_DATA and PROD_CRM_360 he owns all 7.
  ...ALL_STAGE_IDS.filter((s) => s !== STAGE_PLAN).map((stageId, idx) => ({
    id: blockAssignmentId("0000000011", idx),
    projectId: PROD_CRM_SALES,
    stageId,
    userId: LEAD_1,
  })),
  ...ALL_STAGE_IDS.map((stageId, idx) => ({
    id: blockAssignmentId("0000000012", idx),
    projectId: PROD_CRM_DATA,
    stageId,
    userId: LEAD_1,
  })),
  ...ALL_STAGE_IDS.map((stageId, idx) => ({
    id: blockAssignmentId("0000000013", idx),
    projectId: PROD_CRM_360,
    stageId,
    userId: LEAD_1,
  })),
  {
    id: "b0000000-0000-4000-8000-000000000032",
    projectId: PROD_CRM_SALES,
    stageId: STAGE_PLAN,
    userId: LEAD_MOBILE_PM,
  },
];

export async function seedStages(prisma: PrismaClient): Promise<void> {
  console.log("[seed-simple] Creating stages...");
  await prisma.stage.createMany({ data: STAGE_ROWS });
}

// A full 7-stage single-owner example exists (Vasily on PROD_CRM_DATA /
// PROD_CRM_360) so "lead assigned everywhere renders correctly on /lead/report"
// is exercised end-to-end; other leads keep a single-Development assignment.
export async function seedStageAssignments(
  prisma: PrismaClient,
): Promise<void> {
  console.log("[seed-simple] Creating stage assignments...");
  await prisma.stageAssignment.createMany({ data: STAGE_ASSIGNMENT_ROWS });
}
