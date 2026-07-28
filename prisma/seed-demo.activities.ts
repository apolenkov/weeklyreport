// Writer for the small tier's Project Activities. Activities are created first
// (all four rows per activity), then each activity's records — the order the
// deterministic row-id sequence is built on.

import type { PrismaClient } from "@prisma/client";

import {
  ACTIVE_REPORT_ID,
  DEFAULT_REPORTING_GROUP_ID,
  LEAD_1_ID,
} from "./seed-constants.js";
import { makeRowId } from "./seed-demo.ids.js";
import type { ActivityContent } from "./seed-demo.small-activities.js";
import { SMALL_ACTIVITIES } from "./seed-demo.small-activities.js";
import { VASILY_LABEL } from "./seed-demo.small-cast.js";

interface CreatedActivity {
  activityId: string;
  content: ActivityContent;
}

async function createActivities(
  prisma: PrismaClient,
  sectionId: string,
): Promise<CreatedActivity[]> {
  return SMALL_ACTIVITIES.reduce<Promise<CreatedActivity[]>>(
    async (createdPromise, activity) => {
      const created = await createdPromise;
      const activityId = makeRowId();
      await prisma.projectActivity.create({
        data: {
          id: activityId,
          name: activity.name,
          groupId: DEFAULT_REPORTING_GROUP_ID,
        },
      });
      await prisma.projectActivityProduct.create({
        data: { id: makeRowId(), activityId, productId: activity.productId },
      });
      await prisma.projectActivityLead.create({
        data: { id: makeRowId(), activityId, leadId: LEAD_1_ID },
      });
      await prisma.activityStatus.create({
        data: {
          id: makeRowId(),
          reportSectionId: sectionId,
          activityId,
          status: activity.status,
          note: activity.note ?? null,
        },
      });
      return [...created, { activityId, content: activity.content }];
    },
    Promise.resolve([]),
  );
}

async function writeActivityContent(
  prisma: PrismaClient,
  sectionId: string,
  created: CreatedActivity,
): Promise<void> {
  const { activityId, content } = created;
  await prisma.item.createMany({
    data: content.items.map((item) => ({
      id: makeRowId(),
      reportSectionId: sectionId,
      type: item.type,
      activityId,
      text: item.text,
      tag: item.tag,
      workflowStatus: item.status,
      carriedOver: false,
      stageNames: [],
    })),
  });
  if (content.risk) {
    await prisma.risk.create({
      data: {
        id: makeRowId(),
        reportSectionId: sectionId,
        activityId,
        ...content.risk,
        stageNames: [],
      },
    });
  }
  if (content.decision) {
    await prisma.decision.create({
      data: {
        id: makeRowId(),
        reportSectionId: sectionId,
        activityId,
        ...content.decision,
        owner: VASILY_LABEL,
        stageNames: [],
      },
    });
  }
}

export async function seedSmallActivities(prisma: PrismaClient): Promise<void> {
  const vasilySection = await prisma.reportSection.findFirst({
    where: { reportId: ACTIVE_REPORT_ID, authorId: LEAD_1_ID },
    select: { id: true },
  });
  if (!vasilySection) throw new Error("small tier: Vasily section missing");

  const created = await createActivities(prisma, vasilySection.id);
  for (const activity of created) {
    await writeActivityContent(prisma, vasilySection.id, activity);
  }
}
