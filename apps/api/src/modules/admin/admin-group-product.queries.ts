import {
  type AdminProject,
  adminProjectSchema,
  type GroupProduct,
  type GroupProductEdgeInput,
  groupProductSchema,
  type ReportingGroup,
  reportingGroupSchema,
} from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AdminGroupProductConflictError } from "./admin-shared.js";

/**
 * Group ↔ Product M:M edge mutations + reads.
 */

/**
 * Strict one-group-per-product attach. If the product already belongs
 * to the target group the call is idempotent. If it belongs to a
 * different group we reject instead of silently moving ownership; the
 * admin UI must detach from the current group first.
 */
export async function attachProductToGroup(
  prisma: PrismaService,
  input: GroupProductEdgeInput,
): Promise<GroupProduct> {
  const row = await prisma.$transaction(async (tx) => {
    const existing = await tx.groupProduct.findUnique({
      where: { productId: input.productId },
    });
    if (existing?.groupId === input.groupId) return existing;
    if (existing) {
      const currentGroup = await tx.reportingGroup.findUnique({
        where: { id: existing.groupId },
        select: { name: true },
      });
      throw new AdminGroupProductConflictError(
        `Product is already attached to ${currentGroup?.name ?? "another group"}. Detach it there before attaching it to another group.`,
      );
    }
    return tx.groupProduct.create({
      data: { groupId: input.groupId, productId: input.productId },
    });
  });
  return groupProductSchema.parse(row);
}

/**
 * No-op safe detach. `deleteMany` on the unique tuple returns
 * `{ count: 0 }` if the edge is already absent (vs `delete` which
 * throws). This keeps the UI toggle resilient against double-clicks
 * and races without a pre-read.
 */
export async function detachProductFromGroup(
  prisma: PrismaService,
  input: GroupProductEdgeInput,
): Promise<void> {
  await prisma.groupProduct.deleteMany({
    where: { groupId: input.groupId, productId: input.productId },
  });
}

/**
 * Return Projects attached to a ReportingGroup ordered by name. The
 * Project rows are projected to {@link AdminProject} so the UI
 * consumer can render alongside the existing snapshot.projects rows
 * without a separate shape.
 */
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

/**
 * Return ReportingGroups attached to a Project ordered by group name.
 */
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
