import type { UserSession } from "@customreport/shared";

import type { PrismaService } from "../infrastructure/prisma/prisma.service.js";
import { hydrateSession } from "../infrastructure/trpc/trpc.session-hydration.js";
import type { SessionRevocationService } from "../modules/admin/index.js";
import { isUserAccessBarred } from "../modules/auth/index.js";

export interface HumanSessionDeps {
  readonly verifySessionToken: (token: string) => UserSession;
  readonly sessionRevocation: Pick<SessionRevocationService, "isRevoked">;
  readonly prisma: PrismaService;
}

// Human-only chokepoint (no PDF worker / dev synthetic). Redis revoke fails
// open, Prisma isActive fails closed. Hydration supplies viewerGroupAccess
// (not in JWT). createContext layers PDF/dev fallbacks on top of this.
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
