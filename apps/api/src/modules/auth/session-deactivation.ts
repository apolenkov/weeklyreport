import type { UserSession } from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { SessionRevocationService } from "../admin/index.js";

export interface LiveAccess {
  readonly role: UserSession["role"];
  readonly reportingGroupId: string | null;
  readonly reportingGroupName: string | null;
  // Set only when the caller passed `activeReportId`: the user's own section
  // of that report, or null when they have none.
  readonly reportSectionId: string | null;
  // Set only when the caller asked for viewer groups and the user is a viewer.
  readonly viewerGroupIds: readonly string[] | null;
}

export interface LiveAccessScope {
  // Look up the user's own section of this report in the same read.
  readonly activeReportId?: string | undefined;
  // Read the viewer's group grants in the same read.
  readonly withViewerGroups?: boolean;
}

// Single source of truth for the revoked/deactivated decision across every
// JWT-admitting entry path. Fail-open Redis fast path + fail-closed Prisma
// isActive read — see openspec/specs/jwt-session-integrity (two-tier gate).
// The same read returns the live role and group (with its name) so callers
// never trust the JWT copies after an admin change, and, given the active
// report, the user's own section id (and, on request, a viewer's group grants):
// one round trip instead of three.
export async function readLiveAccess(
  userId: string,
  prisma: PrismaService,
  sessionRevocation: Pick<SessionRevocationService, "isRevoked">,
  { activeReportId, withViewerGroups = false }: LiveAccessScope = {},
): Promise<LiveAccess | null> {
  const revoked = await sessionRevocation.isRevoked(userId).catch(() => false);
  if (revoked) {
    return null;
  }
  const userRow = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isActive: true,
      role: true,
      reportingGroupId: true,
      reportingGroup: { select: { name: true } },
      ...(activeReportId
        ? {
            authoredReportSections: {
              where: { reportId: activeReportId },
              select: { id: true },
              take: 1,
            },
          }
        : {}),
      ...(withViewerGroups
        ? { viewerGroupAccess: { select: { groupId: true } } }
        : {}),
    },
  });
  // A missing row (hard-deleted account) bars as well as isActive=false.
  if (!userRow?.isActive) {
    return null;
  }
  return {
    role: userRow.role,
    reportingGroupId: userRow.reportingGroupId,
    reportingGroupName: userRow.reportingGroup?.name ?? null,
    reportSectionId:
      ("authoredReportSections" in userRow
        ? userRow.authoredReportSections.at(0)?.id
        : undefined) ?? null,
    viewerGroupIds:
      userRow.role === "viewer" && "viewerGroupAccess" in userRow
        ? userRow.viewerGroupAccess.map((grant) => grant.groupId)
        : null,
  };
}

export async function isUserAccessBarred(
  userId: string,
  prisma: PrismaService,
  sessionRevocation: Pick<SessionRevocationService, "isRevoked">,
): Promise<boolean> {
  return (await readLiveAccess(userId, prisma, sessionRevocation)) === null;
}
