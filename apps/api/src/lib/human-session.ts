import type { UserSession } from "@customreport/shared";

import type { PrismaService } from "../infrastructure/prisma/prisma.service.js";
import { hydrateSession } from "../infrastructure/trpc/trpc.session-hydration.js";
import type { SessionRevocationService } from "../modules/admin/index.js";
import { readLiveAccess } from "../modules/auth/index.js";

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
  const live = await readLiveAccess(
    session.userId,
    deps.prisma,
    deps.sessionRevocation,
    {
      activeReportId: session.activeReportSectionId
        ? undefined
        : (session.activeReportId ?? undefined),
      withViewerGroups: true,
    },
  );
  if (!live) return null;
  // Role and group come from the database, not the JWT, so an admin change
  // takes effect on the next request (jwt-session-integrity).
  // The JWT's cached group name is dropped with its id; the live read already
  // carries the current name, the user's section and a viewer's group grants,
  // so hydration skips all three.
  const { reportingGroupId: _id, reportingGroupName: _name, ...rest } = session;
  return hydrateSession(
    {
      ...rest,
      role: live.role,
      ...(live.reportingGroupId
        ? { reportingGroupId: live.reportingGroupId }
        : {}),
      ...(live.reportingGroupName
        ? { reportingGroupName: live.reportingGroupName }
        : {}),
      ...(live.reportSectionId
        ? { activeReportSectionId: live.reportSectionId }
        : {}),
      ...(live.viewerGroupIds
        ? { viewerGroupAccess: [...live.viewerGroupIds] }
        : {}),
    },
    deps.prisma,
    { liveResolved: true },
  );
}
