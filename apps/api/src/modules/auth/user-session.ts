import type { UserSession } from "@customreport/shared";
import type { PrismaClient, Role } from "@prisma/client";

/**
 * refactor-auth-exemplary-layering: login session-building, split out of
 * `auth.routes.ts` so that file is route wiring only and each unit stays a
 * single concern (no per-file lint exemption). This module turns a verified
 * SAML / dev-login identity into a `UserSession`: it resolves-or-provisions the
 * user, and — for a lead with no active section — delegates report-period and
 * report-section creation to injected functions (it does not own that
 * persistence). The route handlers in `auth.routes.ts` consume `buildUserSession`.
 */

export interface SamlProfile {
  samlId: string;
  email: string;
  displayName: string;
  role: Role;
}

/**
 * The seam through which `buildUserSession` provisions a lead's workspace at
 * login. Wired in the composition root (`main.ts`): the period factory
 * (`period/period-factory.ts`) finds-or-creates the current period, and
 * `report-sections/ensure-lead-section.ts` materialises the lead's section.
 */
export type ProvisionLeadWorkspace = (
  userId: string,
) => Promise<{ reportId: string; sectionId: string }>;

const DEFAULT_REPORTING_GROUP_ID = "a0000000-0000-4000-8000-000000000301";

// SAML stubs carry only `name` (= displayName); the structured ФИО parts are
// required columns the IdP cannot supply. Per the resolved decision we do NOT
// guess the name order: the whole displayName becomes `lastName`, and
// `firstName` is a whitespace placeholder — it satisfies the non-empty column
// while the name helpers treat it as absent (short form shows just the surname,
// avatar shows its initial). The admin sets the real parts on edit; canSave
// trims, so the placeholder can never be re-saved.
const SAML_STUB_FIRST_NAME_PLACEHOLDER = " ";

/**
 * Write (create or re-sync) a provisioned user. Only reached for a brand-new
 * user or a dev-login resync — the SAML create-only path reuses the existing
 * row untouched, so the reporting-group fallback machinery here never mutates
 * an existing admin-authored record.
 */
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

  return prisma.user.create({
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
    // UFB-040 / Phase 46-01: carry the user's owning ReportingGroup id in
    // the JWT so groupScopeFilter does not need a Prisma lookup per request.
    // viewer sessions may have no owning group; their visibility hydrates
    // through `viewerGroupAccess` lazily in trpc.context.
    reportingGroupId: user.reportingGroupId ?? undefined,
    reportingGroupName: reportingGroup?.name ?? undefined,
  };
}
