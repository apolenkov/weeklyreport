import {
  DEFAULT_ORGANIZATION_IDENTITY,
  type UserSession,
} from "@customreport/shared";

import { PrismaService } from "../prisma/prisma.service.js";

// Short TTL: admin renames visible within ~5s without a DB hit per request.
const ORG_CACHE_TTL_MS = 5000;
// eslint-disable-next-line no-restricted-syntax -- Module-level TTL singleton cache must be assignable for refresh and explicit clearOrgCache invalidation.
let orgCache: {
  value: { shortName: string; fullName: string };
  expiresAt: number;
} | null = null;

// Immediate invalidation after updateOrganization.
export function clearOrgCache(): void {
  orgCache = null;
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
  if (!orgCache || orgCache.expiresAt < now) {
    // Upsert (not create) on missing row so concurrent cold reads collapse
    // instead of racing into P2002. Seed/admin hold the real brand, not code.
    const existing = await prisma.organization.findUnique({
      where: { id: "singleton" },
      select: { shortName: true, fullName: true },
    });
    const row =
      existing ??
      (await prisma.organization.upsert({
        where: { id: "singleton" },
        create: {
          id: "singleton",
          shortName: DEFAULT_ORGANIZATION_IDENTITY.shortName,
          fullName: DEFAULT_ORGANIZATION_IDENTITY.fullName,
        },
        update: {},
        select: { shortName: true, fullName: true },
      }));
    orgCache = {
      value: { shortName: row.shortName, fullName: row.fullName },
      expiresAt: now + ORG_CACHE_TTL_MS,
    };
  }
  return { ...session, organization: orgCache.value };
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

/**
 * A fixed pipeline keeps request and PDF-export sessions aligned on mutable
 * authorization scope; file-local steps prevent callers from skipping one.
 */
export async function hydrateSession(
  session: UserSession,
  prisma: PrismaService,
): Promise<UserSession> {
  const resolved = await resolveSectionId(session, prisma);
  const hydrated = await hydrateViewerGroupAccess(resolved, prisma);
  const withGroup = await hydrateReportingGroupName(hydrated, prisma);
  return hydrateOrganization(withGroup, prisma);
}
