import {
  type ProjectActivity,
  type ProjectActivityLeadEdge,
  projectActivitySchema,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { ProjectActivityRepository } from "./project-activity.service.js";

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

@Injectable()
export class ProjectActivityPrismaRepository
  implements ProjectActivityRepository
{
  constructor(private readonly prisma: PrismaService) {}

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
    // Defense-in-depth for any caller that bypasses the shared schema's
    // uniqueness refine: dedupe before seeding the join rows so an in-payload
    // repeat never collides with the (activityId, productId) unique constraint.
    const uniqueProductIds = [...new Set(linkedProductIds)];
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
    // Reconcile the ProjectActivityProduct join to the submitted set (delete
    // removed, add new) atomically with the scalar update. Untouched links keep
    // their `createdAt`, so a no-op edit does not churn the join rows.
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.projectActivity.update({ where: { id }, data });
      const existing = await tx.projectActivityProduct.findMany({
        where: { activityId: id },
        select: { productId: true },
      });
      const existingIds = new Set(existing.map((link) => link.productId));
      const nextIds = new Set(linkedProductIds);
      const toRemove = [...existingIds].filter((p) => !nextIds.has(p));
      const toAdd = linkedProductIds.filter((p) => !existingIds.has(p));
      if (toRemove.length > 0) {
        await tx.projectActivityProduct.deleteMany({
          where: { activityId: id, productId: { in: toRemove } },
        });
      }
      if (toAdd.length > 0) {
        await tx.projectActivityProduct.createMany({
          data: toAdd.map((productId) => ({ activityId: id, productId })),
          // Defense-in-depth for a caller that bypasses the shared schema's
          // uniqueness refine: an in-payload repeat cannot raise P2002 here.
          skipDuplicates: true,
        });
      }
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
    // Idempotent on the unique (activityId, leadId) tuple — a double-click
    // attach is harmless (mirrors admin.attachProductToGroup).
    await this.prisma.projectActivityLead.upsert({
      where: { activityId_leadId: edge },
      create: edge,
      update: {},
    });
  }

  async detachLead(edge: ProjectActivityLeadEdge): Promise<void> {
    // deleteMany so detaching an already-detached lead is a no-op, not a P2025.
    // The same transaction removes the lead's ActivityStatus rows on OPEN /
    // REOPENED periods (the editable-period predicate the lead-form read gate
    // uses): otherwise the seeded rows keep rendering in the assembled report
    // and remain in the section read model. Published/archived history stays
    // frozen — those rows are part of the record the head signed off on.
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

  async productExists(productId: string): Promise<boolean> {
    const product = await this.prisma.project.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    return product !== null;
  }

  async getLeadContext(
    leadId: string,
  ): Promise<{ role: string; reportingGroupId: string | null } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: leadId },
      select: { role: true, reportingGroupId: true },
    });
    return user;
  }
}
