import type {
  ReportSectionReadModel,
  VersionSnapshot,
} from "@customreport/shared";
import { versionSnapshotSchema } from "@customreport/shared";
import { Injectable } from "@nestjs/common";
import type { ItemType, ItemWorkflowStatus, Prisma } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type {
  CrossAuthorSectionRow,
  LeadFormRepository,
} from "./lead-form.service";
import {
  mapPrismaToReportSection,
  reportSectionFullInclude,
} from "./report-sections.prisma-repository";

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

  /** SC-165: Revoke every submitted section in a report atomically. */
  async revokeAllSubmitted(
    reportId: string,
    revokedBy: string,
  ): Promise<number> {
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      return tx.reportSection.updateMany({
        where: { reportId, status: "submitted" },
        data: {
          status: "draft",
          revokedAt: now,
          revokedBy,
          submittedAt: null,
        },
      });
    });
    return result.count;
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
              stageNames: i.stageNames,
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
              stageNames: r.stageNames,
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
              stageNames: d.stageNames,
              productId: d.productId,
            })),
          });
          copiedItems += decisionsToCopy.length;
        }
      },
      { timeout: 15_000 },
    );

    return copiedItems;
  }

  async getVersion(
    sectionId: string,
    version: number,
  ): Promise<Record<string, unknown> | null> {
    const snapshot = await this.prisma.versionSnapshot.findUnique({
      where: {
        reportSectionId_version: { reportSectionId: sectionId, version },
      },
      select: { data: true },
    });
    return (snapshot?.data ?? null) as Record<string, unknown> | null;
  }

  async listVersions(sectionId: string): Promise<VersionSnapshot[]> {
    const rows = await this.prisma.versionSnapshot.findMany({
      where: { reportSectionId: sectionId },
      orderBy: { version: "desc" },
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
      items: {
        projectId: string;
        type: string;
        text: string;
        tag: string;
        workflowStatus: string;
        carriedOver: boolean;
        completed: boolean | null;
        priorityRank?: number | null;
        stageName?: string | null;
        stageIds?: string[];
        stageNames?: string[];
      }[];
      risks: {
        projectId: string;
        risk: string;
        impact: string;
        mitigation: string;
        severity?: string | null;
        stageName?: string | null;
        stageIds?: string[];
        stageNames?: string[];
      }[];
      decisions: {
        text: string;
        owner: string;
        deadline: string | null;
        impact: string;
        resolvedAt: string | null;
        stageName?: string | null;
        stageIds?: string[];
        stageNames?: string[];
        productId?: string | null;
      }[];
      stageStatuses?: {
        projectId: string;
        stageId: string;
        stageName?: string;
        status: "green" | "yellow" | "red" | null;
      }[];
    };

    await this.prisma.$transaction(
      async (tx) => {
        // TODO(v8.5-A-occ): wipe+recreate has no OCC version check — last writer
        // wins silently. Replace with version-gated UPDATE + tx when v8.5 ships.
        await tx.item.deleteMany({ where: { reportSectionId: sectionId } });
        await tx.risk.deleteMany({ where: { reportSectionId: sectionId } });
        await tx.decision.deleteMany({ where: { reportSectionId: sectionId } });
        // F3.3 (T-G5): wipe + rebuild stage statuses so chip colors track the
        // restored snapshot. Snapshots created before this field was added
        // simply leave `stageStatuses` undefined → keep current statuses.
        if (data.stageStatuses !== undefined) {
          await tx.stageStatus.deleteMany({
            where: { reportSectionId: sectionId },
          });
        }

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
              priorityRank: i.priorityRank ?? null,
              stageNames:
                i.stageNames ??
                i.stageIds ??
                (i.stageName ? [i.stageName] : []),
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
              severity: r.severity ?? "at-risk",
              stageNames:
                r.stageNames ??
                r.stageIds ??
                (r.stageName ? [r.stageName] : []),
            })),
          });
        }

        const decisionsToRestore = data.decisions.filter(
          (d): d is typeof d & { productId: string } => Boolean(d.productId),
        );
        if (decisionsToRestore.length > 0) {
          await tx.decision.createMany({
            data: decisionsToRestore.map((d) => ({
              reportSectionId: sectionId,
              text: d.text,
              owner: d.owner,
              deadline: d.deadline ? new Date(d.deadline) : null,
              impact: d.impact,
              resolvedAt: d.resolvedAt ? new Date(d.resolvedAt) : null,
              stageNames:
                d.stageNames ??
                d.stageIds ??
                (d.stageName ? [d.stageName] : []),
              productId: d.productId,
            })),
          });
        }

        if (data.stageStatuses && data.stageStatuses.length > 0) {
          await tx.stageStatus.createMany({
            data: data.stageStatuses.map((ss) => ({
              reportSectionId: sectionId,
              projectId: ss.projectId,
              stageId: ss.stageId,
              status: ss.status,
            })),
          });
        }
      },
      { timeout: 15_000 },
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

  private buildSnapshotData(
    section: Prisma.ReportSectionGetPayload<{
      include: typeof reportSectionFullInclude;
    }>,
  ): Record<string, unknown> {
    return {
      items: section.items.map((i) => ({
        projectId: i.projectId,
        type: i.type,
        text: i.text,
        tag: i.tag,
        workflowStatus: i.workflowStatus,
        carriedOver: i.carriedOver,
        completed: i.completed ?? null,
        priorityRank: i.priorityRank ?? null,
        stageNames: i.stageNames,
      })),
      risks: section.risks.map((r) => ({
        projectId: r.projectId,
        risk: r.risk,
        impact: r.impact,
        mitigation: r.mitigation,
        severity: r.severity,
        stageNames: r.stageNames,
      })),
      decisions: section.decisions.map((d) => ({
        text: d.text,
        owner: d.owner,
        deadline: d.deadline?.toISOString() ?? null,
        impact: d.impact,
        resolvedAt: d.resolvedAt?.toISOString() ?? null,
        stageNames: d.stageNames,
        productId: d.productId,
      })),
      // F3.3: include stage statuses so version viewer can restore chip colors.
      stageStatuses: section.stageStatuses.map((ss) => ({
        projectId: ss.projectId,
        stageId: ss.stageId,
        stageName:
          (ss as { stage?: { name: string } }).stage?.name ?? ss.stageId,
        status: ss.status,
      })),
    };
  }

  async buildSnapshotProjection(
    sectionId: string,
  ): Promise<Record<string, unknown>> {
    const section = await this.prisma.reportSection.findUnique({
      where: { id: sectionId },
      include: reportSectionFullInclude,
    });

    if (!section) {
      throw new Error(
        `Section ${sectionId} not found for snapshot projection.`,
      );
    }

    return this.buildSnapshotData(section);
  }

  async createVersionSnapshot(sectionId: string): Promise<number> {
    const section = await this.prisma.reportSection.findUnique({
      where: { id: sectionId },
      include: reportSectionFullInclude,
    });

    if (!section) {
      throw new Error(`Section ${sectionId} not found for snapshot.`);
    }

    const maxSnapshot = await this.prisma.versionSnapshot.findFirst({
      where: { reportSectionId: sectionId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const nextVersion = (maxSnapshot?.version ?? 0) + 1;

    const data = this.buildSnapshotData(section);

    await this.prisma.versionSnapshot.create({
      data: {
        reportSectionId: sectionId,
        version: nextVersion,
        data: data as Prisma.InputJsonValue,
      },
    });

    // Time-based retention: keep all <24 h, 1/hour for 24 h–7 d,
    // 1/day for 7 d–30 d, delete everything >30 d.
    await this.prisma.$executeRaw`
      DELETE FROM "VersionSnapshot"
      WHERE "reportSectionId" = ${sectionId}
        AND id NOT IN (
          -- Window 1: keep everything from the last 24 hours
          SELECT id FROM "VersionSnapshot"
          WHERE "reportSectionId" = ${sectionId}
            AND "createdAt" > NOW() - INTERVAL '24 hours'

          UNION ALL

          -- Window 2: keep newest per clock-hour between 24 h and 7 days
          SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                     PARTITION BY date_trunc('hour', "createdAt")
                     ORDER BY "createdAt" DESC
                   ) AS rn
            FROM "VersionSnapshot"
            WHERE "reportSectionId" = ${sectionId}
              AND "createdAt" <= NOW() - INTERVAL '24 hours'
              AND "createdAt" > NOW() - INTERVAL '7 days'
          ) hourly WHERE rn = 1

          UNION ALL

          -- Window 3: keep newest per calendar-day between 7 and 30 days
          SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                     PARTITION BY date_trunc('day', "createdAt")
                     ORDER BY "createdAt" DESC
                   ) AS rn
            FROM "VersionSnapshot"
            WHERE "reportSectionId" = ${sectionId}
              AND "createdAt" <= NOW() - INTERVAL '7 days'
              AND "createdAt" > NOW() - INTERVAL '30 days'
          ) daily WHERE rn = 1
        )
    `;

    return nextVersion;
  }

  async getLatestSnapshot(
    sectionId: string,
  ): Promise<import("./lead-form.service.js").SnapshotLatestRow | null> {
    const row = await this.prisma.versionSnapshot.findFirst({
      where: { reportSectionId: sectionId },
      orderBy: { version: "desc" },
      select: { data: true, createdAt: true, version: true },
    });

    if (!row) return null;

    return {
      data: row.data as Record<string, unknown>,
      createdAt: row.createdAt,
      version: row.version,
    };
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
      stages: {
        stageName: string;
        status: "green" | "yellow" | "red" | null;
      }[];
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
        stageStatuses: {
          select: { projectId: true, stageId: true, status: true },
        },
      },
    });
    const sectionByAuthor = new Map(sections.map((s) => [s.authorId, s]));

    // Build status lookup: "(authorId)::projectId::stageId" → status
    const statusMap = new Map<string, "green" | "yellow" | "red">();
    for (const s of sections) {
      for (const ss of s.stageStatuses) {
        if (ss.status !== null) {
          statusMap.set(
            `${s.authorId}::${ss.projectId}::${ss.stageId}`,
            ss.status,
          );
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
        stageEntries: {
          stageName: string;
          status: "green" | "yellow" | "red" | null;
        }[];
        itemCount: number;
        riskCount: number;
      }
    >();

    for (const row of others) {
      if (row.project.archived) continue;
      const key = `${row.projectId}::${row.user.id}`;
      const stageStatus =
        statusMap.get(`${row.user.id}::${row.projectId}::${row.stageId}`) ??
        null;
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
        entry?.stageEntries.push({
          stageName: row.stage.name,
          status: stageStatus,
        });
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
            stageNames: true,
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
            stageNames: true,
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
            stageNames: true,
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
