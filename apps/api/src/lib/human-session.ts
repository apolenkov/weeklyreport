import type { UserSession } from "@customreport/shared";

import { PrismaService } from "../infrastructure/prisma/prisma.service.js";
import { hydrateSession } from "../infrastructure/trpc/trpc.session-hydration.js";
import { SessionRevocationService } from "../modules/admin/index.js";
import { isUserAccessBarred } from "../modules/auth/index.js";

export interface HumanSessionDeps {
  verifySessionToken: (token: string) => UserSession;
  sessionRevocation: Pick<SessionRevocationService, "isRevoked">;
  prisma: PrismaService;
}

/**
 * The single human-session chokepoint: the three steps that turn a session
 * cookie into a real, currently-valid user session — token verify, the Redis
 * revocation fast path, and the Prisma `isActive` check — followed by the
 * per-request hydration the rest of the app relies on (notably
 * `viewerGroupAccess`, which group-scope authz reads and which is NOT in the
 * JWT). Returns null for any invalid / revoked / deactivated token; errors from
 * access checks or hydration propagate.
 *
 * Deliberately does NOT accept the PDF-export worker token or the dev-mode
 * synthetic session that the full `createContext` chain falls back to: a caller
 * that needs a real human (the authenticated `/pdfs` download) resolves through
 * this and rejects everything else. `createContext` layers those fallbacks on
 * top of this, never the reverse.
 *
 * The revoked/deactivated decision is delegated to `isUserAccessBarred`: a
 * Redis revocation fast path that fails OPEN, then an authoritative Prisma
 * `isActive` read that fails CLOSED — including a missing user row (a
 * hard-deleted account no longer keeps a live session).
 */
export async function resolveHumanSession(
  token: string,
  deps: HumanSessionDeps,
): Promise<UserSession | null> {
  const session = (() => {
    try {
      return deps.verifySessionToken(token);
    } catch {
      return null;
    }
  })();
  if (!session) return null;
  if (
    await isUserAccessBarred(
      session.userId,
      deps.prisma,
      deps.sessionRevocation,
    )
  ) {
    return null;
  }
  return hydrateSession(session, deps.prisma);
}
