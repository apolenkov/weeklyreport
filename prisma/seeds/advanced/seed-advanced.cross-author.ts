import type { PrismaClient } from "@prisma/client";
import {
  ItemType,
  ItemWorkflowStatus,
  TrafficLightStatus,
} from "@prisma/client";

import {
  LEAD_SLOT_OLGA,
  LEAD_SLOT_PRIMARY,
  PRODUCT_PAYMENT_GATEWAY,
  STAGE_NAME_DEVOPS,
  STAGE_PLANNING,
  STAGE_SUPPORT,
} from "./seed-advanced.anchors.js";
import { ACTIVE_SUFFIX, itemId, sectionId } from "./seed-advanced.ids.js";
import { upsertItem } from "./seed-advanced.rows.js";

const OLGA_DEVOPS_ITEM_SEQ = 6;

// The primary lead's stored traffic-light values feed Olga's read-only
// cross-author stage chips; risk-derived alarms are seeded separately.
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
 * Seeds the cross-author overlay on Olga's Payment gateway: the primary lead's
 * locked stage chips, plus her DevOps item whose blocked pill DERIVES at render
 * from the covering blocked-severity risk rather than from a stored status.
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
    stableId: itemId(ACTIVE_SUFFIX, LEAD_SLOT_OLGA, OLGA_DEVOPS_ITEM_SEQ),
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_OLGA),
    projectId: PRODUCT_PAYMENT_GATEWAY,
    type: ItemType.current,
    text: "Настройка DevOps-конвейера для Платёжного шлюза",
    tag: "infra",
    workflowStatus: ItemWorkflowStatus.in_progress,
    stageNames: [STAGE_NAME_DEVOPS],
  });
}
