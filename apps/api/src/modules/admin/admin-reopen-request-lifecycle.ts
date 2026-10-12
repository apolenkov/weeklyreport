import type { Prisma } from "@prisma/client";
import {
  REOPEN_AUTO_CLOSE_NOTES,
  type UserSession,
} from "@weeklyreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { groupScopeFilter } from "../../lib/group-scope.js";
import { lockCurrentEditableReport } from "../../lib/report-lifecycle.js";
import { lockUser } from "../../lib/user-activity-assignment.js";
import { PeriodLifecycleIntegrityError } from "../period/index.js";
import { LeadFormConstraintError } from "../report-sections/index.js";
import {
  AdminAccessError,
  AdminReopenRequestNotFoundError,
  type DecideReopenRequestInput,
  type ListReopenRequestsInput,
  type ReopenDecisionOutcome,
  type ReopenRequestRow,
} from "./admin-shared.js";

// Group-scoped list/count + race-safe decide for reopen requests.
const REQUEST_NOT_FOUND = "Reopen request not found.";

function buildReopenListFilters(
  input: ListReopenRequestsInput,
): Prisma.ReopenRequestWhereInput[] {
  const cursorFilter: Prisma.ReopenRequestWhereInput | undefined = input.cursor
    ? {
        OR: [
          { createdAt: { lt: new Date(input.cursor.createdAt) } },
          {
            createdAt: new Date(input.cursor.createdAt),
            id: { lt: input.cursor.id },
          },
        ],
      }
    : undefined;
  const searchFilter: Prisma.ReopenRequestWhereInput | undefined = input.search
    ? {
        OR: [
          {
            requestedBy: {
              name: { contains: input.search, mode: "insensitive" },
            },
          },
          {
            requestedBy: {
              email: { contains: input.search, mode: "insensitive" },
            },
          },
          {
            reportSection: {
              report: {
                weekLabel: { contains: input.search, mode: "insensitive" },
              },
            },
          },
          { reason: { contains: input.search, mode: "insensitive" } },
          { reviewNote: { contains: input.search, mode: "insensitive" } },
        ],
      }
    : undefined;
  return [cursorFilter, searchFilter].filter(
    (filter): filter is Prisma.ReopenRequestWhereInput => filter !== undefined,
  );
}

// Scope is ReportSectionWhereInput, so it nests under reportSection.
export async function listReopenRequests(
  prisma: PrismaService,
  input: ListReopenRequestsInput,
): Promise<ReopenRequestRow[]> {
  const statusFilter = input.status === "all" ? {} : { status: input.status };
  const scope = groupScopeFilter(input.session, "reportSection");
  const additionalFilters = buildReopenListFilters(input);
  const rows = await prisma.reopenRequest.findMany({
    where: {
      ...statusFilter,
      reportSection: scope,
      ...(additionalFilters.length > 0 ? { AND: additionalFilters } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit + 1,
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
        reviewNote: REOPEN_AUTO_CLOSE_NOTES.sectionAlreadyReopened,
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

// User locks exclude actor/author reassignment until the decision commits.
// Keep the shared User -> Report order, then re-read current entitlement.
// Contract: openspec/specs/reopen-requests/spec.md (current group scope).
export async function decideReopenRequest(
  prisma: PrismaService,
  input: DecideReopenRequestInput,
): Promise<ReopenDecisionOutcome> {
  const scope = groupScopeFilter(input.session, "reportSection");
  return prisma.$transaction(async (tx) => {
    const req = await tx.reopenRequest.findFirst({
      where: { id: input.id, reportSection: scope },
      select: {
        id: true,
        reportSectionId: true,
        reportSection: { select: { authorId: true } },
      },
    });
    if (!req) {
      throw new AdminReopenRequestNotFoundError(REQUEST_NOT_FOUND);
    }
    const userIds = [
      ...new Set([input.session.userId, req.reportSection.authorId]),
    ].sort((left, right) => left.localeCompare(right));
    for (const userId of userIds) {
      if (!(await lockUser(tx, userId))) {
        throw new AdminReopenRequestNotFoundError(REQUEST_NOT_FOUND);
      }
    }
    const gate = await lockCurrentEditableReport(tx, {
      sectionId: req.reportSectionId,
    });
    if (gate.kind === "inconsistent") {
      throw new PeriodLifecycleIntegrityError();
    }
    if (gate.kind !== "editable") {
      throw new LeadFormConstraintError(
        "Cannot decide a reopen request outside an editable report.",
      );
    }
    const actor = await tx.user.findUnique({
      where: { id: input.session.userId },
      select: { isActive: true, role: true, reportingGroupId: true },
    });
    if (
      !actor?.isActive ||
      (actor.role !== "head" && actor.role !== "admin") ||
      input.decidedBy !== input.session.userId
    ) {
      throw new AdminAccessError("You can no longer decide reopen requests.");
    }
    const current = await tx.reopenRequest.findFirst({
      where: {
        id: req.id,
        reportSectionId: req.reportSectionId,
        reportSection: {
          ...groupScopeFilter(
            {
              role: actor.role,
              reportingGroupId: actor.reportingGroupId ?? undefined,
              viewerGroupAccess: [],
            },
            "reportSection",
          ),
          authorId: req.reportSection.authorId,
        },
      },
      select: { id: true, reportSectionId: true },
    });
    if (!current) {
      throw new AdminReopenRequestNotFoundError(REQUEST_NOT_FOUND);
    }
    return applyDecision(tx, current, input);
  });
}
