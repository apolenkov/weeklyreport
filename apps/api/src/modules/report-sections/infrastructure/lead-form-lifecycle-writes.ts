import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { isUniqueViolation } from "../../../lib/prisma-unique-violation.js";
import { lockCurrentEditableReport } from "../../../lib/report-lifecycle.js";
import { PeriodLifecycleIntegrityError } from "../../period/index.js";
import { applyRevokeTransition } from "../application/revoke-transition.js";
import {
  LeadFormAccessError,
  LeadFormConstraintError,
  LeadFormDomainError,
  reopenBlockedMessage,
  ReopenRequestError,
} from "../domain/lead-form-shared.js";

const NON_EDITABLE_PERIOD_MESSAGE =
  "Cannot revoke a submission from a non-editable period.";

export async function revokeSectionSubmissionTx(
  prisma: PrismaService,
  sectionId: string,
  revokedBy: string,
  scope: Record<string, unknown>,
): Promise<void> {
  // Recheck caller scope in the submitted CAS after the parent lifecycle lock.
  await prisma.$transaction(async (tx) => {
    const gate = await lockCurrentEditableReport(tx, { sectionId });
    if (gate.kind === "inconsistent") {
      // The lifecycle reader fails closed. At this write boundary the caller
      // can only recover by reloading the period, so expose the stable form
      // constraint while retaining the rejection and transaction rollback.
      throw new LeadFormConstraintError(NON_EDITABLE_PERIOD_MESSAGE);
    }
    if (gate.kind === "not-found") {
      // The section-joined row vanished between the scoped service load and
      // this lock — that is a NOT_FOUND, not a period-state constraint.
      throw new LeadFormDomainError("The target section no longer exists.");
    }
    if (gate.kind !== "editable") {
      throw new LeadFormConstraintError(NON_EDITABLE_PERIOD_MESSAGE);
    }
    const count = await applyRevokeTransition(tx, sectionId, revokedBy, {
      scope,
    });
    if (count === 0) {
      const available = await tx.reportSection.findFirst({
        where: { AND: [{ id: sectionId }, scope] },
        select: { id: true },
      });
      if (!available) {
        throw new LeadFormDomainError("The target section no longer exists.");
      }
      throw new LeadFormConstraintError(NON_EDITABLE_PERIOD_MESSAGE);
    }
  });
}

export function revokeAllSubmittedTx(
  prisma: PrismaService,
  reportId: string,
  revokedBy: string,
  scope: Record<string, unknown>,
): Promise<number> {
  // The parent-first lock is the lifecycle authority. The group scope and
  // relation predicate remain defense-in-depth on the section write.
  return prisma.$transaction(async (tx) => {
    const gate = await lockCurrentEditableReport(tx, { reportId });
    if (gate.kind === "inconsistent") {
      throw new LeadFormConstraintError(
        "Cannot revoke submissions from a non-editable period.",
      );
    }
    if (gate.kind !== "editable") return 0;
    const result = await tx.reportSection.updateMany({
      where: {
        reportId,
        status: "submitted",
        report: {
          archived: false,
          periodStatus: { in: ["open", "reopened"] },
        },
        ...scope,
      },
      data: {
        status: "draft",
        revokedAt: new Date(),
        revokedBy,
        submittedAt: null,
      },
    });
    return result.count;
  });
}

export async function createReopenRequestTx(
  prisma: PrismaService,
  sectionId: string,
  userId: string,
  reason?: string,
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const gate = await lockCurrentEditableReport(tx, { sectionId });
      if (gate.kind === "inconsistent") {
        throw new PeriodLifecycleIntegrityError();
      }
      if (gate.kind === "not-found") {
        throw new LeadFormDomainError(`Section ${sectionId} not found.`);
      }
      if (gate.kind === "not-editable") {
        throw new ReopenRequestError(reopenBlockedMessage("period_closed"));
      }
      const section = await tx.reportSection.findUnique({
        where: { id: sectionId },
        select: { authorId: true, status: true },
      });
      if (!section) {
        throw new LeadFormDomainError(`Section ${sectionId} not found.`);
      }
      if (section.authorId !== userId) {
        throw new LeadFormAccessError(
          "Can only request reopen for your own section.",
        );
      }
      if (section.status !== "submitted") {
        throw new ReopenRequestError(reopenBlockedMessage("not_submitted"));
      }
      await tx.reopenRequest.create({
        data: {
          reportSectionId: sectionId,
          requestedById: userId,
          reason: reason && reason.trim().length > 0 ? reason.trim() : null,
        },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ReopenRequestError(
        reopenBlockedMessage("pending_request_exists"),
      );
    }
    throw error;
  }
}
