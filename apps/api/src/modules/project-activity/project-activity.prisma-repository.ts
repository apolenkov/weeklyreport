import {
  type ProjectActivity,
  type ProjectActivityLeadEdge,
  projectActivitySchema,
} from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  currentEditableReportWhere,
  lockCurrentEditableReport,
} from "../../lib/report-lifecycle.js";
import { lockStatusGraph } from "../../lib/status-graph-lock.js";
import { lockUser } from "../../lib/user-activity-assignment.js";
import {
  assertGroupMoveAllowed,
  assertLeadAttachable,
  reconcileProducts,
} from "./project-activity.persistence-guards.js";
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
      await lockStatusGraph(tx);
      await lockUser(tx, edge.leadId);
      // Provisioning locks the parent report before creating a section. Lock
      // every current editable parent first, otherwise a first provisioning
      // transaction can be invisible to this transaction's section scan.
      const lockedReports = await lockAllEditableReports(tx);
      await assertLeadAttachable(tx, edge);
      await tx.projectActivityLead.upsert({
        where: { activityId_leadId: edge },
        create: edge,
        update: {},
      });
      const sections = await tx.reportSection.findMany({
        where: { authorId: edge.leadId, reportId: { in: lockedReports } },
        select: { id: true, reportId: true },
      });
      await tx.activityStatus.createMany({
        data: sections.map((section) => ({
          reportSectionId: section.id,
          activityId: edge.activityId,
          status: null,
        })),
        skipDuplicates: true,
      });
    });
  }

  async detachLead(edge: ProjectActivityLeadEdge): Promise<void> {
    await runProjectActivityTransaction(this.prisma, async (tx) => {
      await lockStatusGraph(tx);
      const editableReports = await lockAllEditableReports(tx);
      // The edge and its live status rows are one current-state mutation.
      // Published/closed sections are deliberately outside the delete set.
      await tx.projectActivityLead.deleteMany({ where: edge });
      if (editableReports.length === 0) return;
      const sections = await tx.reportSection.findMany({
        where: { authorId: edge.leadId, reportId: { in: editableReports } },
        select: { id: true },
      });
      await tx.activityStatus.deleteMany({
        where: {
          activityId: edge.activityId,
          reportSectionId: { in: sections.map((section) => section.id) },
        },
      });
    });
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

async function lockAllEditableReports(
  tx: Prisma.TransactionClient,
): Promise<string[]> {
  const candidates = await tx.report.findMany({
    where: currentEditableReportWhere(),
    select: { id: true },
    orderBy: { id: "asc" },
  });
  const editableReports: string[] = [];
  for (const { id: reportId } of candidates) {
    const gate = await lockCurrentEditableReport(tx, { reportId });
    if (gate.kind === "editable") editableReports.push(gate.reportId);
  }
  return editableReports;
}
