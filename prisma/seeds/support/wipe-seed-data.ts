import type { PrismaClient } from "@prisma/client";

/**
 * Remove the complete seed graph in child-first order.
 *
 * This is the single owner for destructive seed cleanup.  Profiles must not
 * grow their own partial delete lists: a populated simple database and a
 * minimal/demo database have the same relational graph, including the review
 * and published-read-model tables.
 */
export async function wipeSeedData(prisma: PrismaClient): Promise<void> {
  // Record-level children and their section/activity parents.
  await prisma.recordComment.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.risk.deleteMany({});
  await prisma.decision.deleteMany({});
  await prisma.activityStatus.deleteMany({});
  await prisma.projectActivityLead.deleteMany({});
  await prisma.projectActivityProduct.deleteMany({});
  await prisma.projectActivity.deleteMany({});
  await prisma.stageStatus.deleteMany({});
  await prisma.projectStatus.deleteMany({});
  await prisma.sectionReview.deleteMany({});
  await prisma.reopenRequest.deleteMany({});
  await prisma.reportSection.deleteMany({});

  // Report-owned operational children must be gone before reports. Carry-over
  // executions use RESTRICT FKs, so records precede executions, then reports.
  await prisma.reminderExecution.deleteMany({});
  await prisma.reminderRule.deleteMany({});
  await prisma.reminderPolicy.deleteMany({});
  await prisma.pdfExportJob.deleteMany({});
  await prisma.carryOverRecord.deleteMany({});
  await prisma.carryOverExecution.deleteMany({});
  await prisma.publishedSectionScope.deleteMany({});
  await prisma.publishedSearchDocument.deleteMany({});
  await prisma.reviewAcknowledgement.deleteMany({});
  await prisma.report.deleteMany({});

  // Remaining graph edges and their parents.
  await prisma.stageAssignment.deleteMany({});
  await prisma.viewerGroupAccess.deleteMany({});
  await prisma.groupProduct.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.stage.deleteMany({});
  await prisma.userActionLog.deleteMany({});
  await prisma.agentationThreadMessage.deleteMany({});
  await prisma.agentationEvent.deleteMany({});
  await prisma.agentationAnnotation.deleteMany({});
  await prisma.agentationSession.deleteMany({});
  await prisma.productFeedback.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.reportingGroup.deleteMany({});
  // Singleton configuration is seed-owned too; deleting it makes every
  // profile deterministic before its scaffold recreates the defaults.
  await prisma.appSettings.deleteMany({});
  await prisma.organization.deleteMany({});
}
