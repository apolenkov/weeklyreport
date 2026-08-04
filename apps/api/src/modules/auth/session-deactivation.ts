import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { SessionRevocationService } from "../admin/index.js";

// Single source of truth for the revoked/deactivated decision across every
// JWT-admitting entry path. Fail-open Redis fast path + fail-closed Prisma
// isActive read — see openspec/specs/jwt-session-integrity (two-tier gate).
export async function isUserAccessBarred(
  userId: string,
  prisma: PrismaService,
  sessionRevocation: Pick<SessionRevocationService, "isRevoked">,
): Promise<boolean> {
  const revoked = await sessionRevocation.isRevoked(userId).catch(() => false);
  if (revoked) {
    return true;
  }
  const userRow = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });
  // Compare `isActive` to `false` (not `!isActive`) so only an explicit
  // deactivation bars; a missing row bars separately (hard-deleted account).
  // Keeping the checks apart stops either from over-barring the other.
  const missing = userRow == null;
  const deactivated = userRow?.isActive === false;
  return missing || deactivated;
}
