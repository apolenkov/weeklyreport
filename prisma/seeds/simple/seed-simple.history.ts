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

// Deterministic history IDs make re-runs idempotent; published and archive
// blocks stay disjoint so residue from another seed cannot satisfy the journey.
const HISTORY_ID_PREFIX = "c0000000-0000-4000-8000-";
const HEX_RADIX = 16;
const UUID_TAIL_WIDTH = 12;
export const historyRowId = (tail: number): string =>
  `${HISTORY_ID_PREFIX}${tail.toString(HEX_RADIX).padStart(UUID_TAIL_WIDTH, "0")}`;

const PUBLISHED_SECTION_ID_PREFIX = "a0000000-0000-4000-8000-";
const PUBLISHED_SECTION_BASE_TAIL = 0x4_11;
export const publishedSectionId = (leadIndex: number): string =>
  `${PUBLISHED_SECTION_ID_PREFIX}${(PUBLISHED_SECTION_BASE_TAIL + leadIndex)
    .toString(HEX_RADIX)
    .padStart(UUID_TAIL_WIDTH, "0")}`;

// Row-kind anchors inside the history id space: the published week's status,
// current item and next item, then per-period archive rows below.
const PUBLISHED_STATUS_TAIL = 0x6_00;
const PUBLISHED_CURRENT_ITEM_TAIL = 0x6_10;
const PUBLISHED_NEXT_ITEM_TAIL = 0x6_20;
// Archive rows use a 0x40 block per period: item1 = base + N*0x40 + L,
// item2 = ... + 0x10, status = ... + 0x20; the unused tail keeps blocks disjoint.
const ARCHIVE_BASE_TAIL = 0x7_00;
const ARCHIVE_PERIOD_STRIDE = 0x40;
const ARCHIVE_ITEM2_OFFSET = 0x10;
const ARCHIVE_STATUS_OFFSET = 0x20;

export function archiveHistoryRowIds(
  periodIdx: number,
  leadIdx: number,
): {
  readonly currentItemId: string;
  readonly nextItemId: string;
  readonly statusId: string;
} {
  const baseTail =
    ARCHIVE_BASE_TAIL + periodIdx * ARCHIVE_PERIOD_STRIDE + leadIdx;
  return {
    currentItemId: historyRowId(baseTail),
    nextItemId: historyRowId(baseTail + ARCHIVE_ITEM2_OFFSET),
    statusId: historyRowId(baseTail + ARCHIVE_STATUS_OFFSET),
  };
}

async function seedPublishedSection(
  prisma: PrismaClient,
  lead: LeadCfg,
  leadIdx: number,
): Promise<void> {
  const sectionId = publishedSectionId(leadIdx);
  const statusId = historyRowId(PUBLISHED_STATUS_TAIL + leadIdx);
  const currentItemId = historyRowId(PUBLISHED_CURRENT_ITEM_TAIL + leadIdx);
  const nextItemId = historyRowId(PUBLISHED_NEXT_ITEM_TAIL + leadIdx);
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
      id: statusId,
      reportSectionId: sectionId,
      projectId: lead.productId,
      status: TrafficLightStatus.green,
    },
  });
  await prisma.item.createMany({
    data: [
      {
        id: currentItemId,
        stableId: currentItemId,
        reportSectionId: sectionId,
        type: ItemType.current,
        projectId: lead.productId,
        text: `Закрыли спринтовые цели команды ${lead.label} на прошлой неделе`,
        tag: "feature",
        workflowStatus: ItemWorkflowStatus.done,
        carriedOver: false,
        priorityRank: 1,
        stageNames: ["Development"],
      },
      {
        id: nextItemId,
        stableId: nextItemId,
        reportSectionId: sectionId,
        type: ItemType.next,
        projectId: lead.productId,
        text: "Перенос: продолжить рефакторинг авторизации",
        tag: "feature",
        workflowStatus: ItemWorkflowStatus.planned,
        carriedOver: false,
        stageNames: ["Development"],
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
  periodIdx: number;
  leadIdx: number;
}

function buildArchiveItemRows(lead: LeadCfg, ctx: ArchiveSectionContext) {
  const { sectionId, submittedAt, createdAt, periodIdx, leadIdx } = ctx;
  const { currentItemId, nextItemId } = archiveHistoryRowIds(
    periodIdx,
    leadIdx,
  );
  return [
    {
      id: currentItemId,
      stableId: currentItemId,
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
      id: nextItemId,
      stableId: nextItemId,
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
  const { sectionId, submittedAt, createdAt, periodIdx, leadIdx } = ctx;
  const { statusId } = archiveHistoryRowIds(periodIdx, leadIdx);
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
      id: statusId,
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
      periodIdx: reportIdx,
      leadIdx,
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
