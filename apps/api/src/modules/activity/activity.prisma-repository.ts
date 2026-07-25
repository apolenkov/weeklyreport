import type {
  ActivityLiveResponse,
  ActivityLiveRow,
  UserSession,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter } from "../../lib/group-scope.js";
import type { ActivityRepository } from "./activity.service.js";

interface ActivityReport {
  readonly id: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly periodStatus: ActivityLiveResponse["periodStatus"];
}

interface ActivityLead {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

interface ActivitySection {
  readonly id: string;
  readonly authorId: string;
  readonly status: ActivityLiveRow["status"];
  readonly submittedAt: Date | null;
  readonly updatedAt: Date;
  readonly items: readonly {
    readonly updatedAt: Date;
    readonly priorityRank: number | null;
  }[];
  readonly risks: readonly { readonly updatedAt: Date }[];
  readonly decisions: readonly { readonly updatedAt: Date }[];
}

const emptyActivity = (): ActivityLiveResponse => ({
  reportId: null,
  periodStart: null,
  periodEnd: null,
  periodStatus: null,
  rows: [],
});

function buildActivityRow(
  reportId: string,
  lead: ActivityLead,
  section?: ActivitySection,
): ActivityLiveRow {
  if (!section) {
    return {
      reportId,
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
  const timestamps = [
    section.updatedAt,
    ...section.items.map(({ updatedAt }) => updatedAt),
    ...section.risks.map(({ updatedAt }) => updatedAt),
    ...section.decisions.map(({ updatedAt }) => updatedAt),
  ];
  return {
    reportId,
    reportSectionId: section.id,
    leadId: lead.id,
    leadName: lead.name,
    email: lead.email,
    status: section.status,
    itemCount: section.items.length,
    riskCount: section.risks.length,
    decisionCount: section.decisions.length,
    priorityCount: section.items.filter(
      ({ priorityRank }) => priorityRank != null,
    ).length,
    lastEditAt: new Date(Math.max(...timestamps.map((date) => date.getTime()))),
    submittedAt: section.submittedAt,
  };
}

const sortActivityRows = (rows: readonly ActivityLiveRow[]) =>
  [...rows].sort((left, right) => {
    const statusDifference =
      (left.status === "submitted" ? 1 : 0) -
      (right.status === "submitted" ? 1 : 0);
    return (
      statusDifference || left.leadName.localeCompare(right.leadName, "ru")
    );
  });

@Injectable()
export class ActivityPrismaRepository implements ActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Single join of sections+children avoids N round-trips for counts and last-edit.
  async getLiveActivity(
    reportId: string | null,
    session: UserSession,
  ): Promise<ActivityLiveResponse> {
    if (!reportId) return emptyActivity();
    const report: ActivityReport | null = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        periodStatus: true,
      },
    });

    if (!report) return emptyActivity();

    const [leads, sections]: [ActivityLead[], ActivitySection[]] =
      await Promise.all([
        this.prisma.user.findMany({
          where: { role: "lead", ...groupScopeFilter(session, "user") },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        }),
        this.prisma.reportSection.findMany({
          where: {
            reportId: report.id,
            ...groupScopeFilter(session, "reportSection"),
          },
          include: {
            items: { select: { updatedAt: true, priorityRank: true } },
            risks: { select: { updatedAt: true } },
            decisions: { select: { updatedAt: true } },
          },
        }),
      ]);

    const sectionByAuthor = new Map(
      sections.map((s) => [s.authorId, s] as const),
    );

    const rows = sortActivityRows(
      leads.map((lead) =>
        buildActivityRow(report.id, lead, sectionByAuthor.get(lead.id)),
      ),
    );

    return {
      reportId: report.id,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      periodStatus: report.periodStatus,
      rows,
    };
  }
}
