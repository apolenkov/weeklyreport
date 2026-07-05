import type { UserSession } from "@customreport/shared";
import type { PrismaClient, Role } from "@prisma/client";

import { isUniqueViolation } from "../../lib/prisma-unique-violation.js";

// Turns a verified SAML / dev-login identity into a UserSession: resolve-or-
// provision the user, and for a lead with no active section delegate period +
// section creation to injected seams (this module does not own that persistence).

export interface SamlProfile {
  samlId: string;
  email: string;
  displayName: string;
  role: Role;
}

// Seam for provisioning a lead's workspace at login, wired in the composition
// root (main.ts) so this module stays free of period/section persistence.
export type ProvisionLeadWorkspace = (
  userId: string,
) => Promise<{ reportId: string; sectionId: string }>;

const DEFAULT_REPORTING_GROUP_ID = "a0000000-0000-4000-8000-000000000301";

// SAML gives only displayName but ФИО columns are required, and we don't guess
// name order: whole displayName → lastName; firstName is a whitespace placeholder
// the name helpers treat as absent (canSave trims it, so it never re-saves).
const SAML_STUB_FIRST_NAME_PLACEHOLDER = " ";

// `User.email` and `User.samlId` are each `@unique`; either colliding means a
// concurrent first-login raced us. The shared guard also reads the pg-adapter
// shape, where the old meta.target-only check was blind.
function isUserUniqueViolation(error: unknown): boolean {
  return (
    isUniqueViolation(error, { columns: ["email"] }) ||
    isUniqueViolation(error, { columns: ["samlId"] })
  );
}

// Two concurrent first-logins of the same new identity both miss the find and
// collide on the email/samlId unique index, so the create catches the unique
// violation and re-reads the winner's full row instead of throwing a 500.
async function writeProvisionedUser(
  prisma: PrismaClient,
  profile: SamlProfile,
  existing: { id: string; reportingGroupId: string | null } | null,
) {
  const needsOwningGroup =
    profile.role !== "viewer" && !existing?.reportingGroupId;
  const fallbackReportingGroup = needsOwningGroup
    ? ((await prisma.reportingGroup.findFirst({
        where: { archived: false },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })) ??
      (await prisma.reportingGroup.upsert({
        where: { id: DEFAULT_REPORTING_GROUP_ID },
        create: {
          id: DEFAULT_REPORTING_GROUP_ID,
          name: "Core Development",
          description: "Default reporting group for newly provisioned users",
          archived: false,
        },
        update: { archived: false },
        select: { id: true },
      })))
    : null;
  const nextReportingGroupId =
    profile.role === "viewer"
      ? null
      : (existing?.reportingGroupId ??
        fallbackReportingGroup?.id ??
        DEFAULT_REPORTING_GROUP_ID);

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        samlId: profile.samlId,
        name: profile.displayName,
        role: profile.role,
        reportingGroupId: nextReportingGroupId,
      },
    });
  }

  try {
    return await prisma.user.create({
      data: {
        samlId: profile.samlId,
        email: profile.email,
        name: profile.displayName,
        lastName: profile.displayName.trim() || profile.email,
        firstName: SAML_STUB_FIRST_NAME_PLACEHOLDER,
        middleName: null,
        position: null,
        role: profile.role,
        reportingGroupId: nextReportingGroupId,
      },
    });
  } catch (error) {
    if (!isUserUniqueViolation(error)) throw error;
    // A concurrent first-login for the same identity won the create race.
    // Re-read by the same keys the fast path uses (email first, then samlId)
    // and return that full row; the loser session is identical to the winner's.
    const won =
      (await prisma.user.findFirst({ where: { email: profile.email } })) ??
      (await prisma.user.findFirst({ where: { samlId: profile.samlId } }));
    if (!won) throw error;
    return won;
  }
}

export async function buildUserSession(
  prisma: PrismaClient,
  profile: SamlProfile,
  provisionLeadWorkspace: ProvisionLeadWorkspace,
  options: { resyncExisting?: boolean } = {},
): Promise<UserSession> {
  // Prefer email match (seed users may not have samlId), fall back to samlId
  const existing =
    (await prisma.user.findFirst({ where: { email: profile.email } })) ??
    (await prisma.user.findFirst({ where: { samlId: profile.samlId } }));

  // SAML is create-only: an existing record is the source of truth and is
  // NEVER re-synced from the IdP. dev-login passes { resyncExisting: true } so
  // its query-param role switch still updates the live row (the UAT mechanism).
  const user =
    existing && options.resyncExisting !== true
      ? existing
      : await writeProvisionedUser(prisma, profile, existing);

  const reportingGroup = user.reportingGroupId
    ? await prisma.reportingGroup.findUnique({
        where: { id: user.reportingGroupId },
        select: { name: true },
      })
    : null;

  // Lead users: find or auto-create their section in the active (draft) report.
  const existingSection = await prisma.reportSection.findFirst({
    where: { authorId: user.id, report: { status: "draft" } },
    select: { id: true, reportId: true },
  });

  // A lead with no active section gets their workspace provisioned (period +
  // section) through the injected seam — the auth module does not own that
  // persistence. Other roles never auto-create a section.
  const provisioned =
    !existingSection && user.role === "lead"
      ? await provisionLeadWorkspace(user.id)
      : null;

  const activeSection =
    existingSection ??
    (provisioned
      ? { id: provisioned.sectionId, reportId: provisioned.reportId }
      : null);

  // All roles: find the active report (head/viewer have no section but need the reportId)
  const activeReport = activeSection
    ? null
    : await prisma.report.findFirst({
        where: { status: "draft" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    // Structured ФИО parts plumbed into the session so the nav avatar can
    // render correct surname+given initials (falls back to `name` when null).
    lastName: user.lastName,
    firstName: user.firstName,
    middleName: user.middleName,
    role: user.role,
    activeReportId: activeSection?.reportId ?? activeReport?.id ?? null,
    activeReportSectionId: activeSection?.id ?? null,
    // Carry the owning ReportingGroup id in the JWT so groupScopeFilter needs no
    // per-request Prisma lookup. viewer sessions may have none; their visibility
    // hydrates lazily through `viewerGroupAccess` in trpc.context.
    reportingGroupId: user.reportingGroupId ?? undefined,
    reportingGroupName: reportingGroup?.name ?? undefined,
  };
}
