import {
  type ProjectActivity,
  type ProjectActivityLeadEdge,
  projectActivitySchema,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { ProjectActivityRepository } from "./project-activity.service.js";

// Prisma row shape shared by every read below (leads joined for `leadIds`).
const activityInclude = {
  leads: { select: { leadId: true } },
} as const;

interface ActivityRow {
  id: string;
  name: string;
  groupId: string;
  projectId: string | null;
  jiraAccounts: string[];
  archived: boolean;
  leads: { leadId: string }[];
}

// Zod-parse on the way out (REPO-09) so the wire contract is enforced at the
// repository boundary.
function toReadModel(row: ActivityRow): ProjectActivity {
  return projectActivitySchema.parse({
    id: row.id,
    name: row.name,
    groupId: row.groupId,
    projectId: row.projectId,
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
    projectId: string | null;
    jiraAccounts: string[];
  }): Promise<ProjectActivity> {
    const row = await this.prisma.projectActivity.create({
      data: input,
      include: activityInclude,
    });
    return toReadModel(row);
  }

  async update(input: {
    id: string;
    name: string;
    groupId: string;
    projectId: string | null;
    jiraAccounts: string[];
  }): Promise<ProjectActivity> {
    const { id, ...data } = input;
    const row = await this.prisma.projectActivity.update({
      where: { id },
      data,
      include: activityInclude,
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
