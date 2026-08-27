import type { ProjectActivityLeadEdge } from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import {
  ProjectActivityDomainError,
  ProjectActivityNotFoundError,
} from "./project-activity.errors.js";

export async function assertGroupMoveAllowed(
  tx: Prisma.TransactionClient,
  activityId: string,
  nextGroupId: string,
): Promise<void> {
  const activity = await tx.projectActivity.findUnique({
    where: { id: activityId },
    select: { groupId: true },
  });
  if (!activity) {
    throw new ProjectActivityNotFoundError(
      `Project activity ${activityId} was not found.`,
    );
  }
  if (activity.groupId === nextGroupId) return;
  const attachedLeadCount = await tx.projectActivityLead.count({
    where: { activityId },
  });
  if (attachedLeadCount > 0) {
    throw new ProjectActivityDomainError(
      "Detach all leads before moving the activity to another group.",
    );
  }
}

export async function reconcileProducts(
  tx: Prisma.TransactionClient,
  activityId: string,
  linkedProductIds: readonly string[],
): Promise<void> {
  const existing = await tx.projectActivityProduct.findMany({
    where: { activityId },
    select: { productId: true },
  });
  const existingIds = new Set(existing.map((link) => link.productId));
  const normalizedIds = linkedProductIds.map((id) => id.toLowerCase());
  const nextIds = new Set(normalizedIds);
  const toRemove = [...existingIds].filter((id) => !nextIds.has(id));
  const toAdd = normalizedIds.filter((id) => !existingIds.has(id));
  if (toRemove.length > 0) {
    await tx.projectActivityProduct.deleteMany({
      where: { activityId, productId: { in: toRemove } },
    });
  }
  if (toAdd.length > 0) {
    await tx.projectActivityProduct.createMany({
      data: toAdd.map((productId) => ({ activityId, productId })),
      skipDuplicates: true,
    });
  }
}

export async function assertLeadAttachable(
  tx: Prisma.TransactionClient,
  edge: ProjectActivityLeadEdge,
): Promise<void> {
  const activity = await tx.projectActivity.findUnique({
    where: { id: edge.activityId },
    select: { groupId: true, archived: true },
  });
  if (!activity) {
    throw new ProjectActivityNotFoundError(
      `Project activity ${edge.activityId} was not found.`,
    );
  }
  const lead = await tx.user.findUnique({
    where: { id: edge.leadId },
    select: { role: true, reportingGroupId: true },
  });
  if (!lead) {
    throw new ProjectActivityNotFoundError(
      `Lead ${edge.leadId} was not found.`,
    );
  }
  if (activity.archived) {
    throw new ProjectActivityDomainError(
      "Cannot attach a lead to an archived activity.",
    );
  }
  if (lead.role !== "lead") {
    throw new ProjectActivityDomainError(
      "Only users with the lead role can be attached to an activity.",
    );
  }
  if (lead.reportingGroupId !== activity.groupId) {
    throw new ProjectActivityDomainError(
      "The lead belongs to another reporting group than this activity.",
    );
  }
}
