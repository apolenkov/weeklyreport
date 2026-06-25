import type { ReportSectionReadModel } from "@customreport/shared";
import { shortNameFromName } from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type {
  CrossAuthorSectionRow,
  LeadFormRepository,
} from "./lead-form.service";
import { initialsFromName } from "./lead-form-shared";
import {
  mapPrismaToReportSection,
  reportSectionFullInclude,
} from "./report-sections.prisma-repository";

/**
 * Mirrors `normalizeStageName` in apps/web/src/lib/mappers/lead-form.ts — the
 * "Development" ↔ "Dev" alias collapses to one canonical pipeline slot. Inlined
 * here because lib/mappers must not be imported across the api/web boundary.
 */
function normalizeStageName(stageName: string): string {
  const lower = stageName.toLowerCase();
  return lower === "development" ? "dev" : lower;
}

/** API traffic-light enum; null = no data / untouched stage. */
type StageTrafficStatus = "green" | "yellow" | "red" | null;

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

  async getReportPeriodStatusForSection(
    sectionId: string,
  ): Promise<string | null> {
    const row = await this.prisma.reportSection.findUnique({
      where: { id: sectionId },
      select: { report: { select: { periodStatus: true } } },
    });
    return row?.report.periodStatus ?? null;
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
      authorInitials: string;
      authorShortName: string;
      stageNames: string[];
      stages: {
        stageName: string;
        status: StageTrafficStatus;
      }[];
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

    // Persisted stage traffic + covering risks for each foreign author in this
    // report. Only `severity` + `stageNames` of the risk are needed: the stage
    // status is RISK-DERIVED (covering risks that name the stage), never the
    // foreign item text. The persisted traffic is consulted only as the
    // empty/non-empty base when no risk covers the stage.
    const otherUserIds = [...new Set(others.map((o) => o.user.id))];
    const sections = await this.prisma.reportSection.findMany({
      where: { reportId, authorId: { in: otherUserIds } },
      select: {
        authorId: true,
        risks: {
          select: { projectId: true, severity: true, stageNames: true },
        },
        stageStatuses: {
          select: { projectId: true, stageId: true, status: true },
        },
      },
    });

    // Persisted-traffic lookup: "authorId::projectId::stageId" → green/yellow/red.
    const statusMap = new Map<string, "green" | "yellow" | "red">();
    // Per-author covering risks, grouped by projectId for the stage match.
    const risksByAuthor = new Map<
      string,
      { projectId: string; severity: string; stageNames: string[] }[]
    >();
    for (const s of sections) {
      for (const ss of s.stageStatuses) {
        if (ss.status !== null) {
          statusMap.set(
            `${s.authorId}::${ss.projectId}::${ss.stageId}`,
            ss.status,
          );
        }
      }
      risksByAuthor.set(s.authorId, s.risks);
    }

    // Group by (projectId, authorId)
    const grouped = new Map<
      string,
      {
        projectId: string;
        projectName: string;
        authorId: string;
        authorInitials: string;
        authorShortName: string;
        stageNames: Set<string>;
        stageEntries: {
          stageName: string;
          status: StageTrafficStatus;
        }[];
      }
    >();

    for (const row of others) {
      if (row.project.archived) continue;
      const key = `${row.projectId}::${row.user.id}`;
      const persisted =
        statusMap.get(`${row.user.id}::${row.projectId}::${row.stageId}`) ??
        null;
      const stageStatus = this.deriveForeignStageStatus(
        row.stage.name,
        row.projectId,
        risksByAuthor.get(row.user.id) ?? [],
        persisted,
      );
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          projectId: row.projectId,
          projectName: row.project.name,
          authorId: row.user.id,
          // Derive display forms server-side (ADR 0006): the two-letter mark for
          // avatars/micro-chips, and the SHORT form ("Кузнецова М.А.") for the
          // cross-author stage label. Only these leave the method — never the
          // full ФИО.
          authorInitials: initialsFromName(row.user.name),
          authorShortName: shortNameFromName(row.user.name),
          stageNames: new Set([row.stage.name]),
          stageEntries: [{ stageName: row.stage.name, status: stageStatus }],
        });
      } else {
        existing.stageNames.add(row.stage.name);
        existing.stageEntries.push({
          stageName: row.stage.name,
          status: stageStatus,
        });
      }
    }

    return [...grouped.values()].map((g) => ({
      projectId: g.projectId,
      projectName: g.projectName,
      authorId: g.authorId,
      authorInitials: g.authorInitials,
      authorShortName: g.authorShortName,
      stageNames: [...g.stageNames],
      stages: g.stageEntries,
    }));
  }

  async getCrossAuthorContent(
    reportId: string,
    userId: string,
  ): Promise<{ coOwnsShared: boolean; rows: CrossAuthorSectionRow[] }> {
    // Step 1: resolve the caller's assigned products (same join as
    // getCrossAuthors), then co-owners on shared, NON-ARCHIVED products.
    const myAssignments = await this.prisma.stageAssignment.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const myProjectIds = [...new Set(myAssignments.map((r) => r.projectId))];
    if (myProjectIds.length === 0) return { coOwnsShared: false, rows: [] };

    const others = await this.prisma.stageAssignment.findMany({
      where: {
        projectId: { in: myProjectIds },
        userId: { not: userId },
        project: { archived: false },
      },
      select: {
        projectId: true,
        stageId: true,
        stage: { select: { name: true } },
        user: { select: { id: true, name: true } },
      },
    });

    // Per-author set of shared, non-archived projectIds + the author's stage
    // assignments on those products (the chips come from assignments, not the
    // section — a co-owner's stage exists even with no persisted status row).
    const authorProjectMap = new Map<
      string,
      {
        authorId: string;
        authorName: string;
        sharedProjectIds: Set<string>;
        stageAssignments: {
          projectId: string;
          stageId: string;
          stageName: string;
        }[];
      }
    >();
    for (const row of others) {
      const assignment = {
        projectId: row.projectId,
        stageId: row.stageId,
        stageName: row.stage.name,
      };
      const existing = authorProjectMap.get(row.user.id);
      if (existing) {
        existing.sharedProjectIds.add(row.projectId);
        existing.stageAssignments.push(assignment);
      } else {
        authorProjectMap.set(row.user.id, {
          authorId: row.user.id,
          authorName: row.user.name,
          sharedProjectIds: new Set([row.projectId]),
          stageAssignments: [assignment],
        });
      }
    }

    // `coOwnsShared` is the co-ownership authorization signal (D6b): true iff
    // the caller co-owns at least one shared, non-archived product. It is kept
    // separate from row-emptiness so the service can label a denied read
    // (co-owns nothing) distinctly from a legitimately empty one (co-owns a
    // product but the co-owner authored no records).
    const coOwnsShared = authorProjectMap.size > 0;
    if (!coOwnsShared) return { coOwnsShared: false, rows: [] };

    const otherUserIds = [...authorProjectMap.keys()];

    // Step 2: fetch foreign sections + covering risks (for risk-derived chips).
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
        stageStatuses: {
          select: { projectId: true, stageId: true, status: true },
        },
      },
    });

    // Step 3: build per-author rows filtered to shared products only.
    const rows: CrossAuthorSectionRow[] = [];
    for (const section of sections) {
      const authorEntry = authorProjectMap.get(section.authorId);
      if (!authorEntry) continue;
      const sharedIds = authorEntry.sharedProjectIds;

      // Risk-derived foreign stage chips (canonical rule), reusing the same
      // derivation as the status-only read. The author's stage assignments on
      // shared products (collected above) define which chips exist; the
      // section's persisted statuses provide the empty/non-empty base.
      const persistedStatus = new Map<string, "green" | "yellow" | "red">();
      for (const ss of section.stageStatuses) {
        if (ss.status !== null) {
          persistedStatus.set(`${ss.projectId}::${ss.stageId}`, ss.status);
        }
      }
      const stages = authorEntry.stageAssignments.map((sa) => ({
        projectId: sa.projectId,
        stageName: sa.stageName,
        status: this.deriveForeignStageStatus(
          sa.stageName,
          sa.projectId,
          section.risks,
          persistedStatus.get(`${sa.projectId}::${sa.stageId}`) ?? null,
        ),
      }));

      rows.push({
        authorId: authorEntry.authorId,
        authorName: authorEntry.authorName,
        sharedProductIds: [...sharedIds],
        stages,
        items: section.items.filter((i) => sharedIds.has(i.projectId)),
        risks: section.risks.filter((r) => sharedIds.has(r.projectId)),
        decisions: section.decisions.filter((d) => sharedIds.has(d.productId)),
      });
    }

    return { coOwnsShared, rows };
  }

  /**
   * Risk-derived foreign stage status. Mirrors `deriveEffectiveStageStatus`
   * (apps/web/src/lib/stage-status.ts) with `items: []` — the foreign blocked-
   * item path is intentionally NOT consulted here.
   *
   * Precedence over covering risks (those whose `stageNames` name this stage,
   * Dev↔Development aliased): blocked → red, any other severity → yellow.
   * With no covering risk the persisted traffic is used only as the
   * empty/non-empty base — a persisted yellow/red with no backing risk
   * collapses to green; a null base stays null.
   */
  private deriveForeignStageStatus(
    stageName: string,
    projectId: string,
    risks: readonly {
      projectId: string;
      severity: string;
      stageNames: string[];
    }[],
    persisted: StageTrafficStatus,
  ): StageTrafficStatus {
    const norm = normalizeStageName(stageName);
    const covering = risks.filter(
      (r) =>
        r.projectId === projectId &&
        // An empty stageNames is the canonical "covers all assigned stages"
        // marker (mirrors riskCoversStage in stage-tags.ts and the Add-Risk
        // dialog default). Without this, a co-lead's covers-all blocked risk
        // would colour no foreign stage and product health would read green.
        (r.stageNames.length === 0 ||
          r.stageNames.some((n) => normalizeStageName(n) === norm)),
    );
    if (covering.some((r) => r.severity === "blocked")) return "red";
    if (covering.length > 0) return "yellow";
    // No covering risk: the stage is on-track if it was touched at all,
    // otherwise empty. The persisted traffic value itself never colours.
    return persisted === null ? null : "green";
  }
}
