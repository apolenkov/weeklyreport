import type { PrismaClient } from "@prisma/client";
import { Role } from "@prisma/client";

import type { SeedUser } from "./seed-constants.js";
import {
  ADMIN_USER_ID,
  DEFAULT_REPORTING_GROUP_ID,
  HEAD_USER_ID,
  LEAD_OLGA_ID,
  LEAD_SERGEY_ID,
  SEED_PRODUCTS,
  SEED_REPORTING_GROUPS,
  SEED_STAGES,
  SEED_USERS,
  VIEWER_USER_ID,
} from "./seed-constants.js";

// Second reporting group, owned by the admin: Olga and Sergey report into it so
// the advanced dataset exercises multi-group grouping and viewer access.
export const ADVANCED_FINANCE_GROUP_ID = "a0000000-0000-4000-8000-000000000302";

const ADVANCED_FINANCE_GROUP = {
  name: "Finance Platforms",
  description: "Payments, HR, and compliance-heavy delivery stream",
  archived: false,
};

export interface SeedOrganizationCounts {
  readonly groups: number;
  readonly users: number;
  readonly products: number;
  readonly stages: number;
  readonly viewerGroupAccesses: number;
}

// Map seed user role string to Prisma Role enum. Typed from SeedUser so the
// seed tree keeps a single literal mirror (see SeedUser.role in seed-constants).
function toRole(role: SeedUser["role"]): Role {
  return Role[role];
}

async function seedReportingGroups(prisma: PrismaClient): Promise<void> {
  for (const group of SEED_REPORTING_GROUPS) {
    await prisma.reportingGroup.upsert({
      where: { id: group.id },
      update: {
        name: group.name,
        description: group.description,
        archived: false,
      },
      create: {
        id: group.id,
        name: group.name,
        description: group.description,
        archived: false,
      },
    });
  }

  await prisma.reportingGroup.upsert({
    where: { id: ADVANCED_FINANCE_GROUP_ID },
    update: ADVANCED_FINANCE_GROUP,
    create: { id: ADVANCED_FINANCE_GROUP_ID, ...ADVANCED_FINANCE_GROUP },
  });
}

function groupIdForUser(user: SeedUser): string | null {
  return user.id === LEAD_OLGA_ID || user.id === LEAD_SERGEY_ID
    ? ADVANCED_FINANCE_GROUP_ID
    : user.reportingGroupId;
}

// 1 head, 1 admin, 1 viewer, 6 leads.
async function seedUsers(prisma: PrismaClient): Promise<void> {
  for (const user of SEED_USERS) {
    const fields = {
      id: user.id,
      name: user.name,
      lastName: user.lastName,
      firstName: user.firstName,
      middleName: user.middleName,
      position: user.position,
      role: toRole(user.role),
      samlId: user.samlId,
      reportingGroupId: groupIdForUser(user),
    };

    await prisma.user.upsert({
      where: { email: user.email },
      update: fields,
      create: { ...fields, email: user.email },
    });
  }
}

// Group heads and the viewer's cross-group read access; both need the users to exist.
async function seedGroupMembership(prisma: PrismaClient): Promise<void> {
  await prisma.reportingGroup.update({
    where: { id: DEFAULT_REPORTING_GROUP_ID },
    data: { headUserId: HEAD_USER_ID },
  });
  await prisma.reportingGroup.update({
    where: { id: ADVANCED_FINANCE_GROUP_ID },
    data: { headUserId: ADMIN_USER_ID },
  });

  for (const groupId of [
    DEFAULT_REPORTING_GROUP_ID,
    ADVANCED_FINANCE_GROUP_ID,
  ]) {
    await prisma.viewerGroupAccess.upsert({
      where: {
        viewerUserId_groupId: { viewerUserId: VIEWER_USER_ID, groupId },
      },
      update: {},
      create: { viewerUserId: VIEWER_USER_ID, groupId },
    });
  }
}

// A product whose lead is absent from the catalogue or has no explicit group is
// corrupt ownership — fail loud rather than silently pin the default group.
export function reportingGroupForProduct(
  leadId: string,
  groupByLeadId: ReadonlyMap<string, string>,
): string {
  const groupId = groupByLeadId.get(leadId);
  if (groupId === undefined) {
    throw new Error(
      `Advanced seed: product lead ${leadId} is not a seeded user`,
    );
  }
  return groupId;
}

// Product group is the report grouping source of truth; derive it from the
// seeded lead's reporting group so seed data satisfies the UAT invariant.
async function seedProducts(prisma: PrismaClient): Promise<void> {
  const groupByLeadId = new Map<string, string>(
    SEED_USERS.flatMap((user) =>
      user.reportingGroupId === null
        ? []
        : [[user.id, user.reportingGroupId] as const],
    ),
  );

  for (const product of SEED_PRODUCTS) {
    await prisma.project.upsert({
      where: { id: product.id },
      update: { name: product.name, leadId: product.leadId },
      create: { id: product.id, name: product.name, leadId: product.leadId },
    });
  }

  for (const product of SEED_PRODUCTS) {
    const groupId = reportingGroupForProduct(product.leadId, groupByLeadId);
    await prisma.groupProduct.upsert({
      where: { productId: product.id },
      update: { groupId },
      create: { groupId, productId: product.id },
    });
  }
}

async function seedStages(prisma: PrismaClient): Promise<void> {
  for (const stage of SEED_STAGES) {
    await prisma.stage.upsert({
      where: { name: stage.name },
      update: { sortOrder: stage.sortOrder },
      create: { id: stage.id, name: stage.name, sortOrder: stage.sortOrder },
    });
  }
}

// Organization baseline every later seed section builds on: groups, users,
// group membership, products with their owning group, and the SDLC stages.
export async function seedOrganizationBaseline(
  prisma: PrismaClient,
): Promise<SeedOrganizationCounts> {
  await seedReportingGroups(prisma);
  await seedUsers(prisma);
  await seedGroupMembership(prisma);
  await seedProducts(prisma);
  await seedStages(prisma);
  return {
    groups: SEED_REPORTING_GROUPS.length + 1,
    users: SEED_USERS.length,
    products: SEED_PRODUCTS.length,
    stages: SEED_STAGES.length,
    viewerGroupAccesses: 2,
  };
}
