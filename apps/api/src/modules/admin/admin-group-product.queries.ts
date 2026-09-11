import {
  type AdminProject,
  adminProjectSchema,
  type GroupProduct,
  type GroupProductEdgeInput,
  groupProductSchema,
  type ReportingGroup,
  reportingGroupSchema,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { isUniqueViolation } from "../../lib/prisma-unique-violation";
import { lockAndValidateProjectOwnership } from "../../lib/user-activity-assignment.js";
import {
  AdminGroupProductConflictError,
  type ProductGroupOwnership,
} from "./admin-shared.js";

// Name the current owner so the admin can resolve the conflict explicitly.
async function throwProductOwnershipConflict(
  prisma: Pick<PrismaService, "reportingGroup">,
  groupId: string,
): Promise<never> {
  const currentGroup = await prisma.reportingGroup.findUnique({
    where: { id: groupId },
    select: { name: true },
  });
  if (currentGroup === null) {
    // FK integrity guarantees the owning group row exists; its absence is a
    // data-integrity anomaly, never a reason to invent an "another group" label.
    throw new AdminGroupProductConflictError(
      `Product is already attached to group ${groupId}, but the group's row is missing. Refresh and retry.`,
    );
  }
  throw new AdminGroupProductConflictError(
    `Product is already attached to ${currentGroup.name}. Detach it there before attaching it to another group.`,
  );
}

// A never-existing product must surface as the typed conflict, not a raw
// Prisma not-found raised before the ownership graph is read.
async function requireProjectLead(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<string> {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { leadId: true },
  });
  if (project === null) {
    throw new AdminGroupProductConflictError(
      `Project ${projectId} was not found. Refresh and retry.`,
    );
  }
  return project.leadId;
}

// One group per product: same group is idempotent; different group rejects
// (no silent ownership move — UI must detach first).
export async function attachProductToGroup(
  prisma: PrismaService,
  input: GroupProductEdgeInput,
): Promise<GroupProduct> {
  return prisma.$transaction(async (tx) => {
    const graph = await lockAndValidateProjectOwnership(tx, {
      projectId: input.productId,
      desiredLeadId: await requireProjectLead(tx, input.productId),
      expectedGroupId: input.groupId,
      requireDesiredLeadCurrent: true,
    });
    if (!graph.project) {
      throw new AdminGroupProductConflictError(
        `Project ${input.productId} was not found. Refresh and retry.`,
      );
    }
    const existing = graph.ownership;
    if (existing?.groupId === input.groupId) {
      return groupProductSchema.parse(existing);
    }
    if (existing) {
      return throwProductOwnershipConflict(tx, existing.groupId);
    }
    try {
      const row = await tx.groupProduct.create({
        data: { groupId: input.groupId, productId: input.productId },
      });
      return groupProductSchema.parse(row);
    } catch (error) {
      if (
        !isUniqueViolation(error, {
          index: "GroupProduct_productId_key",
          columns: ["productId"],
        })
      )
        throw error;
      const winner = await tx.groupProduct.findUnique({
        where: { productId: input.productId },
      });
      if (winner?.groupId === input.groupId)
        return groupProductSchema.parse(winner);
      if (winner) return throwProductOwnershipConflict(tx, winner.groupId);
      throw new AdminGroupProductConflictError(
        "Product ownership changed concurrently. Refresh and try again.",
      );
    }
  });
}

// deleteMany so an already-absent edge is a no-op (UI double-click / race safe).
export async function detachProductFromGroup(
  prisma: PrismaService,
  input: GroupProductEdgeInput,
): Promise<void> {
  await prisma.groupProduct.deleteMany({
    where: { groupId: input.groupId, productId: input.productId },
  });
}

// Projects as AdminProject so the UI reuses the snapshot.projects shape.
export async function listGroupProducts(
  prisma: PrismaService,
  groupId: string,
): Promise<AdminProject[]> {
  const rows = await prisma.groupProduct.findMany({
    where: { groupId },
    include: { product: { include: { lead: true } } },
    orderBy: { product: { name: "asc" } },
  });
  return rows.map((row) =>
    adminProjectSchema.parse({
      id: row.product.id,
      name: row.product.name,
      archived: row.product.archived,
      leadId: row.product.leadId,
      leadName: row.product.lead.name,
    }),
  );
}

export async function listProductGroups(
  prisma: PrismaService,
  productId: string,
): Promise<ReportingGroup[]> {
  const rows = await prisma.groupProduct.findMany({
    where: { productId },
    include: { group: true },
    orderBy: { group: { name: "asc" } },
  });
  return rows.map((row) => reportingGroupSchema.parse(row.group));
}

// One query for the catalog; every requested id is present (group null if unowned).
export async function listProductGroupOwnership(
  prisma: PrismaService,
  productIds: readonly string[],
): Promise<ProductGroupOwnership[]> {
  const rows = await prisma.groupProduct.findMany({
    where: { productId: { in: [...productIds] } },
    include: { group: { select: { id: true, name: true } } },
  });
  const ownerByProductId = new Map(
    rows.map((row) => [
      row.productId,
      { id: row.group.id, name: row.group.name },
    ]),
  );
  return productIds.map((productId) => ({
    productId,
    group: ownerByProductId.get(productId) ?? null,
  }));
}
