import type { PrismaClient } from "@prisma/client";
import {
  ItemType,
  ItemWorkflowStatus,
  TrafficLightStatus,
} from "@prisma/client";

import {
  LEAD_SLOT_IGOR,
  LEAD_SLOT_MARIA,
  LEAD_SLOT_OLGA,
  LEAD_SLOT_PRIMARY,
  PRODUCT_MARKETING_PORTAL,
  PRODUCT_PAYMENT_GATEWAY,
  STAGE_NAME_DEVOPS,
  STAGE_NAME_TESTING,
  STAGE_PLANNING,
  STAGE_SUPPORT,
} from "./seed-advanced.anchors.js";
import { ACTIVE_SUFFIX, itemId, sectionId } from "./seed-advanced.ids.js";
import type { ItemRow } from "./seed-advanced.rows.js";
import { upsertItem } from "./seed-advanced.rows.js";

const OLGA_DEVOPS_ITEM_SEQ = 6;

const MARKETING_CONTRIBUTOR_ITEMS: readonly ItemRow[] = [
  {
    id: "a0000000-0000-4000-8000-000000052002",
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_MARIA),
    projectId: PRODUCT_MARKETING_PORTAL,
    type: ItemType.current,
    text: "Проверить DevOps-пайплайн партнёрской авторизации",
    tag: "integration",
    workflowStatus: ItemWorkflowStatus.in_progress,
    stageNames: [STAGE_NAME_DEVOPS],
  },
  {
    id: "a0000000-0000-4000-8000-000000053002",
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_IGOR),
    projectId: PRODUCT_MARKETING_PORTAL,
    type: ItemType.next,
    text: "Подготовить Testing-план для OAuth2 интеграции",
    tag: "integration",
    workflowStatus: ItemWorkflowStatus.planned,
    stageNames: [STAGE_NAME_TESTING],
  },
];

// The primary lead's statuses on Olga's Payment gateway are what render as
// locked cross-author chips in her view: Support red -> blocked, Planning
// yellow -> at-risk.
const LOCKED_CHIP_STATUSES = [
  {
    id: "a0000000-0000-4000-8000-00000000f901",
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_PRIMARY),
    projectId: PRODUCT_PAYMENT_GATEWAY,
    stageId: STAGE_SUPPORT,
    status: TrafficLightStatus.red,
  },
  {
    id: "a0000000-0000-4000-8000-00000000f902",
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_PRIMARY),
    projectId: PRODUCT_PAYMENT_GATEWAY,
    stageId: STAGE_PLANNING,
    status: TrafficLightStatus.yellow,
  },
];

/**
 * Seeds cross-author overlays for the primary lead's Marketing portal and
 * Olga's Payment gateway. Item status remains derived from stage and risk data
 * rather than from a separate presentation-only status.
 */
export async function seedCrossAuthorOverlay(
  prisma: PrismaClient,
): Promise<void> {
  for (const row of LOCKED_CHIP_STATUSES) {
    await prisma.stageStatus.upsert({
      where: {
        reportSectionId_projectId_stageId: {
          reportSectionId: row.reportSectionId,
          projectId: row.projectId,
          stageId: row.stageId,
        },
      },
      update: { status: row.status },
      create: row,
    });
  }

  await upsertItem(prisma, {
    id: itemId(ACTIVE_SUFFIX, LEAD_SLOT_OLGA, OLGA_DEVOPS_ITEM_SEQ),
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_OLGA),
    projectId: PRODUCT_PAYMENT_GATEWAY,
    type: ItemType.current,
    text: "Настройка DevOps-конвейера для Платёжного шлюза",
    tag: "infra",
    workflowStatus: ItemWorkflowStatus.in_progress,
    stageNames: [STAGE_NAME_DEVOPS],
  });
  for (const item of MARKETING_CONTRIBUTOR_ITEMS) {
    await upsertItem(prisma, item);
  }
}
