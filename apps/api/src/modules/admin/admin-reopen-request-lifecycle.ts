import type { UserSession } from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { groupScopeFilter } from "../../lib/group-scope.js";
import {
  AdminReopenRequestNotFoundError,
  type DecideReopenRequestInput,
  type ListReopenRequestsInput,
  type ReopenDecisionOutcome,
  type ReopenRequestRow,
} from "./admin-shared.js";

/**
 * Reopen-request lifecycle writes/reads for the Admin Panel "Reopen
 * Requests" tab and the head dashboard card (reopen-request-lifecycle,
 * ADR 0008): group-scoped list/count, and the race-safe decide transaction.
 */

/**
 * Group-scoped reopen-request list. A head sees only its own group's
 * requests; admin scope is `{}` (global). The scope fragment is a
 * ReportSectionWhereInput, so it nests UNDER reportSection — these are
 * ReopenRequest queries, not ReportSection queries.
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
    take: 100,
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

/** Group-scoped pending-reopen count — same group scope as the list. */
export async function countPendingReopenRequests(
  prisma: PrismaService,
  session: UserSession,
): Promise<number> {
  const scope = groupScopeFilter(session, "reportSection");
  return prisma.reopenRequest.count({
    where: { status: "pending", reportSection: scope },
  });
}

/**
 * The full race-safe decision: a scoped re-load (a head cannot decide an
 * out-of-group request by passing its id — the scoped findFirst finds
 * nothing → NOT_FOUND) followed by the compare-and-set transaction. The
 * decision is race-safe against a second decider (head + admin can both
 * act): the status re-check and the section flip happen inside ONE
 * transaction via conditional updateMany; only the row-count-1 winner takes
 * effect.
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

  return prisma.$transaction(async (tx) => {
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
      return { kind: "already-processed" as const };
    }

    if (input.decision === "rejected") {
      return { kind: "decided" as const, decision: "rejected" as const };
    }

    // Approve = flip the section back to draft so the lead can edit again,
    // but ONLY if it is still submitted. A separate revoke can have flipped
    // it to draft while the request stayed pending.
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
      // Stale approve: the section was already reopened elsewhere. Make the
      // request terminal (rejected + auto-note) so it leaves the pending
      // queue, flip nothing, and skew NO funnel metric — an auto-close is
      // not a real decision (the funnel stays requested/approved/rejected).
      await tx.reopenRequest.update({
        where: { id: req.id },
        data: {
          status: "rejected",
          reviewedById: input.decidedBy,
          reviewedAt: new Date(),
          reviewNote: "Auto-closed: the section was already reopened.",
        },
      });
      return { kind: "stale" as const };
    }

    return { kind: "decided" as const, decision: "approved" as const };
  });
}
