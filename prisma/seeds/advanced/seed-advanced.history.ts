import type { PrismaClient } from "@prisma/client";
import {
  ItemType,
  ItemWorkflowStatus,
  PeriodState,
  PeriodStatus,
  ReportSectionStatus,
  ReportStatus,
  TrafficLightStatus,
} from "@prisma/client";

import { provisionalPublishedSnapshot } from "../support/published-snapshot.js";
import type { SeedHistoryReport } from "../support/seed-constants.js";
import {
  HEAD_USER_ID,
  SEED_HISTORY_REPORTS,
} from "../support/seed-constants.js";
import type { ReportSuffix } from "./seed-advanced.ids.js";
import {
  HISTORY_SUFFIXES,
  itemId,
  projectStatusId,
  sectionId,
} from "./seed-advanced.ids.js";
import type { LeadConfig } from "./seed-advanced.leads.js";
import { ACTIVE_LEAD_CONFIGS } from "./seed-advanced.leads.js";
import {
  FIRST_SUBMIT_HOUR_UTC,
  periodOffset,
  SUBMIT_DAY_SPAN,
} from "./seed-advanced.period.js";
import {
  upsertItem,
  upsertProjectStatus,
  upsertSection,
} from "./seed-advanced.rows.js";
import type { StageOwnership } from "./seed-advanced.stage-names.js";
import { ownedStageNameAt } from "./seed-advanced.stage-names.js";
import type { SectionCounts } from "./seed-advanced.summary.js";
import {
  addSectionCounts,
  NO_SECTION_COUNTS,
} from "./seed-advanced.summary.js";

const CLOSING_ITEM_TAG = "feature";

// Three extra published periods so the Fill From dropdown shows realistic
// history (two archived, one non-archived past period).
const HISTORY_PERIODS = SEED_HISTORY_REPORTS.map((report, index) => {
  const suffix = HISTORY_SUFFIXES[index];
  if (suffix === undefined) {
    throw new Error(
      "Product seed: every archive period needs its own report suffix",
    );
  }
  return { report, suffix };
});

export interface HistorySeedResult {
  readonly reports: number;
  readonly sections: SectionCounts;
}

async function upsertHistoryReport(
  prisma: PrismaClient,
  report: SeedHistoryReport,
): Promise<void> {
  const fields = {
    periodStart: new Date(report.periodStart),
    periodEnd: new Date(report.periodEnd),
    deadline: new Date(report.deadline),
    status: ReportStatus.published,
    periodStatus: PeriodStatus.published,
    periodState: report.archived ? PeriodState.archived : PeriodState.published,
    archived: report.archived,
    weekLabel: report.weekLabel,
    publishedAt: new Date(report.periodEnd),
    publishedById: HEAD_USER_ID,
    publishedSnapshot: provisionalPublishedSnapshot({
      reportId: report.id,
      periodStart: new Date(report.periodStart),
      periodEnd: new Date(report.periodEnd),
      deadline: new Date(report.deadline),
      publishedAt: new Date(report.periodEnd),
      publishedById: HEAD_USER_ID,
      publishedByName: "Елена Р.",
    }),
  };
  await prisma.report.upsert({
    where: { id: report.id },
    update: fields,
    create: { id: report.id, ...fields },
  });
}

async function seedHistorySection(
  prisma: PrismaClient,
  report: SeedHistoryReport,
  suffix: ReportSuffix,
  cfg: LeadConfig,
  leadIdx: number,
  ownership: StageOwnership,
): Promise<SectionCounts> {
  const reportSectionId = sectionId(suffix, cfg.leadIndex);
  await upsertSection(prisma, {
    id: reportSectionId,
    reportId: report.id,
    authorId: cfg.leadId,
    status: ReportSectionStatus.submitted,
    submittedAt: periodOffset(
      new Date(report.periodStart),
      leadIdx % SUBMIT_DAY_SPAN,
      FIRST_SUBMIT_HOUR_UTC + leadIdx,
    ),
  });

  for (const [productIdx, product] of cfg.products.entries()) {
    await upsertProjectStatus(prisma, {
      id: projectStatusId(suffix, cfg.leadIndex, productIdx + 1),
      reportSectionId,
      projectId: product.id,
      status: TrafficLightStatus.green,
    });
    await upsertItem(prisma, {
      id: itemId(suffix, cfg.leadIndex, productIdx + 1),
      stableId: itemId(suffix, cfg.leadIndex, productIdx + 1),
      reportSectionId,
      projectId: product.id,
      type: ItemType.current,
      text: `Завершили этап по продукту «${product.name}»`,
      tag: CLOSING_ITEM_TAG,
      workflowStatus: ItemWorkflowStatus.done,
      stageNames: [
        ownedStageNameAt(cfg.leadId, product.id, productIdx, ownership),
      ],
    });
  }

  return {
    sections: 1,
    items: cfg.products.length,
    projectStatuses: cfg.products.length,
    stageStatuses: 0,
  };
}

async function seedHistoryPeriod(
  prisma: PrismaClient,
  report: SeedHistoryReport,
  suffix: ReportSuffix,
  ownership: StageOwnership,
): Promise<SectionCounts> {
  await upsertHistoryReport(prisma, report);
  return ACTIVE_LEAD_CONFIGS.reduce<Promise<SectionCounts>>(
    async (total, cfg, leadIdx) =>
      addSectionCounts(
        await total,
        await seedHistorySection(
          prisma,
          report,
          suffix,
          cfg,
          leadIdx,
          ownership,
        ),
      ),
    Promise.resolve(NO_SECTION_COUNTS),
  );
}

/** Seeds the N-2, N-3 and N-4 published periods behind the Fill From flow. */
export async function seedHistoryPeriods(
  prisma: PrismaClient,
  ownership: StageOwnership,
): Promise<HistorySeedResult> {
  const sections = await HISTORY_PERIODS.reduce<Promise<SectionCounts>>(
    async (total, { report, suffix }) =>
      addSectionCounts(
        await total,
        await seedHistoryPeriod(prisma, report, suffix, ownership),
      ),
    Promise.resolve(NO_SECTION_COUNTS),
  );
  return { reports: HISTORY_PERIODS.length, sections };
}
