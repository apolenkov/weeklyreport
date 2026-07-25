import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { SessionRevocationService } from "../admin/index.js";

/**
 * The single source of truth for the revoked/deactivated decision across every
 * JWT-admitting entry path (regular tRPC session, PDF-export rebuild, Bull
 * Board admin guard), so a stale JWT cannot outlive a deactivation.
 *
 * Two tiers, in order:
 *  - Redis revoked-set fast path, fail-OPEN: a thrown/failed lookup must NOT
 *    bar the user, otherwise a Redis outage would lock everyone out. The
 *    authoritative Prisma read below is the safety net.
 *  - Prisma `isActive` read, fail-CLOSED: a missing/`null` row OR
 *    `isActive === false` bars the user. Barring the missing row closes the
 *    hard-deleted-user gap — admin snapshot-restore deletes unreferenced users
 *    without touching the revoked set, so the fast path never fires for them.
  * @param userId - The userId argument.
 * @param prisma - The prisma argument.
 * @param sessionRevocation - The sessionRevocation argument.
 */
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
