import type { UserSession } from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { SessionRevocationService } from "../admin/index.js";

export interface LiveAccess {
  readonly role: UserSession["role"];
  readonly reportingGroupId: string | null;
}

// Single source of truth for the revoked/deactivated decision across every
// JWT-admitting entry path. Fail-open Redis fast path + fail-closed Prisma
// isActive read — see openspec/specs/jwt-session-integrity (two-tier gate).
// The same read returns the live role and group so callers never trust the
// JWT copies after an admin change.
export async function readLiveAccess(
  userId: string,
  prisma: PrismaService,
  sessionRevocation: Pick<SessionRevocationService, "isRevoked">,
): Promise<LiveAccess | null> {
  const revoked = await sessionRevocation.isRevoked(userId).catch(() => false);
  if (revoked) {
    return null;
  }
  const userRow = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, role: true, reportingGroupId: true },
  });
  // A missing row (hard-deleted account) bars as well as isActive=false.
  if (!userRow?.isActive) {
    return null;
  }
  return { role: userRow.role, reportingGroupId: userRow.reportingGroupId };
}

export async function isUserAccessBarred(
  userId: string,
  prisma: PrismaService,
  sessionRevocation: Pick<SessionRevocationService, "isRevoked">,
): Promise<boolean> {
  return (await readLiveAccess(userId, prisma, sessionRevocation)) === null;
}
