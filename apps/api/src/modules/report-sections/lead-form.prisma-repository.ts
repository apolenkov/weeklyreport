import { Injectable } from "@nestjs/common";
import type {
  ReportSectionReadModel,
  VersionSnapshot,
} from "@customreport/shared";
import { versionSnapshotSchema } from "@customreport/shared";
import type { ItemType, ItemWorkflowStatus } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  reportSectionFullInclude,
  mapPrismaToReportSection,
} from "./report-sections.prisma-repository";
import type {
  LeadFormRepository,
  CrossAuthorSectionRow,
} from "./lead-form.service";

const MAX_SNAPSHOTS = 50;

@Injectable()
export class LeadFormPrismaRepository implements LeadFormRepository {
  constructor(private readonly prisma: PrismaService) {}

  // UFB-047 / Phase 49-01: legacy `getDepartmentName()` removed. The
  // section read model no longer carries a per-section brand label;
  // frontends pull it from `auth.me.organization` (hydrated per
  // request) so the source of truth is one row in `Organization`.

  async getSectionById(
    sectionId: string,
  ): Promise<ReportSectionReadModel | null> {
    const row = await this.prisma.reportSection.findUnique({
      where: { id: sectionId },
      include: reportSectionFullInclude,
    });

    if (!row) {
      return null;
    }

    return mapPrismaToReportSection(
      row as unknown as Parameters<typeof mapPrismaToReportSection>[0],
    );
  }

  async getSectionForPeriod(
    reportId: string,
    userId: string,
  ): Promise<{ section: ReportSectionReadModel; readOnly: boolean } | null> {
    const row = await this.prisma.reportSection.findUnique({
      where: { reportId_authorId: { reportId, authorId: userId } },
      include: {
        ...reportSectionFullInclude,
        report: { select: { periodStatus: true } },
      },
    });

    if (!row) {
      return null;
    }

    const section = mapPrismaToReportSection(
      row as unknown as Parameters<typeof mapPrismaToReportSection>[0],
    );

    // readOnly when the period is not open (published periods are locked;
    // note: 'reopened' is treated as non-open per spec — callers may refine)
    const readOnly =
      (row as unknown as { report: { periodStatus: string } }).report
        .periodStatus !== "open";

    return { section, readOnly };
  }

  async revokeSectionSubmission(
    sectionId: string,
    revokedBy: string,
  ): Promise<void> {
    await this.prisma.reportSection.update({
      where: { id: sectionId },
      data: {
        status: "draft",
        revokedAt: new Date(),
        revokedBy,
        submittedAt: null,
      },
    });
  }

  async fillFromSection(
    targetSectionId: string,
    sourceSectionId: string,
  ): Promise<number> {
    const source = await this.prisma.reportSection.findUnique({
      where: { id: sourceSectionId },
      include: reportSectionFullInclude,
    });

    if (!source) {
      throw new Error(`Source section ${sourceSectionId} not found.`);
    }

    let copiedItems = 0;

    await this.prisma.$transaction(
      async (tx) => {
        // Replace only the sections that Fill From owns. Priorities stay fresh
        // for the current week and must not be copied or cleared here.
        await tx.item.deleteMany({
          where: { reportSectionId: targetSectionId },
        });
        await tx.risk.deleteMany({
          where: { reportSectionId: targetSectionId },
        });
        await tx.decision.deleteMany({
          where: { reportSectionId: targetSectionId },
        });

        // Copy items from source. Next Week source items become Current Week
        // suggestions in the target period.
        if (source.items.length > 0) {
          await tx.item.createMany({
            data: source.items.map((i) => ({
              reportSectionId: targetSectionId,
              projectId: i.projectId,
              type: "current",
              text: i.text,
              tag: i.tag,
              workflowStatus: i.workflowStatus,
              carriedOver: false,
              completed: i.completed ?? null,
              stageName: i.stageName ?? null,
            })),
          });
          copiedItems += source.items.length;
        }

        // Copy risks from source
        if (source.risks.length > 0) {
          await tx.risk.createMany({
            data: source.risks.map((r) => ({
              reportSectionId: targetSectionId,
              projectId: r.projectId,
              risk: r.risk,
              impact: r.impact,
              mitigation: r.mitigation,
              severity: r.severity,
              stageName: r.stageName ?? null,
            })),
          });
          copiedItems += source.risks.length;
        }

        // Copy decisions from source
        const decisionsToCopy = source.decisions.filter((d) => !!d.productId);
        if (decisionsToCopy.length > 0) {
          await tx.decision.createMany({
            data: decisionsToCopy.map((d) => ({
              reportSectionId: targetSectionId,
              text: d.text,
              owner: d.owner,
              deadline: d.deadline ?? null,
              impact: d.impact,
              resolvedAt: d.resolvedAt ?? null,
              stageName: d.stageName ?? null,
              productId: d.productId as string,
            })),
          });
          copiedItems += decisionsToCopy.length;
        }
      },
      { timeout: 15000 },
    );

    return copiedItems;
  }

  async listVersions(sectionId: string): Promise<VersionSnapshot[]> {
    const rows = await this.prisma.versionSnapshot.findMany({
      where: { reportSectionId: sectionId },
      orderBy: { version: "desc" },
      take: MAX_SNAPSHOTS,
    });

    return rows.map((row) => {
      const data = row.data as {
        items?: unknown[];
        risks?: unknown[];
        decisions?: unknown[];
      } | null;
      return versionSnapshotSchema.parse({
        id: row.id,
        reportSectionId: row.reportSectionId,
        version: row.version,
        createdAt: row.createdAt,
        itemCount: data?.items?.length ?? 0,
        riskCount: data?.risks?.length ?? 0,
        decisionCount: data?.decisions?.length ?? 0,
      });
    });
  }

  async restoreVersion(sectionId: string, version: number): Promise<number> {
    const snapshot = await this.prisma.versionSnapshot.findUnique({
      where: {
        reportSectionId_version: { reportSectionId: sectionId, version },
      },
    });

    if (!snapshot) {
      throw new Error(`Version ${version} not found for section ${sectionId}.`);
    }

    const data = snapshot.data as {
      items: Array<{
        projectId: string;
        type: string;
        text: string;
        tag: string;
        workflowStatus: string;
        carriedOver: boolean;
        completed: boolean | null;
        stageName?: string | null;
        stageIds?: string[];
      }>;
      risks: Array<{
        projectId: string;
        risk: string;
        impact: string;
        mitigation: string;
        stageName?: string | null;
        stageIds?: string[];
      }>;
      decisions: Array<{
        text: string;
        owner: string;
        deadline: string | null;
        impact: string;
        resolvedAt: string | null;
        stageName?: string | null;
        stageIds?: string[];
        productId?: string | null;
      }>;
    };

    await this.prisma.$transaction(
      async (tx) => {
        await tx.item.deleteMany({ where: { reportSectionId: sectionId } });
        await tx.risk.deleteMany({ where: { reportSectionId: sectionId } });
        await tx.decision.deleteMany({ where: { reportSectionId: sectionId } });

        if (data.items.length > 0) {
          await tx.item.createMany({
            data: data.items.map((i) => ({
              reportSectionId: sectionId,
              projectId: i.projectId,
              type: i.type as ItemType,
              text: i.text,
              tag: i.tag,
              workflowStatus: i.workflowStatus as ItemWorkflowStatus,
              carriedOver: i.carriedOver,
              completed: i.completed ?? null,
              stageName: i.stageIds?.join(", ") ?? i.stageName ?? null,
            })),
          });
        }

        if (data.risks.length > 0) {
          await tx.risk.createMany({
            data: data.risks.map((r) => ({
              reportSectionId: sectionId,
              projectId: r.projectId,
              risk: r.risk,
              impact: r.impact,
              mitigation: r.mitigation,
              stageName: r.stageIds?.join(", ") ?? r.stageName ?? null,
            })),
          });
        }

        const decisionsToRestore = data.decisions.filter((d) => !!d.productId);
        if (decisionsToRestore.length > 0) {
          await tx.decision.createMany({
            data: decisionsToRestore.map((d) => ({
              reportSectionId: sectionId,
              text: d.text,
              owner: d.owner,
              deadline: d.deadline ? new Date(d.deadline) : null,
              impact: d.impact,
              resolvedAt: d.resolvedAt ? new Date(d.resolvedAt) : null,
              stageName: d.stageIds?.join(", ") ?? d.stageName ?? null,
              productId: d.productId as string,
            })),
          });
        }

      },
      { timeout: 15000 },
    );

    return version;
  }

  async createReopenRequest(
    sectionId: string,
    userId: string,
    reason?: string,
  ): Promise<void> {
    // Persist the request as a ReopenRequest row so Head can review it from
    // the Admin Panel "Reopen Requests" tab. Status starts at `pending`; the
    // head's response (approve/reject) updates the row + may flip the
    // section back to draft when approved.
    await this.prisma.reopenRequest.create({
      data: {
        reportSectionId: sectionId,
        requestedById: userId,
        reason: reason && reason.trim().length > 0 ? reason.trim() : null,
      },
    });
  }

  async createVersionSnapshot(sectionId: string): Promise<void> {
    const section = await this.prisma.reportSection.findUnique({
      where: { id: sectionId },
      include: reportSectionFullInclude,
    });

    if (!section) {
      throw new Error(`Section ${sectionId} not found for snapshot.`);
    }

    // Determine next version number
    const maxSnapshot = await this.prisma.versionSnapshot.findFirst({
      where: { reportSectionId: sectionId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const nextVersion = (maxSnapshot?.version ?? 0) + 1;

    // Serialize current section data
    const data = {
      items: section.items.map((i) => ({
        projectId: i.projectId,
        type: i.type,
        text: i.text,
        tag: i.tag,
        workflowStatus: i.workflowStatus,
        carriedOver: i.carriedOver,
        completed: i.completed ?? null,
        priorityRank: i.priorityRank ?? null,
        stageName: i.stageName ?? null,
      })),
      risks: section.risks.map((r) => ({
        projectId: r.projectId,
        risk: r.risk,
        impact: r.impact,
        mitigation: r.mitigation,
        stageName: r.stageName ?? null,
      })),
      decisions: section.decisions.map((d) => ({
        text: d.text,
        owner: d.owner,
        deadline: d.deadline?.toISOString() ?? null,
        impact: d.impact,
        resolvedAt: d.resolvedAt?.toISOString() ?? null,
        stageName: d.stageName ?? null,
        productId: d.productId,
      })),
    };

    await this.prisma.versionSnapshot.create({
      data: {
        reportSectionId: sectionId,
        version: nextVersion,
        data,
      },
    });

    // Prune old snapshots if over the limit
    const totalCount = await this.prisma.versionSnapshot.count({
      where: { reportSectionId: sectionId },
    });

    if (totalCount > MAX_SNAPSHOTS) {
      const oldest = await this.prisma.versionSnapshot.findMany({
        where: { reportSectionId: sectionId },
        orderBy: { version: "asc" },
        take: totalCount - MAX_SNAPSHOTS,
        select: { id: true },
      });

      if (oldest.length > 0) {
        await this.prisma.versionSnapshot.deleteMany({
          where: { id: { in: oldest.map((s) => s.id) } },
        });
      }
    }
  }

  async hasSharedProduct(userId1: string, userId2: string): Promise<boolean> {
    const row = await this.prisma.stageAssignment.findFirst({
      where: {
        userId: userId1,
        project: {
          stageAssignments: {
            some: { userId: userId2 },
          },
        },
      },
      select: { id: true },
    });
    return row !== null;
  }

  async getCrossAuthors(
    reportId: string,
    userId: string,
  ): Promise<
    {
      projectId: string;
      projectName: string;
      authorId: string;
      authorName: string;
      stageNames: string[];
      stages: { stageName: string; status: "green" | "yellow" | "red" | null }[];
      itemCount: number;
      riskCount: number;
    }[]
  > {
    const myAssignments = await this.prisma.stageAssignment.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const myProjectIds = [...new Set(myAssignments.map((r) => r.projectId))];
    if (myProjectIds.length === 0) return [];

    // Other users' stage assignments on shared projects
    const others = await this.prisma.stageAssignment.findMany({
      where: { projectId: { in: myProjectIds }, userId: { not: userId } },
      select: {
        projectId: true,
        stageId: true,
        project: { select: { id: true, name: true, archived: true } },
        stage: { select: { name: true } },
        user: { select: { id: true, name: true } },
      },
    });

    // Section stats + stage statuses for other authors in this report
    const otherUserIds = [...new Set(others.map((o) => o.user.id))];
    const sections = await this.prisma.reportSection.findMany({
      where: { reportId, authorId: { in: otherUserIds } },
      select: {
        authorId: true,
        items: { select: { projectId: true } },
        risks: { select: { projectId: true } },
        stageStatuses: { select: { projectId: true, stageId: true, status: true } },
      },
    });
    const sectionByAuthor = new Map(sections.map((s) => [s.authorId, s]));

    // Build status lookup: "(authorId)::projectId::stageId" → status
    const statusMap = new Map<string, "green" | "yellow" | "red">();
    for (const s of sections) {
      for (const ss of s.stageStatuses) {
        if (ss.status !== null) {
          statusMap.set(`${s.authorId}::${ss.projectId}::${ss.stageId}`, ss.status);
        }
      }
    }

    // Group by (projectId, authorId)
    const grouped = new Map<
      string,
      {
        projectId: string;
        projectName: string;
        authorId: string;
        authorName: string;
        stageNames: Set<string>;
        stageEntries: { stageName: string; status: "green" | "yellow" | "red" | null }[];
        itemCount: number;
        riskCount: number;
      }
    >();

    for (const row of others) {
      if (row.project.archived) continue;
      const key = `${row.projectId}::${row.user.id}`;
      const stageStatus =
        statusMap.get(`${row.user.id}::${row.projectId}::${row.stageId}`) ?? null;
      if (!grouped.has(key)) {
        const section = sectionByAuthor.get(row.user.id);
        const itemCount = section
          ? section.items.filter((i) => i.projectId === row.projectId).length
          : 0;
        const riskCount = section
          ? section.risks.filter((r) => r.projectId === row.projectId).length
          : 0;
        grouped.set(key, {
          projectId: row.projectId,
          projectName: row.project.name,
          authorId: row.user.id,
          authorName: row.user.name,
          stageNames: new Set([row.stage.name]),
          stageEntries: [{ stageName: row.stage.name, status: stageStatus }],
          itemCount,
          riskCount,
        });
      } else {
        const entry = grouped.get(key);
        entry?.stageNames.add(row.stage.name);
        entry?.stageEntries.push({ stageName: row.stage.name, status: stageStatus });
      }
    }

    return [...grouped.values()].map((g) => ({
      projectId: g.projectId,
      projectName: g.projectName,
      authorId: g.authorId,
      authorName: g.authorName,
      stageNames: [...g.stageNames],
      stages: g.stageEntries,
      itemCount: g.itemCount,
      riskCount: g.riskCount,
    }));
  }

  async getCrossAuthorSections(
    reportId: string,
    userId: string,
  ): Promise<CrossAuthorSectionRow[]> {
    // Step 1: Resolve shared project IDs (same join as getCrossAuthors)
    const myAssignments = await this.prisma.stageAssignment.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const myProjectIds = [...new Set(myAssignments.map((r) => r.projectId))];
    if (myProjectIds.length === 0) return [];

    // Other users' assignments on shared projects (excluding self)
    const others = await this.prisma.stageAssignment.findMany({
      where: {
        projectId: { in: myProjectIds },
        userId: { not: userId },
        project: { archived: false },
      },
      select: {
        projectId: true,
        user: { select: { id: true, name: true } },
      },
    });

    // Build per-author sets of shared projectIds
    const authorProjectMap = new Map<
      string,
      { authorId: string; authorName: string; sharedProjectIds: Set<string> }
    >();
    for (const row of others) {
      const existing = authorProjectMap.get(row.user.id);
      if (existing) {
        existing.sharedProjectIds.add(row.projectId);
      } else {
        authorProjectMap.set(row.user.id, {
          authorId: row.user.id,
          authorName: row.user.name,
          sharedProjectIds: new Set([row.projectId]),
        });
      }
    }

    if (authorProjectMap.size === 0) return [];

    const otherUserIds = [...authorProjectMap.keys()];

    // Step 2: Fetch sections for all foreign authors in this report
    const sections = await this.prisma.reportSection.findMany({
      where: { reportId, authorId: { in: otherUserIds } },
      select: {
        authorId: true,
        items: {
          select: {
            id: true,
            projectId: true,
            type: true,
            text: true,
            tag: true,
            workflowStatus: true,
            carriedOver: true,
            completed: true,
            priorityRank: true,
            stageName: true,
          },
        },
        risks: {
          select: {
            id: true,
            projectId: true,
            risk: true,
            impact: true,
            mitigation: true,
            severity: true,
            stageName: true,
          },
        },
        decisions: {
          select: {
            id: true,
            productId: true,
            text: true,
            owner: true,
            deadline: true,
            impact: true,
            resolvedAt: true,
            stageName: true,
          },
        },
      },
    });

    // Step 3: Build result — filter each collection to shared products only
    const result: CrossAuthorSectionRow[] = [];
    for (const section of sections) {
      const authorEntry = authorProjectMap.get(section.authorId);
      if (!authorEntry) continue;

      const sharedIds = authorEntry.sharedProjectIds;

      result.push({
        authorId: authorEntry.authorId,
        authorName: authorEntry.authorName,
        sharedProductIds: [...sharedIds],
        items: section.items.filter((i) => sharedIds.has(i.projectId)),
        risks: section.risks.filter((r) => sharedIds.has(r.projectId)),
        decisions: section.decisions.filter((d) => sharedIds.has(d.productId)),
      });
    }

    return result;
  }
}
