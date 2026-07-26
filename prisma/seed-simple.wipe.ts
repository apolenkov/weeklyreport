import type { PrismaClient } from "@prisma/client";

// Delete in FK-safe order. ReopenRequest references ReportSection → must go
// before ReportSection deletes; TelegramBinding → User and GroupProduct →
// Project + ReportingGroup drop before their parents. Other CASCADE FKs
// (ProjectStatus → ReportSection, Items → ReportSection, …) flow naturally.
export async function wipeExistingData(prisma: PrismaClient): Promise<void> {
  console.log("[seed-simple] Wiping existing data...");
  await prisma.reminderExecution.deleteMany({});
  await prisma.reminderRule.deleteMany({});
  await prisma.reminderPolicy.deleteMany({});
  await prisma.decision.deleteMany({});
  await prisma.risk.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.stageStatus.deleteMany({});
  await prisma.projectStatus.deleteMany({});
  // ActivityStatus.activityId and ProjectActivity.groupId are RESTRICT, so
  // statuses drop before their activities and activities before their group.
  await prisma.activityStatus.deleteMany({});
  await prisma.projectActivityLead.deleteMany({});
  // ProjectActivityProduct cascades on activity delete, but drop it explicitly
  // to mirror the other activity children and keep the wipe order obvious.
  await prisma.projectActivityProduct.deleteMany({});
  await prisma.projectActivity.deleteMany({});
  await prisma.reopenRequest.deleteMany({});
  await prisma.reportSection.deleteMany({});
  await prisma.pdfExportJob.deleteMany({});
  await prisma.carryOverRecord.deleteMany({});
  await prisma.carryOverExecution.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.stageAssignment.deleteMany({});
  await prisma.groupProduct.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.stage.deleteMany({});
  await prisma.telegramBinding.deleteMany({});
  await prisma.userActionLog.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.reportingGroup.deleteMany({});
}
