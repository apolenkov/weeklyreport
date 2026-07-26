// Report periods: the open active one, the published previous one, and the
// history tail (N-2..N-4) the archived-period filters need.

import {
  PeriodState,
  PeriodStatus,
  type Prisma,
  type PrismaClient,
  ReportStatus,
  TrafficLightStatus,
} from "@prisma/client";

import {
  HEAD_USER_ID,
  SEED_HISTORY_REPORTS,
  SEED_REPORTS,
} from "./seed-constants.js";
import { HEAD_NAME } from "./seed-demo.constants.js";

function activeReportRow(): Prisma.ReportCreateManyInput {
  const active = SEED_REPORTS.active;
  return {
    id: active.id,
    periodStart: new Date(active.periodStart),
    periodEnd: new Date(active.periodEnd),
    deadline: new Date(active.deadline),
    weekLabel: active.weekLabel,
    periodStatus: PeriodStatus.open,
    status: ReportStatus.draft,
    periodState: PeriodState.open,
  };
}

function publishedReportRow(): Prisma.ReportCreateManyInput {
  const published = SEED_REPORTS.published;
  return {
    id: published.id,
    periodStart: new Date(published.periodStart),
    periodEnd: new Date(published.periodEnd),
    deadline: new Date(published.deadline),
    weekLabel: published.weekLabel,
    periodStatus: PeriodStatus.published,
    status: ReportStatus.published,
    periodState: PeriodState.published,
    publishedAt: new Date(published.publishedAt),
    publishedById: HEAD_USER_ID,
    publishedSnapshot: {
      reportId: published.id,
      periodStart: published.periodStart,
      periodEnd: published.periodEnd,
      deadline: published.deadline,
      status: ReportStatus.published,
      publishedAt: published.publishedAt,
      publishedById: HEAD_USER_ID,
      publishedByName: HEAD_NAME,
      portfolioOverview: {
        status: TrafficLightStatus.green,
        totals: { green: 1, yellow: 0, red: 0 },
      },
      sections: [],
    },
  };
}

// History periods (N-2 .. N-4). N-3 and N-4 are archived so the lead report
// toolbar surfaces the show-archived filter (it renders only when the lead has
// at least one archived period). All are published.
function historyReportRows(): Prisma.ReportCreateManyInput[] {
  return SEED_HISTORY_REPORTS.map((h) => ({
    id: h.id,
    periodStart: new Date(h.periodStart),
    periodEnd: new Date(h.periodEnd),
    deadline: new Date(h.deadline),
    weekLabel: h.weekLabel,
    periodStatus: PeriodStatus.published,
    status: ReportStatus.published,
    periodState: h.archived ? PeriodState.archived : PeriodState.published,
    archived: h.archived,
    publishedAt: new Date(h.periodEnd),
    publishedById: HEAD_USER_ID,
  }));
}

export async function seedReports(prisma: PrismaClient): Promise<void> {
  await prisma.report.createMany({
    data: [activeReportRow(), publishedReportRow(), ...historyReportRows()],
  });
}
