import { Injectable } from '@nestjs/common';
import type { ReportSectionReadModel, VersionSnapshot } from '@customreport/shared';
import { versionSnapshotSchema } from '@customreport/shared';
import type { ItemType, ItemWorkflowStatus } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  reportSectionFullInclude,
  mapPrismaToReportSection,
} from './report-sections.prisma-repository';
import type { LeadFormRepository } from './lead-form.service';

const MAX_SNAPSHOTS = 50;

@Injectable()
export class LeadFormPrismaRepository implements LeadFormRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSectionById(sectionId: string): Promise<ReportSectionReadModel | null> {
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
    const readOnly = (row as unknown as { report: { periodStatus: string } }).report
      .periodStatus !== 'open';

    return { section, readOnly };
  }

  async revokeSectionSubmission(sectionId: string, revokedBy: string): Promise<void> {
    await this.prisma.reportSection.update({
      where: { id: sectionId },
      data: {
        status: 'draft',
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
        // Delete current content from target
        await tx.item.deleteMany({ where: { reportSectionId: targetSectionId } });
        await tx.risk.deleteMany({ where: { reportSectionId: targetSectionId } });
        await tx.decision.deleteMany({ where: { reportSectionId: targetSectionId } });
        await tx.priority.deleteMany({ where: { reportSectionId: targetSectionId } });

        // Copy items from source
        if (source.items.length > 0) {
          await tx.item.createMany({
            data: source.items.map((i) => ({
              reportSectionId: targetSectionId,
              projectId: i.projectId,
              type: i.type,
              text: i.text,
              tag: i.tag,
              workflowStatus: i.workflowStatus,
              carriedOver: i.carriedOver,
              completed: i.completed ?? null,
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
            })),
          });
          copiedItems += source.risks.length;
        }

        // Copy decisions from source
        if (source.decisions.length > 0) {
          await tx.decision.createMany({
            data: source.decisions.map((d) => ({
              reportSectionId: targetSectionId,
              text: d.text,
              owner: d.owner,
              deadline: d.deadline ?? null,
              impact: d.impact,
              resolvedAt: d.resolvedAt ?? null,
            })),
          });
          copiedItems += source.decisions.length;
        }

        // Copy priorities from source
        if (source.priorities.length > 0) {
          await tx.priority.createMany({
            data: source.priorities.map((p) => ({
              reportSectionId: targetSectionId,
              rank: p.rank,
              text: p.text,
            })),
          });
          copiedItems += source.priorities.length;
        }
      },
      { timeout: 15000 },
    );

    return copiedItems;
  }

  async listVersions(sectionId: string): Promise<VersionSnapshot[]> {
    const rows = await this.prisma.versionSnapshot.findMany({
      where: { reportSectionId: sectionId },
      orderBy: { version: 'desc' },
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
      where: { reportSectionId_version: { reportSectionId: sectionId, version } },
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
      }>;
      risks: Array<{
        projectId: string;
        risk: string;
        impact: string;
        mitigation: string;
      }>;
      decisions: Array<{
        text: string;
        owner: string;
        deadline: string | null;
        impact: string;
        resolvedAt: string | null;
      }>;
      priorities: Array<{
        rank: number;
        text: string;
      }>;
    };

    await this.prisma.$transaction(
      async (tx) => {
        await tx.item.deleteMany({ where: { reportSectionId: sectionId } });
        await tx.risk.deleteMany({ where: { reportSectionId: sectionId } });
        await tx.decision.deleteMany({ where: { reportSectionId: sectionId } });
        await tx.priority.deleteMany({ where: { reportSectionId: sectionId } });

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
            })),
          });
        }

        if (data.decisions.length > 0) {
          await tx.decision.createMany({
            data: data.decisions.map((d) => ({
              reportSectionId: sectionId,
              text: d.text,
              owner: d.owner,
              deadline: d.deadline ? new Date(d.deadline) : null,
              impact: d.impact,
              resolvedAt: d.resolvedAt ? new Date(d.resolvedAt) : null,
            })),
          });
        }

        if (data.priorities.length > 0) {
          await tx.priority.createMany({
            data: data.priorities.map((p) => ({
              reportSectionId: sectionId,
              rank: p.rank,
              text: p.text,
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
    // Log the reopen request — no dedicated table yet.
    // In production this would create a notification record for the head.
    console.log(
      `[ReopenRequest] section=${sectionId} user=${userId} reason=${reason ?? 'none'}`,
    );
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
      orderBy: { version: 'desc' },
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
      })),
      risks: section.risks.map((r) => ({
        projectId: r.projectId,
        risk: r.risk,
        impact: r.impact,
        mitigation: r.mitigation,
      })),
      decisions: section.decisions.map((d) => ({
        text: d.text,
        owner: d.owner,
        deadline: d.deadline?.toISOString() ?? null,
        impact: d.impact,
        resolvedAt: d.resolvedAt?.toISOString() ?? null,
      })),
      priorities: section.priorities.map((p) => ({
        rank: p.rank,
        text: p.text,
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
        orderBy: { version: 'asc' },
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
}
