// Row-count-reporting wipe of every application table, used by the manual-UAT
// factory reset. Runs inside the caller's transaction.

import type { Prisma } from "@prisma/client";

export type WipeCounts = Record<string, number>;

// FK-safe wipe: reminder rules before policies (RESTRICT); activities before groups.
export async function wipeAll(
  tx: Prisma.TransactionClient,
): Promise<WipeCounts> {
  return {
    reminderExecution: (await tx.reminderExecution.deleteMany({})).count,
    reminderRule: (await tx.reminderRule.deleteMany({})).count,
    reminderPolicy: (await tx.reminderPolicy.deleteMany({})).count,
    // priorityRank is a column on Item, cleared by item.deleteMany below —
    // no separate priority wipe.
    decision: (await tx.decision.deleteMany({})).count,
    risk: (await tx.risk.deleteMany({})).count,
    item: (await tx.item.deleteMany({})).count,
    stageStatus: (await tx.stageStatus.deleteMany({})).count,
    projectStatus: (await tx.projectStatus.deleteMany({})).count,
    reopenRequest: (await tx.reopenRequest.deleteMany({})).count,
    reportSection: (await tx.reportSection.deleteMany({})).count,
    // Statuses reference their activity; ProjectActivity.groupId and
    // ProjectActivityProduct.productId are RESTRICT, so every activity row
    // must drop before reportingGroup/project below or those deletes FK-fail.
    activityStatus: (await tx.activityStatus.deleteMany({})).count,
    projectActivityLead: (await tx.projectActivityLead.deleteMany({})).count,
    projectActivityProduct: (await tx.projectActivityProduct.deleteMany({}))
      .count,
    projectActivity: (await tx.projectActivity.deleteMany({})).count,
    pdfExportJob: (await tx.pdfExportJob.deleteMany({})).count,
    carryOverRecord: (await tx.carryOverRecord.deleteMany({})).count,
    carryOverExecution: (await tx.carryOverExecution.deleteMany({})).count,
    report: (await tx.report.deleteMany({})).count,
    stageAssignment: (await tx.stageAssignment.deleteMany({})).count,
    groupProduct: (await tx.groupProduct.deleteMany({})).count,
    project: (await tx.project.deleteMany({})).count,
    stage: (await tx.stage.deleteMany({})).count,
    telegramBinding: (await tx.telegramBinding.deleteMany({})).count,
    viewerGroupAccess: (await tx.viewerGroupAccess.deleteMany({})).count,
    userActionLog: (await tx.userActionLog.deleteMany({})).count,
    user: (await tx.user.deleteMany({})).count,
    reportingGroup: (await tx.reportingGroup.deleteMany({})).count,
    organization: (await tx.organization.deleteMany({})).count,
    appSettings: (await tx.appSettings.deleteMany({})).count,
  };
}
