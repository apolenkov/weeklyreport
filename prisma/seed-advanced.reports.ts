import type { PrismaClient } from "@prisma/client";
import {
  PeriodState,
  PeriodStatus,
  Prisma,
  ReportStatus,
} from "@prisma/client";

import { HEAD_USER_ID, SEED_REPORTS } from "./seed-constants.js";

const activeReport = SEED_REPORTS.active;
const publishedReport = SEED_REPORTS.published;

const ACTIVE_FIELDS = {
  periodStart: new Date(activeReport.periodStart),
  periodEnd: new Date(activeReport.periodEnd),
  deadline: new Date(activeReport.deadline),
  status: ReportStatus[activeReport.status],
  periodStatus: PeriodStatus[activeReport.periodStatus],
  periodState: PeriodState.open,
  archived: false,
  weekLabel: activeReport.weekLabel,
};

const PUBLISHED_FIELDS = {
  periodStart: new Date(publishedReport.periodStart),
  periodEnd: new Date(publishedReport.periodEnd),
  deadline: new Date(publishedReport.deadline),
  status: ReportStatus[publishedReport.status],
  periodStatus: PeriodStatus[publishedReport.periodStatus],
  periodState: PeriodState.published,
  archived: false,
  weekLabel: publishedReport.weekLabel,
  publishedAt: new Date(publishedReport.publishedAt),
  publishedById: HEAD_USER_ID,
  // Section rows stay the source of truth for the advanced seed's content: a
  // stale empty snapshot makes /reports/<id> render 0 products even when the
  // seeded published report has submitted sections.
  publishedSnapshot: Prisma.DbNull,
};

export async function seedActiveReport(prisma: PrismaClient): Promise<number> {
  await prisma.report.upsert({
    where: { id: activeReport.id },
    update: ACTIVE_FIELDS,
    create: { id: activeReport.id, ...ACTIVE_FIELDS },
  });
  return 1;
}

export async function seedPublishedReport(
  prisma: PrismaClient,
): Promise<number> {
  await prisma.report.upsert({
    where: { id: publishedReport.id },
    update: PUBLISHED_FIELDS,
    create: { id: publishedReport.id, ...PUBLISHED_FIELDS },
  });
  return 1;
}
