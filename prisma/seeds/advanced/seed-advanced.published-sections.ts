import type { PrismaClient } from "@prisma/client";
import {
  ItemType,
  ItemWorkflowStatus,
  ReportSectionStatus,
  TrafficLightStatus,
} from "@prisma/client";

import { SEED_REPORTS } from "../support/seed-constants.js";
import {
  itemId,
  projectStatusId,
  PUBLISHED_SUFFIX,
  sectionId,
} from "./seed-advanced.ids.js";
import type { LeadConfig } from "./seed-advanced.leads.js";
import { ACTIVE_LEAD_CONFIGS } from "./seed-advanced.leads.js";
import {
  FIRST_SUBMIT_HOUR_UTC,
  publishedOffset,
  SUBMIT_DAY_SPAN,
} from "./seed-advanced.period.js";
import {
  upsertItem,
  upsertProjectStatus,
  upsertSection,
} from "./seed-advanced.rows.js";
import {
  ownedStageNameAt,
  type StageOwnership,
} from "./seed-advanced.stage-names.js";
import type { SectionCounts } from "./seed-advanced.summary.js";
import {
  addSectionCounts,
  NO_SECTION_COUNTS,
} from "./seed-advanced.summary.js";

const publishedReportId = SEED_REPORTS.published.id;

const CLOSING_ITEM_TAG = "feature";

// The published week is deliberately compact: everything green, one closing
// item per product, so it reads as settled content next to the open period.
async function seedProductRows(
  prisma: PrismaClient,
  cfg: LeadConfig,
  ownership?: StageOwnership,
): Promise<void> {
  const reportSectionId = sectionId(PUBLISHED_SUFFIX, cfg.leadIndex);

  for (const [productIdx, product] of cfg.products.entries()) {
    await upsertProjectStatus(prisma, {
      id: projectStatusId(PUBLISHED_SUFFIX, cfg.leadIndex, productIdx + 1),
      reportSectionId,
      projectId: product.id,
      status: TrafficLightStatus.green,
    });
    await upsertItem(prisma, {
      id: itemId(PUBLISHED_SUFFIX, cfg.leadIndex, productIdx + 1),
      stableId: itemId(PUBLISHED_SUFFIX, cfg.leadIndex, productIdx + 1),
      reportSectionId,
      projectId: product.id,
      type: ItemType.current,
      text: `Закрыли недельные цели по продукту «${product.name}»`,
      tag: CLOSING_ITEM_TAG,
      workflowStatus: ItemWorkflowStatus.done,
      stageNames: [
        ownedStageNameAt(
          cfg.leadId,
          product.id,
          cfg.leadIndex + productIdx,
          ownership,
        ),
      ],
    });
  }
}

async function seedPublishedSection(
  prisma: PrismaClient,
  cfg: LeadConfig,
  leadIdx: number,
  ownership?: StageOwnership,
): Promise<SectionCounts> {
  await upsertSection(prisma, {
    id: sectionId(PUBLISHED_SUFFIX, cfg.leadIndex),
    reportId: publishedReportId,
    authorId: cfg.leadId,
    status: ReportSectionStatus.submitted,
    submittedAt: publishedOffset(
      leadIdx % SUBMIT_DAY_SPAN,
      FIRST_SUBMIT_HOUR_UTC + leadIdx,
    ),
  });
  await seedProductRows(prisma, cfg, ownership);
  await prisma.item.update({
    where: { id: itemId(PUBLISHED_SUFFIX, cfg.leadIndex, 1) },
    data: { priorityRank: 1 },
  });

  return {
    sections: 1,
    items: cfg.products.length,
    projectStatuses: cfg.products.length,
    stageStatuses: 0,
  };
}

/** Seeds the previous, published week: every section submitted, all green. */
export async function seedPublishedSections(
  prisma: PrismaClient,
  ownership?: StageOwnership,
): Promise<SectionCounts> {
  return ACTIVE_LEAD_CONFIGS.reduce<Promise<SectionCounts>>(
    async (total, cfg, leadIdx) =>
      addSectionCounts(
        await total,
        await seedPublishedSection(prisma, cfg, leadIdx, ownership),
      ),
    Promise.resolve(NO_SECTION_COUNTS),
  );
}
