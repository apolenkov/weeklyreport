// Scaffold phase: reporting group, organization, users, stages and products.

import { type PrismaClient, Role } from "@prisma/client";

import { DEFAULT_REPORTING_GROUP } from "../packages/shared/src/organization/default-reporting-group.js";
import {
  ADMIN_USER_ID,
  DEFAULT_REPORTING_GROUP_ID,
  HEAD_USER_ID,
  SEED_STAGES,
  SEED_USERS,
  VIEWER_USER_ID,
} from "./seed-constants.js";
import { HEAD_NAME } from "./seed-demo.constants.js";
import { makeGroupProductId, makeViewerAccessId } from "./seed-demo.ids.js";
import type { DemoLead, TierDataset } from "./seed-demo.types.js";

const ORGANIZATION_SHORT_NAME = "PEO";
const ORGANIZATION_FULL_NAME = "Product Engineering & Operations";

const STATIC_USER_ROWS = [
  {
    id: HEAD_USER_ID,
    email: "head@customreport.local",
    name: HEAD_NAME,
    lastName: "Климов",
    firstName: "Антон",
    middleName: "Сергеевич",
    position: "Руководитель отдела",
    role: Role.head,
    samlId: "head-1",
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  },
  {
    id: VIEWER_USER_ID,
    email: "viewer@customreport.local",
    name: "Власова Дарья Игоревна",
    lastName: "Власова",
    firstName: "Дарья",
    middleName: "Игоревна",
    position: "Директор по развитию",
    role: Role.viewer,
    samlId: "viewer-1",
    reportingGroupId: null,
  },
  {
    id: ADMIN_USER_ID,
    email: "admin@customreport.local",
    name: "Баленков Михаил Владимирович",
    lastName: "Баленков",
    firstName: "Михаил",
    middleName: "Владимирович",
    position: "Системный администратор",
    role: Role.admin,
    samlId: "admin-1",
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  },
];

function leadUserRow(lead: DemoLead) {
  const seedUser = SEED_USERS.find((u) => u.email === lead.email);
  if (!seedUser) {
    throw new Error(`Demo seed: lead ${lead.email} is not in user catalogue`);
  }
  return {
    id: lead.id,
    email: lead.email,
    name: seedUser.name,
    lastName: seedUser.lastName,
    firstName: seedUser.firstName,
    middleName: seedUser.middleName,
    position: seedUser.position,
    role: Role.lead,
    samlId: lead.samlId,
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  };
}

async function seedGroupAndOrganization(prisma: PrismaClient): Promise<void> {
  // headUserId is set AFTER users exist (FK headUserId → User).
  await prisma.reportingGroup.create({
    data: {
      id: DEFAULT_REPORTING_GROUP_ID,
      name: DEFAULT_REPORTING_GROUP.name,
      description: "Default reporting group for CustomReport demo users",
    },
  });
  await prisma.organization.upsert({
    where: { id: "singleton" },
    update: {
      shortName: ORGANIZATION_SHORT_NAME,
      fullName: ORGANIZATION_FULL_NAME,
    },
    create: {
      id: "singleton",
      shortName: ORGANIZATION_SHORT_NAME,
      fullName: ORGANIZATION_FULL_NAME,
    },
  });
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

async function seedUsers(
  prisma: PrismaClient,
  leads: readonly DemoLead[],
): Promise<void> {
  await prisma.user.createMany({
    data: [...STATIC_USER_ROWS, ...leads.map(leadUserRow)],
  });
  // Now that users exist, backfill the group leader + grant viewer access.
  await prisma.reportingGroup.update({
    where: { id: DEFAULT_REPORTING_GROUP_ID },
    data: { headUserId: HEAD_USER_ID },
  });
  await prisma.viewerGroupAccess.create({
    data: {
      id: makeViewerAccessId(),
      viewerUserId: VIEWER_USER_ID,
      groupId: DEFAULT_REPORTING_GROUP_ID,
    },
  });
}

async function seedStagesAndProducts(
  prisma: PrismaClient,
  dataset: TierDataset,
): Promise<void> {
  await prisma.stage.createMany({
    data: SEED_STAGES.map((s) => ({
      id: s.id,
      name: s.name,
      sortOrder: s.sortOrder,
    })),
  });
  await prisma.project.createMany({
    data: dataset.products.map((p) => ({
      id: p.id,
      name: p.name,
      leadId: p.leadId,
      archived: false,
    })),
  });
  await prisma.groupProduct.createMany({
    // Explicit deterministic id (not the schema's @default(uuid())) so the
    // "fixed constants, no run-time randomness in IDs" rule holds here too.
    data: dataset.products.map((p) => ({
      id: makeGroupProductId(),
      groupId: DEFAULT_REPORTING_GROUP_ID,
      productId: p.id,
    })),
    skipDuplicates: true,
  });
}

export async function seedScaffold(
  prisma: PrismaClient,
  dataset: TierDataset,
): Promise<void> {
  await seedGroupAndOrganization(prisma);
  await seedUsers(prisma, dataset.leads);
  await seedStagesAndProducts(prisma, dataset);
}
