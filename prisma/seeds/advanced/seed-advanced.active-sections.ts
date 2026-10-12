import type { PrismaClient } from "@prisma/client";
import { ItemType, ItemWorkflowStatus } from "@prisma/client";

import {
  LEAD_SERGEY_ID,
  SEED_PRODUCTS,
  SEED_REPORTS,
  SEED_STAGES,
} from "../support/seed-constants.js";
import { LEAD_SLOT_PRIMARY } from "./seed-advanced.anchors.js";
import { contentFor } from "./seed-advanced.content.js";
import {
  CONSECUTIVE_STAGE_OFFSETS,
  cyclic,
  stageAt,
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
import {
  ownedStageNameAt,
  ownedStageNames,
  type StageOwnership,
} from "./seed-advanced.stage-names.js";
import type { SectionCounts } from "./seed-advanced.summary.js";
import {
  addSectionCounts,
  NO_SECTION_COUNTS,
} from "./seed-advanced.summary.js";

const activeReportId = SEED_REPORTS.active.id;

// One current item resolves to `paused` and one next item to `postponed` so the
// canonical dataset carries every stored Progress state on each reseed —
// assertSeedCoverage fails the run loudly if either is ever dropped. Both land
// on the primary lead's section so a single dev-login surfaces both treatments;
// Paused rows carry the explanation required by the current data contract.
const PAUSED_CURRENT_INDEX = 3;
const POSTPONED_NEXT_INDEX = 0;

// Next-week rows sit further along the stage rotation than current-week rows so
// a lead's two lists do not land on the same stage label.
const NEXT_ITEM_STAGE_SHIFT = 3;

// Retain the planned offsets; effective composition may own only part of them.
async function seedStageStatuses(
  prisma: PrismaClient,
  cfg: LeadConfig,
  { projectId, productIdx }: { projectId: string; productIdx: number },
  ownership?: StageOwnership,
): Promise<number> {
  const reportSectionId = sectionId(ACTIVE_SUFFIX, cfg.leadIndex);
  const globalIdx = SEED_PRODUCTS.findIndex((p) => p.id === projectId);
  if (globalIdx === -1) {
    throw new Error(`Product seed: product ${projectId} is not in catalogue`);
  }
  const names = ownedStageNames(cfg.leadId, projectId, ownership);
  if (names.some((name) => !SEED_STAGES.some((stage) => stage.name === name))) {
    throw new Error(`Product seed: ${projectId} has unknown owned stages`);
  }
  const slots = CONSECUTIVE_STAGE_OFFSETS.map((offset) => ({
    stage: stageAt(globalIdx + offset),
    id: stageStatusId(cfg.leadIndex, productIdx + 1, offset + 1),
    status: trafficLightFor(cfg.leadIndex + productIdx + offset),
  }));
  const unowned = slots.filter(({ stage }) => !names.includes(stage.name));
  if (unowned.length > 0) {
    await prisma.stageStatus.deleteMany({
      where: {
        OR: unowned.map(({ id, stage }) => ({
          id,
          stageId: stage.id,
          reportSectionId,
          projectId,
        })),
      },
    });
  }
  const owned = slots.filter(({ stage }) => names.includes(stage.name));
  for (const { stage, id, status } of owned) {
    await prisma.stageStatus.upsert({
      where: {
        reportSectionId_projectId_stageId: {
          reportSectionId,
          projectId,
          stageId: stage.id,
        },
      },
      update: { status },
      create: { id, reportSectionId, projectId, stageId: stage.id, status },
    });
  }
  return owned.length;
}

// Sergey has no data yet, so his section carries no traffic lights at all.
async function seedProductStatuses(
  prisma: PrismaClient,
  cfg: LeadConfig,
  ownership?: StageOwnership,
): Promise<Pick<SectionCounts, "projectStatuses" | "stageStatuses">> {
  if (cfg.leadId === LEAD_SERGEY_ID) {
    return { projectStatuses: 0, stageStatuses: 0 };
  }
  const reportSectionId = sectionId(ACTIVE_SUFFIX, cfg.leadIndex);

  const stageStatuses = await cfg.products.reduce<Promise<number>>(
    async (total, product, productIdx) => {
      const previous = await total;
      await upsertProjectStatus(prisma, {
        id: projectStatusId(ACTIVE_SUFFIX, cfg.leadIndex, productIdx + 1),
        reportSectionId,
        projectId: product.id,
        status: trafficLightFor(cfg.leadIndex + productIdx),
      });
      return (
        previous +
        (await seedStageStatuses(
          prisma,
          cfg,
          { projectId: product.id, productIdx },
          ownership,
        ))
      );
    },
    Promise.resolve(0),
  );
  return { projectStatuses: cfg.products.length, stageStatuses };
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
  ownership?: StageOwnership,
): Promise<number> {
  const reportSectionId = sectionId(ACTIVE_SUFFIX, cfg.leadIndex);
  const { current, next } = contentFor(cfg.leadId);
  const rows = [
    ...current.map((text, i) => {
      const productId = cyclic(cfg.products, i).id;
      return {
        id: itemId(ACTIVE_SUFFIX, cfg.leadIndex, i + 1),
        stableId: itemId(ACTIVE_SUFFIX, cfg.leadIndex, i + 1),
        reportSectionId,
        projectId: productId,
        type: ItemType.current,
        text,
        tag: tagFor(i),
        workflowStatus: currentStatusFor(cfg, i),
        ...(cfg.leadIndex === LEAD_SLOT_PRIMARY && i === PAUSED_CURRENT_INDEX
          ? { pausedReason: "Ожидаем подтверждение владельца этапа" }
          : {}),
        stageNames: [
          ownedStageNameAt(cfg.leadId, productId, cfg.leadIndex + i, ownership),
        ],
      };
    }),
    ...next.map((text, i) => {
      const productId = cyclic(cfg.products, i).id;
      return {
        id: itemId(ACTIVE_SUFFIX, cfg.leadIndex, current.length + i + 1),
        stableId: itemId(ACTIVE_SUFFIX, cfg.leadIndex, current.length + i + 1),
        reportSectionId,
        projectId: productId,
        type: ItemType.next,
        text,
        tag: tagFor(i),
        workflowStatus: nextStatusFor(cfg, i),
        stageNames: [
          ownedStageNameAt(
            cfg.leadId,
            productId,
            cfg.leadIndex + i + NEXT_ITEM_STAGE_SHIFT,
            ownership,
          ),
        ],
      };
    }),
  ];

  for (const row of rows) {
    await upsertItem(prisma, row);
  }
  return rows.length;
}

// Priority ranks mark the lead's first N items. Ranks are cleared first each
// run so a shrunk list does not leave stale ranks on rows.
export async function applyPriorityRanks(
  prisma: PrismaClient,
  cfg: LeadConfig,
): Promise<void> {
  const { priorities } = contentFor(cfg.leadId);
  const reportSectionId = sectionId(ACTIVE_SUFFIX, cfg.leadIndex);
  await prisma.item.updateMany({
    where: { reportSectionId, priorityRank: { not: null } },
    data: { priorityRank: null },
  });
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
  ownership?: StageOwnership,
): Promise<SectionCounts> {
  await upsertSection(prisma, {
    id: sectionId(ACTIVE_SUFFIX, cfg.leadIndex),
    reportId: activeReportId,
    authorId: cfg.leadId,
    status: cfg.status,
    submittedAt: cfg.submittedAt,
  });
  const statuses = await seedProductStatuses(prisma, cfg, ownership);
  const items = await seedItems(prisma, cfg, ownership);
  await applyPriorityRanks(prisma, cfg);
  return { sections: 1, items, ...statuses };
}

/** Seeds every lead's section of the open weekly report. */
export async function seedActiveSections(
  prisma: PrismaClient,
  ownership?: StageOwnership,
): Promise<SectionCounts> {
  return ACTIVE_LEAD_CONFIGS.reduce<Promise<SectionCounts>>(
    async (total, cfg) =>
      addSectionCounts(
        await total,
        await seedLeadSection(prisma, cfg, ownership),
      ),
    Promise.resolve(NO_SECTION_COUNTS),
  );
}
