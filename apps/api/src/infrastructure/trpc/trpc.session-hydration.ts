import {
  ORGANIZATION_SINGLETON_ID,
  type OrganizationPublic,
  type UserSession,
} from "@weeklyreport/shared";

import { PrismaService } from "../prisma/prisma.service.js";

// Short TTL: admin renames visible within ~5s without a DB hit per request.
const ORG_CACHE_TTL_MS = 5000;
class OrganizationCache {
  private entry: {
    readonly value: OrganizationPublic;
    readonly expiresAt: number;
  } | null = null;

  clear(): void {
    this.entry = null;
  }

  get(now: number): OrganizationPublic | null {
    return this.entry !== null && this.entry.expiresAt >= now
      ? this.entry.value
      : null;
  }

  set(value: OrganizationPublic, expiresAt: number): void {
    this.entry = { value, expiresAt };
  }
}

const organizationCache = new OrganizationCache();

// Immediate invalidation after updateOrganization.
export function clearOrgCache(): void {
  organizationCache.clear();
}

// Per-request hydrate: admin grant/revoke mid-JWT-lifetime would leak or
// block if baked into the JWT. No-op for non-viewers.
async function hydrateViewerGroupAccess(
  session: UserSession,
  prisma: PrismaService,
): Promise<UserSession> {
  if (session.role !== "viewer") return session;
  const grants = await prisma.viewerGroupAccess.findMany({
    where: { viewerUserId: session.userId },
    select: { groupId: true },
  });
  return { ...session, viewerGroupAccess: grants.map((g) => g.groupId) };
}

async function hydrateReportingGroupName(
  session: UserSession,
  prisma: PrismaService,
): Promise<UserSession> {
  if (!session.reportingGroupId || session.reportingGroupName) return session;
  const row = await prisma.reportingGroup.findUnique({
    where: { id: session.reportingGroupId },
    select: { name: true },
  });
  return row ? { ...session, reportingGroupName: row.name } : session;
}

// Not in JWT: renames would lag 1h, and new JWT fields invalidate cookies.
// Process-local TTL cache; multi-replica eventually consistent within TTL.
async function hydrateOrganization(
  session: UserSession,
  prisma: PrismaService,
): Promise<UserSession> {
  const now = Date.now();
  const cached = organizationCache.get(now);
  if (cached !== null) {
    return { ...session, organization: cached };
  }
  // A missing singleton row is an unseeded/truncated deployment, not a gap
  // to paper over with a code default — fail loud so the real brand must
  // come from seed/admin, never from shared constants.
  const row = await prisma.organization.findUnique({
    where: { id: ORGANIZATION_SINGLETON_ID },
    select: { shortName: true, fullName: true },
  });
  if (row === null) {
    throw new Error(
      `Organization singleton row '${ORGANIZATION_SINGLETON_ID}' is missing; apply the canonical init migration or restore the row`,
    );
  }
  const value = { shortName: row.shortName, fullName: row.fullName };
  organizationCache.set(value, now + ORG_CACHE_TTL_MS);
  return { ...session, organization: value };
}

async function resolveSectionId(
  session: UserSession,
  prisma: PrismaService,
): Promise<UserSession> {
  if (
    !session.activeReportSectionId &&
    session.activeReportId &&
    session.userId
  ) {
    const section = await prisma.reportSection.findFirst({
      where: {
        reportId: session.activeReportId,
        authorId: session.userId,
      },
      select: { id: true },
    });
    return section
      ? { ...session, activeReportSectionId: section.id }
      : session;
  }
  return session;
}

// A fixed pipeline keeps request and PDF-export sessions aligned on mutable
// authorization scope; file-local steps prevent callers from skipping one.
// `liveResolved`: the caller already read the user's section (found or not) and
// a viewer's group grants, so those lookups are not repeated.
export async function hydrateSession(
  session: UserSession,
  prisma: PrismaService,
  options: { readonly liveResolved?: boolean } = {},
): Promise<UserSession> {
  const resolved = options.liveResolved
    ? session
    : await resolveSectionId(session, prisma);
  const hydrated = options.liveResolved
    ? resolved
    : await hydrateViewerGroupAccess(resolved, prisma);
  const withGroup = await hydrateReportingGroupName(hydrated, prisma);
  return hydrateOrganization(withGroup, prisma);
}
