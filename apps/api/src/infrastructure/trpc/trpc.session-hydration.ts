import {
  DEFAULT_ORGANIZATION_IDENTITY,
  type UserSession,
} from "@customreport/shared";

import { PrismaService } from "../prisma/prisma.service.js";

/**
 * 5-second TTL cache for the Organization singleton.
 *
 * The org row is read on every authenticated tRPC call to hydrate
 * `session.organization`. A short TTL keeps admin renames visible within
 * ~5s without hammering Postgres on every request. Cache miss path is
 * a single primary-key lookup, so cold reads are cheap.
 */
const ORG_CACHE_TTL_MS = 5000;
// eslint-disable-next-line no-restricted-syntax -- Module-level TTL singleton cache must be assignable for refresh and explicit clearOrgCache invalidation.
let orgCache: {
  value: { shortName: string; fullName: string };
  expiresAt: number;
} | null = null;

/** Invalidates the org cache immediately; call after updateOrganization. */
export function clearOrgCache(): void {
  orgCache = null;
}

/**
 * Viewer sessions need an up-to-date list of granted
 * `ReportingGroup.id`s for groupScopeFilter. We hydrate per-request rather
 * than baking into the JWT because admin can grant/revoke at any time and
 * stale JWTs would leak (or block) access.
 *
 * No-op for non-viewer roles to keep the hot path cheap.
 */
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

/**
 * Hydrate the singleton organization identity onto
 * the session so authenticated routes can render the brand without a
 * second round-trip. We DO NOT bake this into the JWT for two reasons:
 *   1. JWTs are 1h-lived; admin renames would not propagate until refresh.
 *   2. Adding required fields to the JWT shape would invalidate every
 *      in-flight cookie on deploy.
 *
 * A 5-second module-level TTL cache (defined above) absorbs the read load —
 * the org row changes on the order of months, not seconds, so a stale
 * 5s window is acceptable. The cache is process-local; in a multi-replica
 * deploy each replica eventually picks up the new value within TTL.
 */
async function hydrateOrganization(
  session: UserSession,
  prisma: PrismaService,
): Promise<UserSession> {
  const now = Date.now();
  if (!orgCache || orgCache.expiresAt < now) {
    // Seed defaults are generic — concrete tenant brand stays
    // in the seed file / admin-edited Organization row, never in code.
    const row = await prisma.organization.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        shortName: DEFAULT_ORGANIZATION_IDENTITY.shortName,
        fullName: DEFAULT_ORGANIZATION_IDENTITY.fullName,
      },
      update: {},
      select: { shortName: true, fullName: true },
    });
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
 * Composes the four hydration helpers in their canonical order:
 * resolveSectionId → hydrateViewerGroupAccess → hydrateReportingGroupName
 * → hydrateOrganization.
 *
 * File-local and NOT exported beyond this module (D3): no HydrationStep
 * enum, no mocking seam. The factory-level tests already cover the contract.
 *
 * The PDF-export path (`buildPdfExportSession`) runs this same pipeline so
 * the worker renders AS THE REQUESTER (empty-PDF fix); only legacy tokens
 * without a `requestedBy` claim keep the narrow, unhydrated viewer session.
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
