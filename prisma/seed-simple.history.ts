import { randomUUID } from "node:crypto";

import {
  ItemType,
  ItemWorkflowStatus,
  type PrismaClient,
  ReportSectionStatus,
  ReportStatus,
  TrafficLightStatus,
} from "@prisma/client";

import { REPORT_PUBLISHED } from "./seed-simple.ids.js";
import { type LeadCfg, LEADS } from "./seed-simple.leads.js";
import {
  endOfDayUTC,
  EXTRA_REPORTS,
  type ExtraReportSeed,
  LAST_DAY_OF_WEEK_OFFSET,
  plusDaysUTC,
  PREV_SUBMIT_AT,
} from "./seed-simple.period.js";

async function seedPublishedSection(
  prisma: PrismaClient,
  lead: LeadCfg,
  leadIdx: number,
): Promise<void> {
  const sectionId = `a0000000-0000-4000-8000-00000000041${leadIdx + 1}`;
  await prisma.reportSection.create({
    data: {
      id: sectionId,
      reportId: REPORT_PUBLISHED,
      authorId: lead.id,
      status: ReportSectionStatus.submitted,
      submittedAt: PREV_SUBMIT_AT,
    },
  });
  await prisma.projectStatus.create({
    data: {
      id: randomUUID(),
      reportSectionId: sectionId,
      projectId: lead.productId,
      status: TrafficLightStatus.green,
    },
  });
  await prisma.item.createMany({
    data: [
      {
        id: randomUUID(),
        reportSectionId: sectionId,
        type: ItemType.current,
        projectId: lead.productId,
        text: `Закрыли спринтовые цели команды ${lead.label} на прошлой неделе`,
        tag: "feature",
        workflowStatus: ItemWorkflowStatus.done,
        carriedOver: false,
        priorityRank: 1,
      },
      {
        id: randomUUID(),
        reportSectionId: sectionId,
        type: ItemType.next,
        projectId: lead.productId,
        text: "Перенос: продолжить рефакторинг авторизации",
        tag: "feature",
        workflowStatus: ItemWorkflowStatus.planned,
        carriedOver: false,
      },
    ],
  });
}

// Previous week's sections carry the RU content the "Fill from Previous"
// affordance copies forward.
export async function seedPublishedWeekSections(
  prisma: PrismaClient,
): Promise<void> {
  console.log(
    '[seed-simple] Creating published-week sections (RU "Fill from Previous" content)...',
  );
  for (const [leadIdx, lead] of LEADS.entries()) {
    await seedPublishedSection(prisma, lead, leadIdx);
  }
}

interface ArchiveSectionContext {
  reportId: string;
  sectionId: string;
  submittedAt: Date;
  createdAt: Date;
  lightStatus: TrafficLightStatus;
}

function buildArchiveItemRows(lead: LeadCfg, ctx: ArchiveSectionContext) {
  const { sectionId, submittedAt, createdAt } = ctx;
  return [
    {
      id: randomUUID(),
      reportSectionId: sectionId,
      type: ItemType.current,
      projectId: lead.productId,
      text: `Архив: закрыли ключевые задачи периода для команды ${lead.label}`,
      tag: "feature",
      workflowStatus: ItemWorkflowStatus.done,
      carriedOver: false,
      stageNames: ["Development"],
      priorityRank: 1,
      createdAt,
      updatedAt: submittedAt,
    },
    {
      id: randomUUID(),
      reportSectionId: sectionId,
      type: ItemType.next,
      projectId: lead.productId,
      text: `Архив: перенесли следующий фокус команды ${lead.label} в новый период`,
      tag: "ops",
      workflowStatus: ItemWorkflowStatus.planned,
      carriedOver: false,
      stageNames: ["Development"],
      createdAt,
      updatedAt: submittedAt,
    },
  ];
}

async function seedArchiveSection(
  prisma: PrismaClient,
  lead: LeadCfg,
  ctx: ArchiveSectionContext,
): Promise<void> {
  const { sectionId, submittedAt, createdAt } = ctx;
  await prisma.reportSection.create({
    data: {
      id: sectionId,
      reportId: ctx.reportId,
      authorId: lead.id,
      status: ReportSectionStatus.submitted,
      submittedAt,
      createdAt,
      updatedAt: submittedAt,
    },
  });
  await prisma.projectStatus.create({
    data: {
      id: randomUUID(),
      reportSectionId: sectionId,
      projectId: lead.productId,
      status: ctx.lightStatus,
      createdAt,
      updatedAt: submittedAt,
    },
  });
  await prisma.item.createMany({ data: buildArchiveItemRows(lead, ctx) });
}

// Only the first lead's traffic light varies across periods — enough to give
// the archive a visible trend without repainting every section.
const ARCHIVE_TRAFFIC_BY_PERIOD = [
  TrafficLightStatus.green,
  TrafficLightStatus.yellow,
  TrafficLightStatus.green,
  TrafficLightStatus.red,
] as const;

async function seedArchivePeriod(
  prisma: PrismaClient,
  report: ExtraReportSeed,
  reportIdx: number,
): Promise<void> {
  const submittedAt =
    report.publishedAt ??
    endOfDayUTC(plusDaysUTC(report.monday, LAST_DAY_OF_WEEK_OFFSET));
  const createdAt = plusDaysUTC(report.monday, 1);
  const firstLeadStatus = ARCHIVE_TRAFFIC_BY_PERIOD.at(reportIdx);
  if (!firstLeadStatus) {
    throw new Error(
      `No archive traffic light configured for period ${reportIdx}`,
    );
  }

  for (const [leadIdx, lead] of LEADS.entries()) {
    await seedArchiveSection(prisma, lead, {
      reportId: report.id,
      sectionId: `a0000000-0000-4000-8000-0000000005${reportIdx + 1}${leadIdx + 1}`,
      submittedAt,
      createdAt,
      lightStatus: leadIdx === 0 ? firstLeadStatus : TrafficLightStatus.green,
    });
  }
}

export async function seedArchivedHistory(prisma: PrismaClient): Promise<void> {
  console.log(
    "[seed-simple] Creating archived lead history sections (4 periods)...",
  );
  const archivedReports = EXTRA_REPORTS.filter(
    (report) => report.status === ReportStatus.published,
  );
  for (const [reportIdx, report] of archivedReports.entries()) {
    await seedArchivePeriod(prisma, report, reportIdx);
  }
}
