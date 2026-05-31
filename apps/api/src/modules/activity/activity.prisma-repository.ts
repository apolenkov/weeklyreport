import type {
  ActivityLiveResponse,
  ActivityLiveRow,
  UserSession,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter } from "../../lib/group-scope.js";
import type { ActivityRepository } from "./activity.service.js";

@Injectable()
export class ActivityPrismaRepository implements ActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * UX-18: assemble the activity rows for the head dashboard panel.
   *
   * 1. Resolve the current open period (most recent periodStatus='open').
   * 2. Load every lead user once.
   * 3. Load every section for the period in one query, joining items /
   *    risks / decisions / priorities so we can compute counts and the
   *    last-edit timestamp without N round-trips.
   * 4. Map leads → rows (some may have no section yet → status=draft,
   *    counts=0, lastEditAt=null).
   */
  async getLiveActivity(session: UserSession): Promise<ActivityLiveResponse> {
    const report = await this.prisma.report.findFirst({
      where: { periodStatus: { in: ["open", "reopened"] } },
      orderBy: { periodStart: "desc" },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        periodStatus: true,
      },
    });

    if (!report) {
      return {
        reportId: null,
        periodStart: null,
        periodEnd: null,
        periodStatus: null,
        rows: [],
      };
    }

    const leads = await this.prisma.user.findMany({
      where: { role: "lead", ...groupScopeFilter(session, "user") },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });

    const sections = await this.prisma.reportSection.findMany({
      where: {
        reportId: report.id,
        ...groupScopeFilter(session, "reportSection"),
      },
      include: {
        items: { select: { id: true, updatedAt: true, priorityRank: true } },
        risks: { select: { id: true, updatedAt: true } },
        decisions: { select: { id: true, updatedAt: true } },
      },
    });

    const sectionByAuthor = new Map(
      sections.map((s) => [s.authorId, s] as const),
    );

    const rows: ActivityLiveRow[] = leads.map((lead) => {
      const section = sectionByAuthor.get(lead.id);
      if (!section) {
        return {
          reportId: report.id,
          reportSectionId: null,
          leadId: lead.id,
          leadName: lead.name,
          email: lead.email,
          status: "draft",
          itemCount: 0,
          riskCount: 0,
          decisionCount: 0,
          priorityCount: 0,
          lastEditAt: null,
          submittedAt: null,
        };
      }

      // lastEditAt = max(section.updatedAt, item/risk/decision.updatedAt).
      // submittedAt acts as a stronger floor when present.
      const childTimestamps: Date[] = [
        section.updatedAt,
        ...section.items.map((x) => x.updatedAt),
        ...section.risks.map((x) => x.updatedAt),
        ...section.decisions.map((x) => x.updatedAt),
      ];
      const lastEditAt =
        childTimestamps.length > 0
          ? new Date(Math.max(...childTimestamps.map((d) => d.getTime())))
          : null;

      return {
        reportId: report.id,
        reportSectionId: section.id,
        leadId: lead.id,
        leadName: lead.name,
        email: lead.email,
        status: section.status,
        itemCount: section.items.length,
        riskCount: section.risks.length,
        decisionCount: section.decisions.length,
        priorityCount: section.items.filter((x) => x.priorityRank != null)
          .length,
        lastEditAt,
        submittedAt: section.submittedAt,
      };
    });

    // Order: drafts first (need attention), then submitted; alpha within
    // each group. Mirrors review.dashboard sort.
    rows.sort((a, b) => {
      const statusDiff =
        (a.status === "submitted" ? 1 : 0) - (b.status === "submitted" ? 1 : 0);
      if (statusDiff !== 0) return statusDiff;
      return a.leadName.localeCompare(b.leadName, "ru");
    });

    return {
      reportId: report.id,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      periodStatus: report.periodStatus,
      rows,
    };
  }
}
