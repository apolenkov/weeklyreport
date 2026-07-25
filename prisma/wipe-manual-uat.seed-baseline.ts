// Manual-UAT baseline: the two reporting groups, their users, the six active
// products, the SDLC stages and the singleton org/settings rows. IDs come from
// seed-constants wherever one exists so E2E specs keep matching by name.

import { type Prisma, Role } from "@prisma/client";

import {
  DEFAULT_REPORTING_GROUP_ID,
  HEAD_USER_ID,
  LEAD_1_ID,
  LEAD_DMITRY_ID,
  LEAD_IGOR_ID,
  LEAD_MARIA_ID,
  LEAD_OLGA_ID,
  LEAD_SERGEY_ID,
  SEED_USERS,
  VIEWER_USER_ID,
} from "./seed-constants.js";

// Extra users/group so the wipe lands with two groups (admin + finance head/lead).
const FINANCE_HEAD_USER_ID = "a0000000-0000-4000-8000-000000000095";
export const FINANCE_LEAD_USER_ID = "a0000000-0000-4000-8000-000000000094";
const FINANCE_GROUP_ID = "a0000000-0000-4000-8000-000000000302";
const VIEWER_GROUP_ACCESS_ID = "a0000000-0000-4000-8000-000000000901";

// 6 active products (one per primary lead). IDs match the canonical
// `seed-simple.ts` mapping so existing E2E specs (DevOps-инструменты, etc.)
// keep working without rename churn.
const PROD_CRM = "a0000000-0000-4000-8000-000000000201"; // Маркетинговый портал → LEAD_1
const PROD_MOBILE = "a0000000-0000-4000-8000-000000000203"; // Платформа интеграций → Мария
const PROD_CLOUD = "a0000000-0000-4000-8000-000000000205"; // Внутренний BI → Игорь
const PROD_DEVOPS = "a0000000-0000-4000-8000-000000000207"; // DevOps-инструменты → Дмитрий
const PROD_PAYMENTS = "a0000000-0000-4000-8000-000000000209"; // Платёжный шлюз → Ольга
const PROD_HR = "a0000000-0000-4000-8000-00000000020b"; // HR-система → Сергей

const STAGE_PLAN = "a0000000-0000-4000-8000-000000000701";
const STAGE_ANALYSIS = "a0000000-0000-4000-8000-000000000702";
const STAGE_DESIGN = "a0000000-0000-4000-8000-000000000703";
const STAGE_DEV = "a0000000-0000-4000-8000-000000000704";
const STAGE_TEST = "a0000000-0000-4000-8000-000000000705";
const STAGE_DEVOPS = "a0000000-0000-4000-8000-000000000706";
const STAGE_SUPPORT = "a0000000-0000-4000-8000-000000000707";

// The canonical leads reassigned to Finance, so the second group is not a ghost.
const FINANCE_LEAD_IDS: ReadonlySet<string> = new Set([
  LEAD_OLGA_ID,
  LEAD_SERGEY_ID,
]);

const FINANCE_STAFF = [
  {
    id: FINANCE_HEAD_USER_ID,
    email: "finance-head@customreport.local",
    name: "Наталья П.",
    lastName: "Наталья",
    firstName: "П",
    middleName: null,
    position: null,
    role: Role.head,
    samlId: "finance-head-1",
    reportingGroupId: FINANCE_GROUP_ID,
  },
  {
    id: FINANCE_LEAD_USER_ID,
    email: "finance-lead@customreport.local",
    name: "Артём З.",
    lastName: "Артём",
    firstName: "З",
    middleName: null,
    position: null,
    role: Role.lead,
    samlId: "finance-lead-1",
    reportingGroupId: FINANCE_GROUP_ID,
  },
];

const UAT_PRODUCTS = [
  { id: PROD_CRM, name: "Маркетинговый портал", leadId: LEAD_1_ID },
  { id: PROD_MOBILE, name: "Платформа интеграций", leadId: LEAD_MARIA_ID },
  { id: PROD_CLOUD, name: "Внутренний BI", leadId: LEAD_IGOR_ID },
  { id: PROD_DEVOPS, name: "DevOps-инструменты", leadId: LEAD_DMITRY_ID },
  { id: PROD_PAYMENTS, name: "Платёжный шлюз", leadId: LEAD_OLGA_ID },
  { id: PROD_HR, name: "HR-система", leadId: LEAD_SERGEY_ID },
];

const UAT_STAGES = [
  { id: STAGE_PLAN, name: "Planning", sortOrder: 0 },
  { id: STAGE_ANALYSIS, name: "Analysis", sortOrder: 1 },
  { id: STAGE_DESIGN, name: "Design", sortOrder: 2 },
  { id: STAGE_DEV, name: "Development", sortOrder: 3 },
  { id: STAGE_TEST, name: "Testing", sortOrder: 4 },
  { id: STAGE_DEVOPS, name: "DevOps", sortOrder: 5 },
  { id: STAGE_SUPPORT, name: "Support", sortOrder: 6 },
];

// Non-primary leads own only Development of their product, so the SDLC
// pipeline picker has data for every product.
const DEV_STAGE_OWNERS = [
  {
    id: "b0000000-0000-4000-8000-000000000002",
    projectId: PROD_MOBILE,
    userId: LEAD_MARIA_ID,
  },
  {
    id: "b0000000-0000-4000-8000-000000000003",
    projectId: PROD_CLOUD,
    userId: LEAD_IGOR_ID,
  },
  {
    id: "b0000000-0000-4000-8000-000000000004",
    projectId: PROD_DEVOPS,
    userId: LEAD_DMITRY_ID,
  },
  {
    id: "b0000000-0000-4000-8000-000000000005",
    projectId: PROD_PAYMENTS,
    userId: LEAD_OLGA_ID,
  },
  {
    id: "b0000000-0000-4000-8000-000000000006",
    projectId: PROD_HR,
    userId: LEAD_SERGEY_ID,
  },
];

// The primary lead owns all 7 CRM stages; their assignment UUIDs occupy the
// ...1001-...1007 block so a reseed reproduces the same rows.
const CRM_ASSIGNMENT_ID_PREFIX = "b0000000-0000-4000-8000-0000000010";

// Two groups so head dashboards have a realistic «pick a group» state.
// headUserId is wired below after Users are created.
async function seedReportingGroups(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.reportingGroup.createMany({
    data: [
      {
        id: DEFAULT_REPORTING_GROUP_ID,
        name: "Core Development",
        description: "Default reporting group for CustomReport demo users",
      },
      {
        id: FINANCE_GROUP_ID,
        name: "Finance",
        description: "Secondary demo group",
      },
    ],
  });
}

async function seedUsers(tx: Prisma.TransactionClient): Promise<void> {
  await tx.user.createMany({
    data: [
      ...SEED_USERS.map((user) => ({
        ...user,
        reportingGroupId: FINANCE_LEAD_IDS.has(user.id)
          ? FINANCE_GROUP_ID
          : user.reportingGroupId,
      })),
      ...FINANCE_STAFF,
    ],
  });
}

// Wire group leaders now that the FK targets exist, then give the viewer
// read-only access to the default group so /viewer/* lands on a non-empty
// dashboard.
async function seedGroupLeadershipAndAccess(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.reportingGroup.update({
    where: { id: DEFAULT_REPORTING_GROUP_ID },
    data: { headUserId: HEAD_USER_ID },
  });
  await tx.reportingGroup.update({
    where: { id: FINANCE_GROUP_ID },
    data: { headUserId: FINANCE_HEAD_USER_ID },
  });

  await tx.viewerGroupAccess.create({
    data: {
      id: VIEWER_GROUP_ACCESS_ID,
      viewerUserId: VIEWER_USER_ID,
      groupId: DEFAULT_REPORTING_GROUP_ID,
    },
  });
}

async function seedProducts(tx: Prisma.TransactionClient): Promise<void> {
  await tx.project.createMany({
    data: UAT_PRODUCTS.map((product) => ({ ...product, archived: false })),
  });
}

// Current invariant is one owning group per product. Keep the demo split
// aligned with the seeded lead's reporting group so Products, Groups,
// dashboard scoping, and viewer access all tell the same story.
async function seedGroupLinks(tx: Prisma.TransactionClient): Promise<void> {
  await tx.groupProduct.createMany({
    data: UAT_PRODUCTS.map((product) => ({
      groupId: FINANCE_LEAD_IDS.has(product.leadId)
        ? FINANCE_GROUP_ID
        : DEFAULT_REPORTING_GROUP_ID,
      productId: product.id,
    })),
  });
}

async function seedStages(tx: Prisma.TransactionClient): Promise<void> {
  await tx.stage.createMany({ data: UAT_STAGES });
}

async function seedStageAssignments(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.stageAssignment.createMany({
    data: [
      ...UAT_STAGES.map((stage, index) => ({
        id: `${CRM_ASSIGNMENT_ID_PREFIX}${(index + 1).toString().padStart(2, "0")}`,
        projectId: PROD_CRM,
        stageId: stage.id,
        userId: LEAD_1_ID,
      })),
      ...DEV_STAGE_OWNERS.map((owner) => ({ ...owner, stageId: STAGE_DEV })),
    ],
  });
}

async function seedOrganizationAndSettings(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.organization.create({
    data: {
      id: "singleton",
      shortName: "PEO",
      fullName: "Product Engineering & Operations",
    },
  });

  // Empty `data` hydrates every column from its @default(...) so future
  // schema additions don't silently drift.
  await tx.appSettings.create({ data: { id: "singleton" } });
}

// FK-safe order: groups before users, users before the leadership back-links,
// products before the group links that reference them.
export async function seedBaseline(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await seedReportingGroups(tx);
  await seedUsers(tx);
  await seedGroupLeadershipAndAccess(tx);
  await seedProducts(tx);
  await seedGroupLinks(tx);
  await seedStages(tx);
  await seedStageAssignments(tx);
  await seedOrganizationAndSettings(tx);
}
