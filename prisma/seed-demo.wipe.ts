import type { PrismaClient } from "@prisma/client";

// FK-safe delete order mirrors prisma/seed-simple.ts. Activity statuses drop
// before their activities (RESTRICT), activities before ReportingGroup/User/
// Project, and activities only after the items/risks/decisions that carry
// activityId — the reverse order trips the FK on a populated DB.
export async function wipe(prisma: PrismaClient): Promise<void> {
  await prisma.activityStatus.deleteMany({});
  await prisma.reminderExecution.deleteMany({});
  await prisma.reminderRule.deleteMany({});
  await prisma.reminderPolicy.deleteMany({});
  await prisma.decision.deleteMany({});
  await prisma.risk.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.projectActivityLead.deleteMany({});
  await prisma.projectActivityProduct.deleteMany({});
  await prisma.projectActivity.deleteMany({});
  await prisma.stageStatus.deleteMany({});
  await prisma.projectStatus.deleteMany({});
  await prisma.reopenRequest.deleteMany({});
  await prisma.reportSection.deleteMany({});
  await prisma.pdfExportJob.deleteMany({});
  await prisma.carryOverRecord.deleteMany({});
  await prisma.carryOverExecution.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.stageAssignment.deleteMany({});
  await prisma.viewerGroupAccess.deleteMany({});
  await prisma.groupProduct.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.stage.deleteMany({});
  await prisma.telegramBinding.deleteMany({});
  await prisma.userActionLog.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.reportingGroup.deleteMany({});
}
