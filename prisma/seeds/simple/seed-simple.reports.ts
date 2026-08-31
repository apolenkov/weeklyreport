import {
  PeriodState,
  PeriodStatus,
  type PrismaClient,
  ReportStatus,
  TrafficLightStatus,
} from "@prisma/client";

import { provisionalPublishedSnapshot } from "../support/published-snapshot.js";
import { HEAD_ID, REPORT_ACTIVE, REPORT_PUBLISHED } from "./seed-simple.ids.js";
import {
  ACTIVE_FRIDAY_DEADLINE,
  ACTIVE_MONDAY,
  ACTIVE_SUNDAY,
  endOfDayUTC,
  EXTRA_REPORTS,
  fridayDeadlineFor,
  isoWeekNumber,
  LAST_DAY_OF_WEEK_OFFSET,
  plusDaysUTC,
  PREV_FRIDAY_DEADLINE,
  PREV_MONDAY,
  PREV_SUNDAY,
} from "./seed-simple.period.js";

function demoPublishedSnapshot(input: {
  reportId: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date;
  publishedAt: Date;
}) {
  return {
    reportId: input.reportId,
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    deadline: input.deadline.toISOString(),
    status: ReportStatus.published,
    publishedAt: input.publishedAt.toISOString(),
    publishedById: HEAD_ID,
    publishedByName: "Елена Р.",
    portfolioOverview: {
      status: TrafficLightStatus.green,
      totals: { green: 1, yellow: 0, red: 0 },
    },
    sections: [],
  };
}

const REPORT_ROWS = [
  {
    id: REPORT_ACTIVE,
    periodStart: ACTIVE_MONDAY,
    periodEnd: ACTIVE_SUNDAY,
    deadline: ACTIVE_FRIDAY_DEADLINE,
    weekLabel: `Week ${isoWeekNumber(ACTIVE_MONDAY)}`,
    periodStatus: PeriodStatus.open,
    status: ReportStatus.draft,
    periodState: PeriodState.open,
  },
  {
    id: REPORT_PUBLISHED,
    periodStart: PREV_MONDAY,
    periodEnd: PREV_SUNDAY,
    deadline: PREV_FRIDAY_DEADLINE,
    weekLabel: `Week ${isoWeekNumber(PREV_MONDAY)}`,
    periodStatus: PeriodStatus.published,
    status: ReportStatus.published,
    publishedAt: PREV_SUNDAY,
    publishedById: HEAD_ID,
    periodState: PeriodState.published,
    publishedSnapshot: demoPublishedSnapshot({
      reportId: REPORT_PUBLISHED,
      periodStart: PREV_MONDAY,
      periodEnd: PREV_SUNDAY,
      deadline: PREV_FRIDAY_DEADLINE,
      publishedAt: PREV_SUNDAY,
    }),
  },
  ...EXTRA_REPORTS.map((r) => {
    const isPublished = r.status === ReportStatus.published;
    return {
      id: r.id,
      periodStart: r.monday,
      periodEnd: endOfDayUTC(plusDaysUTC(r.monday, LAST_DAY_OF_WEEK_OFFSET)),
      deadline: fridayDeadlineFor(r.monday),
      weekLabel: `Week ${isoWeekNumber(r.monday)}`,
      periodStatus: r.periodStatus,
      status: r.status,
      archived: isPublished,
      periodState: isPublished ? PeriodState.archived : PeriodState.scheduled,
      ...(r.publishedAt === undefined ? {} : { publishedAt: r.publishedAt }),
      publishedById: r.publishedAt ? HEAD_ID : null,
      ...(isPublished && r.publishedAt
        ? {
            publishedSnapshot: provisionalPublishedSnapshot({
              reportId: r.id,
              periodStart: r.monday,
              periodEnd: endOfDayUTC(
                plusDaysUTC(r.monday, LAST_DAY_OF_WEEK_OFFSET),
              ),
              deadline: fridayDeadlineFor(r.monday),
              publishedAt: r.publishedAt,
              publishedById: HEAD_ID,
              publishedByName: "Елена Р.",
            }),
          }
        : {}),
    };
  }),
];

export async function seedReports(prisma: PrismaClient): Promise<void> {
  console.log(
    "[seed-simple] Creating reports (active=current week, published=previous week)...",
  );
  await prisma.report.createMany({ data: REPORT_ROWS });
}
