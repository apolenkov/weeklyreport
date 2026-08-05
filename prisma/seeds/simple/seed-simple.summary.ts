import type { PrismaClient } from "@prisma/client";

import { ACTIVE_MONDAY, ACTIVE_SUNDAY } from "./seed-simple.period.js";

const ISO_DATE_LENGTH = 10;
const isoDate = (d: Date) => d.toISOString().slice(0, ISO_DATE_LENGTH);

// Row counts and the resolved period bounds make a failed seed obvious from the
// console alone, without opening the database.
export async function logSeedSummary(prisma: PrismaClient): Promise<void> {
  const counts = {
    users: await prisma.user.count(),
    projects: await prisma.project.count({ where: { archived: false } }),
    stages: await prisma.stage.count(),
    stageStatuses: await prisma.stageStatus.count(),
    reports: await prisma.report.count(),
    sections: await prisma.reportSection.count(),
    items: await prisma.item.count(),
    statuses: await prisma.projectStatus.count(),
    activities: await prisma.projectActivity.count(),
    activityStatuses: await prisma.activityStatus.count(),
    activityProducts: await prisma.projectActivityProduct.count(),
    activityParentedItems: await prisma.item.count({
      where: { activityId: { not: null } },
    }),
    risks: await prisma.risk.count(),
    decisions: await prisma.decision.count(),
    priorityItems: await prisma.item.count({
      where: { priorityRank: { not: null } },
    }),
    reminderPolicies: await prisma.reminderPolicy.count(),
    reminders: await prisma.reminderRule.count(),
    reopenRequests: await prisma.reopenRequest.count(),
    actionLogs: await prisma.userActionLog.count(),
    organization: await prisma.organization.count(),
    appSettings: await prisma.appSettings.count(),
  };
  console.log(`[seed-simple] Done: ${JSON.stringify(counts)}`);
  console.log(
    `[seed-simple] Active period: ${isoDate(ACTIVE_MONDAY)}..${isoDate(ACTIVE_SUNDAY)}`,
  );
}
