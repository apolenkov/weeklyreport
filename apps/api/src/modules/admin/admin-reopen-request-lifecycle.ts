import type { UserSession } from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { groupScopeFilter } from "../../lib/group-scope.js";
import {
  AdminReopenRequestNotFoundError,
  type DecideReopenRequestInput,
  type ListReopenRequestsInput,
  type ReopenDecisionOutcome,
  type ReopenRequestRow,
} from "./admin-shared.js";

// reopen-request-lifecycle / ADR 0008 — group-scoped list/count + race-safe decide.

// Soft cap: list is newest-first; UI shows a page, not the full history.
const REOPEN_REQUEST_LIST_CAP = 100;

// Scope is ReportSectionWhereInput, so it nests under reportSection.
/**
 * List Reopen Requests.
 * @param prisma - The prisma argument.
 * @param input - The input argument.
 */
export async function listReopenRequests(
  prisma: PrismaService,
  input: ListReopenRequestsInput,
): Promise<ReopenRequestRow[]> {
  const statusFilter = input.status === "all" ? {} : { status: input.status };
  const scope = groupScopeFilter(input.session, "reportSection");
  const rows = await prisma.reopenRequest.findMany({
    where: { ...statusFilter, reportSection: scope },
    orderBy: { createdAt: "desc" },
    take: REOPEN_REQUEST_LIST_CAP,
    include: {
      requestedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
      reportSection: {
        include: {
          report: {
            select: {
              id: true,
              weekLabel: true,
              periodStart: true,
              periodEnd: true,
            },
          },
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    reportSectionId: r.reportSectionId,
    reason: r.reason,
    status: r.status,
    reviewNote: r.reviewNote,
    reviewedAt: r.reviewedAt,
    createdAt: r.createdAt,
    requestedBy: r.requestedBy,
    reviewedBy: r.reviewedBy,
    sectionStatus: r.reportSection.status,
    report: {
      id: r.reportSection.report.id,
      weekLabel: r.reportSection.report.weekLabel,
      periodStart: r.reportSection.report.periodStart,
      periodEnd: r.reportSection.report.periodEnd,
    },
  }));
}

/**
 * Count Pending Reopen Requests.
 * @param prisma - The prisma argument.
 * @param session - The session argument.
 */
export async function countPendingReopenRequests(
  prisma: PrismaService,
  session: UserSession,
): Promise<number> {
  const scope = groupScopeFilter(session, "reportSection");
  return prisma.reopenRequest.count({
    where: { status: "pending", reportSection: scope },
  });
}

// The scoped request row the decision transaction operates on.
interface DecidableReopenRequest {
  readonly id: string;
  readonly reportSectionId: string;
}

// Approve = flip the section back to draft so the lead can edit again, but
// ONLY if it is still submitted. A separate revoke can have flipped it to
// draft while the request stayed pending.
async function applyApproval(
  tx: Prisma.TransactionClient,
  req: DecidableReopenRequest,
  input: DecideReopenRequestInput,
): Promise<ReopenDecisionOutcome> {
  const flipped = await tx.reportSection.updateMany({
    where: { id: req.reportSectionId, status: "submitted" },
    data: {
      status: "draft",
      submittedAt: null,
      revokedAt: new Date(),
      revokedBy: input.decidedBy,
    },
  });
  if (flipped.count === 0) {
    // Stale approve: terminal auto-close, no section flip, no funnel skew.
    await tx.reopenRequest.update({
      where: { id: req.id },
      data: {
        status: "rejected",
        reviewedById: input.decidedBy,
        reviewedAt: new Date(),
        reviewNote: "Auto-closed: the section was already reopened.",
      },
    });
    return { kind: "stale" };
  }

  return { kind: "decided", decision: "approved" };
}

// Conditional updateMany so only the row-count-1 winner of concurrent
// head+admin acts takes effect.
async function applyDecision(
  tx: Prisma.TransactionClient,
  req: DecidableReopenRequest,
  input: DecideReopenRequestInput,
): Promise<ReopenDecisionOutcome> {
  const decided = await tx.reopenRequest.updateMany({
    where: { id: req.id, status: "pending" },
    data: {
      status: input.decision,
      reviewedById: input.decidedBy,
      reviewedAt: new Date(),
      reviewNote: input.reviewNote,
    },
  });
  // Loser of a concurrent decision: nothing changed.
  if (decided.count === 0) {
    return { kind: "already-processed" };
  }

  if (input.decision === "rejected") {
    return { kind: "decided", decision: "rejected" };
  }

  return applyApproval(tx, req, input);
}

// Scoped findFirst blocks out-of-group decide; the decision itself runs in one
// transaction.
/**
 * Decide Reopen Request.
 * @param prisma - The prisma argument.
 * @param input - The input argument.
 */
export async function decideReopenRequest(
  prisma: PrismaService,
  input: DecideReopenRequestInput,
): Promise<ReopenDecisionOutcome> {
  const scope = groupScopeFilter(input.session, "reportSection");
  const req = await prisma.reopenRequest.findFirst({
    where: { id: input.id, reportSection: scope },
    select: { id: true, reportSectionId: true },
  });
  if (!req) {
    throw new AdminReopenRequestNotFoundError("Reopen request not found.");
  }

  return prisma.$transaction((tx) => applyDecision(tx, req, input));
}
