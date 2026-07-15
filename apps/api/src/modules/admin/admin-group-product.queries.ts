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
import { isUniqueViolation } from "../../lib/prisma-unique-violation";
import {
  AdminGroupProductConflictError,
  type ProductGroupOwnership,
} from "./admin-shared.js";

/**
 * Group ↔ Product M:M edge mutations + reads.
 */

/**
 * Reject ownership moves with the current group name so the admin can resolve
 * the conflict explicitly instead of silently moving the product.
 */
async function throwProductOwnershipConflict(
  prisma: PrismaService,
  groupId: string,
): Promise<never> {
  const currentGroup = await prisma.reportingGroup.findUnique({
    where: { id: groupId },
    select: { name: true },
  });
  throw new AdminGroupProductConflictError(
    `Product is already attached to ${currentGroup?.name ?? "another group"}. Detach it there before attaching it to another group.`,
  );
}

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
  const existing = await prisma.groupProduct.findUnique({
    where: { productId: input.productId },
  });
  if (existing?.groupId === input.groupId) {
    return groupProductSchema.parse(existing);
  }
  if (existing) {
    return throwProductOwnershipConflict(prisma, existing.groupId);
  }

  try {
    const row = await prisma.groupProduct.create({
      data: { groupId: input.groupId, productId: input.productId },
    });
    return groupProductSchema.parse(row);
  } catch (error) {
    if (
      !isUniqueViolation(error, {
        index: "GroupProduct_productId_key",
        columns: ["productId"],
      })
    ) {
      throw error;
    }

    const winner = await prisma.groupProduct.findUnique({
      where: { productId: input.productId },
    });
    if (winner?.groupId === input.groupId) {
      return groupProductSchema.parse(winner);
    }
    if (winner) {
      return throwProductOwnershipConflict(prisma, winner.groupId);
    }
    throw new AdminGroupProductConflictError(
      "Product ownership changed concurrently. Refresh and try again.",
    );
  }
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

/**
 * Batched owning-group lookup for many products in one query. Resolves the
 * single owning group (a product belongs to at most one group) for every
 * requested id, so the "products attached" editor answers ownership for the
 * whole catalog without one round-trip per product. Every requested id is
 * present in the result; `group` is `null` when the product is unowned.
 */
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
