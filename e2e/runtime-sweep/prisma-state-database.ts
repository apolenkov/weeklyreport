import type { Prisma, PrismaClient } from "@prisma/client";

import type {
  OwnershipStateMutation,
  PermissionSubject,
  ReportStateMutation,
  RuntimeStateDatabase,
  RuntimeStateTransaction,
  SectionStateMutation,
  StateTarget,
} from "./state-preparation.ts";

type Transaction = Prisma.TransactionClient;

const updateReport = (
  transaction: Transaction,
  mutation: ReportStateMutation,
): Promise<void> =>
  transaction.report
    .update({
      where: { id: mutation.reportId },
      data: {
        status: mutation.status,
        periodState: mutation.periodState,
        periodStatus: mutation.periodStatus,
        archived: mutation.archived,
        publishedAt: mutation.publishedAt,
        publishedById: mutation.publishedById,
      },
    })
    .then(() => undefined);

const replaceReview = async (
  transaction: Transaction,
  mutation: SectionStateMutation,
  judgedVersion: number,
): Promise<void> => {
  if (mutation.state.verdict === "none") {
    await transaction.sectionReview.deleteMany({
      where: {
        reportSectionId: mutation.sectionId,
        reviewerId: mutation.reviewerId,
      },
    });
    return;
  }
  await transaction.sectionReview.upsert({
    where: {
      reportSectionId_reviewerId: {
        reportSectionId: mutation.sectionId,
        reviewerId: mutation.reviewerId,
      },
    },
    create: {
      reportSectionId: mutation.sectionId,
      reviewerId: mutation.reviewerId,
      verdict: mutation.state.verdict,
      judgedVersion,
    },
    update: { verdict: mutation.state.verdict, judgedVersion },
  });
};

const updateSection = async (
  transaction: Transaction,
  mutation: SectionStateMutation,
): Promise<void> => {
  const section = await transaction.reportSection.update({
    where: { id: mutation.sectionId },
    data: {
      status: mutation.state.status,
      submittedAt: mutation.submittedAt,
      revokedAt: mutation.revokedAt,
      revokedBy: mutation.revokedById,
      version: { increment: 1 },
    },
    select: { version: true },
  });
  await replaceReview(transaction, mutation, section.version);
};

const replaceOwnership = async (
  transaction: Transaction,
  mutation: OwnershipStateMutation,
): Promise<void> => {
  await transaction.stageAssignment.deleteMany({
    where: { projectId: mutation.projectId },
  });
  if (mutation.assignments.length === 0) return;
  await transaction.stageAssignment.createMany({
    data: mutation.assignments.map(({ stageId, userId }) => ({
      projectId: mutation.projectId,
      stageId,
      userId,
    })),
  });
};

const actorState = async (
  transaction: Transaction,
  targets: StateTarget,
  permission: PermissionSubject,
) => {
  if (permission.actorId === null)
    return {
      actorId: null,
      actorRole: null,
      authenticated: false,
      allowed: false,
      ownsTarget: false,
    } as const;
  const actor = await transaction.user.findUniqueOrThrow({
    where: { id: permission.actorId },
    select: {
      id: true,
      role: true,
      reportingGroupId: true,
      viewerGroupAccess: { select: { groupId: true } },
    },
  });
  const ownsTarget = actor.id === targets.ownerId;
  const allowed =
    actor.role === "admin" ||
    (actor.role === "head" && actor.reportingGroupId === targets.groupId) ||
    (actor.role === "viewer" &&
      actor.viewerGroupAccess.some(
        ({ groupId }) => groupId === targets.groupId,
      )) ||
    (actor.role === "lead" && ownsTarget);
  return {
    actorId: actor.id,
    actorRole: actor.role,
    authenticated: true,
    allowed,
    ownsTarget,
  } as const;
};

const readSnapshot = async (
  transaction: Transaction,
  targets: StateTarget,
  permission: PermissionSubject,
) => {
  const report = await transaction.report.findUniqueOrThrow({
    where: { id: targets.reportId },
    select: {
      status: true,
      periodState: true,
      periodStatus: true,
      archived: true,
    },
  });
  const section = await transaction.reportSection.findUniqueOrThrow({
    where: { id: targets.sectionId },
    select: {
      status: true,
      submittedAt: true,
      version: true,
      sectionReviews: {
        select: { verdict: true, judgedVersion: true },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  const assignments = await transaction.stageAssignment.findMany({
    where: { projectId: targets.projectId },
    select: { userId: true },
    orderBy: { stageId: "asc" },
  });
  const permissionState = await actorState(transaction, targets, permission);
  const currentReview = section.sectionReviews.find(
    ({ judgedVersion }) => judgedVersion === section.version,
  );
  return {
    report,
    section: {
      status: section.status,
      submittedAt: section.submittedAt === null ? "absent" : "present",
      verdict: currentReview?.verdict ?? "none",
    },
    ownership: {
      targetOwnerId: targets.ownerId,
      owners: assignments.map(({ userId }) => userId),
    },
    permission: permissionState,
  } as const;
};

const adapter = (transaction: Transaction): RuntimeStateTransaction => ({
  updateReport: (mutation) => updateReport(transaction, mutation),
  updateSection: (mutation) => updateSection(transaction, mutation),
  replaceOwnership: (mutation) => replaceOwnership(transaction, mutation),
  readSnapshot: (targets, permission) =>
    readSnapshot(transaction, targets, permission),
});

export function createPrismaRuntimeStateDatabase(
  prisma: PrismaClient,
): RuntimeStateDatabase {
  return {
    transaction: (work) =>
      prisma.$transaction((transaction) => work(adapter(transaction))),
  };
}
