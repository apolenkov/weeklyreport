import {
  type ProjectActivity,
  type ProjectActivityLeadEdge,
  projectActivitySchema,
} from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  ProjectActivityDomainError,
  ProjectActivityNotFoundError,
} from "./project-activity.errors.js";
import type { ProjectActivityRepository } from "./project-activity.service.js";
import { runProjectActivityTransaction } from "./project-activity.transaction.js";

// Prisma row shape shared by every read below (leads joined for `leadIds`,
// label-only product links joined for `linkedProducts`).
const activityInclude = {
  leads: { select: { leadId: true } },
  activityProducts: {
    select: { product: { select: { id: true, name: true } } },
  },
} as const;

interface ActivityRow {
  id: string;
  name: string;
  groupId: string;
  jiraAccounts: string[];
  archived: boolean;
  leads: { leadId: string }[];
  activityProducts: { product: { id: string; name: string } }[];
}

// Zod-parse on the way out so the wire contract is enforced at the
// repository boundary.
function toReadModel(row: ActivityRow): ProjectActivity {
  return projectActivitySchema.parse({
    id: row.id,
    name: row.name,
    groupId: row.groupId,
    // activity-first-class: M:N label-only product links, name-sorted for a
    // stable admin-list order.
    linkedProducts: row.activityProducts
      .map((link) => ({
        productId: link.product.id,
        productName: link.product.name,
      }))
      .sort((a, b) => a.productName.localeCompare(b.productName)),
    jiraAccounts: row.jiraAccounts,
    archived: row.archived,
    leadIds: [...row.leads.map((lead) => lead.leadId)].sort((a, b) =>
      a.localeCompare(b),
    ),
  });
}

async function assertGroupMoveAllowed(
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

async function reconcileProducts(
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

async function assertLeadAttachable(
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

@Injectable()
export class ProjectActivityPrismaRepository implements ProjectActivityRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(): Promise<ProjectActivity[]> {
    const rows = await this.prisma.projectActivity.findMany({
      include: activityInclude,
      orderBy: { name: "asc" },
    });
    return rows.map(toReadModel);
  }

  async findById(activityId: string): Promise<ProjectActivity | null> {
    const row = await this.prisma.projectActivity.findUnique({
      where: { id: activityId },
      include: activityInclude,
    });
    return row ? toReadModel(row) : null;
  }

  async create(input: {
    name: string;
    groupId: string;
    linkedProductIds: string[];
    jiraAccounts: string[];
  }): Promise<ProjectActivity> {
    const { linkedProductIds, ...data } = input;
    // The column is case-sensitive text, so ids are compared in the wire
    // schema's canonical lowercase form; dedup keeps an in-payload repeat off
    // the (activityId, productId) unique constraint.
    const uniqueProductIds = [
      ...new Set(linkedProductIds.map((id) => id.toLowerCase())),
    ];
    const row = await this.prisma.projectActivity.create({
      data: {
        ...data,
        // activity-first-class: seed the label-only join rows in the same write.
        activityProducts: {
          create: uniqueProductIds.map((productId) => ({ productId })),
        },
      },
      include: activityInclude,
    });
    return toReadModel(row);
  }

  async update(input: {
    id: string;
    name: string;
    groupId: string;
    linkedProductIds: string[];
    jiraAccounts: string[];
  }): Promise<ProjectActivity> {
    const { id, linkedProductIds, ...data } = input;
    const row = await runProjectActivityTransaction(this.prisma, async (tx) => {
      await assertGroupMoveAllowed(tx, id, data.groupId);
      await tx.projectActivity.update({ where: { id }, data });
      await reconcileProducts(tx, id, linkedProductIds);
      return tx.projectActivity.findUniqueOrThrow({
        where: { id },
        include: activityInclude,
      });
    });
    return toReadModel(row);
  }

  async setArchived(
    activityId: string,
    archived: boolean,
  ): Promise<ProjectActivity> {
    const row = await this.prisma.projectActivity.update({
      where: { id: activityId },
      data: { archived },
      include: activityInclude,
    });
    return toReadModel(row);
  }

  async attachLead(edge: ProjectActivityLeadEdge): Promise<void> {
    await runProjectActivityTransaction(this.prisma, async (tx) => {
      await assertLeadAttachable(tx, edge);
      await tx.projectActivityLead.upsert({
        where: { activityId_leadId: edge },
        create: edge,
        update: {},
      });
    });
  }

  async detachLead(edge: ProjectActivityLeadEdge): Promise<void> {
    // deleteMany is a no-op if already detached. Cascade ActivityStatus on
    // open/reopened only — published history stays frozen for the signed record.
    await this.prisma.$transaction([
      this.prisma.projectActivityLead.deleteMany({ where: edge }),
      this.prisma.activityStatus.deleteMany({
        where: {
          activityId: edge.activityId,
          reportSection: {
            authorId: edge.leadId,
            report: { periodStatus: { in: ["open", "reopened"] } },
          },
        },
      }),
    ]);
  }

  async groupExists(groupId: string): Promise<boolean> {
    const group = await this.prisma.reportingGroup.findUnique({
      where: { id: groupId },
      select: { id: true },
    });
    return group !== null;
  }

  async findExistingProductIds(
    productIds: readonly string[],
  ): Promise<string[]> {
    const products = await this.prisma.project.findMany({
      where: { id: { in: [...productIds] } },
      select: { id: true },
    });
    return products.map(({ id }) => id);
  }
}
