import type { PrismaClient } from "@prisma/client";
import { ItemType, ItemWorkflowStatus } from "@prisma/client";

import { LEAD_SLOT_PRIMARY } from "./seed-advanced.anchors.js";
import { contentFor } from "./seed-advanced.content.js";
import {
  CONSECUTIVE_STAGE_OFFSETS,
  cyclic,
  stageAt,
  stageNameFor,
  tagFor,
  trafficLightFor,
  workflowFor,
} from "./seed-advanced.cycles.js";
import {
  ACTIVE_SUFFIX,
  itemId,
  projectStatusId,
  sectionId,
  stageStatusId,
} from "./seed-advanced.ids.js";
import type { LeadConfig } from "./seed-advanced.leads.js";
import { ACTIVE_LEAD_CONFIGS } from "./seed-advanced.leads.js";
import {
  upsertItem,
  upsertProjectStatus,
  upsertSection,
} from "./seed-advanced.rows.js";
import type { SectionCounts } from "./seed-advanced.summary.js";
import {
  addSectionCounts,
  NO_SECTION_COUNTS,
} from "./seed-advanced.summary.js";
import {
  LEAD_SERGEY_ID,
  SEED_PRODUCTS,
  SEED_REPORTS,
} from "./seed-constants.js";

const activeReportId = SEED_REPORTS.active.id;

// One current item resolves to `paused` and one next item to `postponed` so the
// canonical dataset carries every stored Progress state on each reseed —
// assertSeedCoverage fails the run loudly if either is ever dropped. Both land
// on the primary lead's section so a single dev-login surfaces both treatments;
// pausedReason stays unset (the UI enforces it only at the point of pausing).
const PAUSED_CURRENT_INDEX = 3;
const POSTPONED_NEXT_INDEX = 0;

// Next-week rows sit further along the stage rotation than current-week rows so
// a lead's two lists do not land on the same stage label.
const NEXT_ITEM_STAGE_SHIFT = 3;

// Stage statuses cover the same three-stage span the product's assignments do,
// so every chip in the form has a status behind it.
async function seedStageStatuses(
  prisma: PrismaClient,
  cfg: LeadConfig,
  projectId: string,
  productIdx: number,
): Promise<void> {
  const reportSectionId = sectionId(ACTIVE_SUFFIX, cfg.leadIndex);
  const globalIdx = SEED_PRODUCTS.findIndex((p) => p.id === projectId);
  if (globalIdx === -1) {
    throw new Error(`Advanced seed: product ${projectId} is not in catalogue`);
  }
  const startStageIdx = globalIdx;

  for (const offset of CONSECUTIVE_STAGE_OFFSETS) {
    const stage = stageAt(startStageIdx + offset);
    const status = trafficLightFor(cfg.leadIndex + productIdx + offset);
    await prisma.stageStatus.upsert({
      where: {
        reportSectionId_projectId_stageId: {
          reportSectionId,
          projectId,
          stageId: stage.id,
        },
      },
      update: { status },
      create: {
        id: stageStatusId(cfg.leadIndex, productIdx + 1, offset + 1),
        reportSectionId,
        projectId,
        stageId: stage.id,
        status,
      },
    });
  }
}

// Sergey has no data yet, so his section carries no traffic lights at all.
async function seedProductStatuses(
  prisma: PrismaClient,
  cfg: LeadConfig,
): Promise<Pick<SectionCounts, "projectStatuses" | "stageStatuses">> {
  if (cfg.leadId === LEAD_SERGEY_ID) {
    return { projectStatuses: 0, stageStatuses: 0 };
  }
  const reportSectionId = sectionId(ACTIVE_SUFFIX, cfg.leadIndex);

  for (const [productIdx, product] of cfg.products.entries()) {
    await upsertProjectStatus(prisma, {
      id: projectStatusId(ACTIVE_SUFFIX, cfg.leadIndex, productIdx + 1),
      reportSectionId,
      projectId: product.id,
      status: trafficLightFor(cfg.leadIndex + productIdx),
    });
    await seedStageStatuses(prisma, cfg, product.id, productIdx);
  }

  return {
    projectStatuses: cfg.products.length,
    stageStatuses: cfg.products.length * CONSECUTIVE_STAGE_OFFSETS.length,
  };
}

const currentStatusFor = (
  cfg: LeadConfig,
  index: number,
): ItemWorkflowStatus =>
  cfg.leadIndex === LEAD_SLOT_PRIMARY && index === PAUSED_CURRENT_INDEX
    ? ItemWorkflowStatus.paused
    : workflowFor(index);

const nextStatusFor = (cfg: LeadConfig, index: number): ItemWorkflowStatus =>
  cfg.leadIndex === LEAD_SLOT_PRIMARY && index === POSTPONED_NEXT_INDEX
    ? ItemWorkflowStatus.postponed
    : ItemWorkflowStatus.planned;

// Items are distributed across the lead's products in order, cycling once the
// list runs out. Current rows take the first id slots, next rows continue the
// same sequence.
async function seedItems(
  prisma: PrismaClient,
  cfg: LeadConfig,
): Promise<number> {
  const reportSectionId = sectionId(ACTIVE_SUFFIX, cfg.leadIndex);
  const { current, next } = contentFor(cfg.leadId);
  const rows = [
    ...current.map((text, i) => ({
      id: itemId(ACTIVE_SUFFIX, cfg.leadIndex, i + 1),
      reportSectionId,
      projectId: cyclic(cfg.products, i).id,
      type: ItemType.current,
      text,
      tag: tagFor(i),
      workflowStatus: currentStatusFor(cfg, i),
      stageNames: [stageNameFor(cfg.leadIndex + i)],
    })),
    ...next.map((text, i) => ({
      id: itemId(ACTIVE_SUFFIX, cfg.leadIndex, current.length + i + 1),
      reportSectionId,
      projectId: cyclic(cfg.products, i).id,
      type: ItemType.next,
      text,
      tag: tagFor(i),
      workflowStatus: nextStatusFor(cfg, i),
      stageNames: [stageNameFor(cfg.leadIndex + i + NEXT_ITEM_STAGE_SHIFT)],
    })),
  ];

  for (const row of rows) {
    await upsertItem(prisma, row);
  }
  return rows.length;
}

// Priority ranks mark the lead's first N items. The ranked texts are demo copy
// no column stores, so only their count reaches the database.
async function applyPriorityRanks(
  prisma: PrismaClient,
  cfg: LeadConfig,
): Promise<void> {
  const { priorities } = contentFor(cfg.leadId);
  for (const [rank] of priorities.entries()) {
    await prisma.item.update({
      where: { id: itemId(ACTIVE_SUFFIX, cfg.leadIndex, rank + 1) },
      data: { priorityRank: rank + 1 },
    });
  }
}

async function seedLeadSection(
  prisma: PrismaClient,
  cfg: LeadConfig,
): Promise<SectionCounts> {
  await upsertSection(prisma, {
    id: sectionId(ACTIVE_SUFFIX, cfg.leadIndex),
    reportId: activeReportId,
    authorId: cfg.leadId,
    status: cfg.status,
    submittedAt: cfg.submittedAt,
  });
  const statuses = await seedProductStatuses(prisma, cfg);
  const items = await seedItems(prisma, cfg);
  await applyPriorityRanks(prisma, cfg);
  return { sections: 1, items, ...statuses };
}

/** Seeds every lead's section of the open weekly report. */
export async function seedActiveSections(
  prisma: PrismaClient,
): Promise<SectionCounts> {
  return ACTIVE_LEAD_CONFIGS.reduce<Promise<SectionCounts>>(
    async (total, cfg) =>
      addSectionCounts(await total, await seedLeadSection(prisma, cfg)),
    Promise.resolve(NO_SECTION_COUNTS),
  );
}
