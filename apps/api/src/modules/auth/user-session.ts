import type { DbRole, UserSession } from "@customreport/shared";
import type { PrismaClient } from "@prisma/client";

import { isUniqueViolation } from "../../lib/prisma-unique-violation.js";

// Turns a verified SAML / dev-login identity into a UserSession: resolve-or-
// provision the user, and for a lead with no active section delegate period +
// section creation to injected seams (this module does not own that persistence).

export interface SamlProfile {
  samlId: string;
  email: string;
  displayName: string;
  role: DbRole;
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

// Email match with both samlIds present and differing — reused email, different IdP identity.
// Caller's catch-all already maps any throw to a failed login.
export class SamlIdentityMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SamlIdentityMismatchError";
  }
}

// True only when BOTH sides carry a samlId and they differ. Either side
// missing one (seed/dev-login users) is not a mismatch — the email-only path
// stays unchanged for them.
function isSamlIdentityMismatch(
  existingByEmail: { samlId: string } | null,
  profile: SamlProfile,
): boolean {
  return Boolean(
    existingByEmail?.samlId &&
    profile.samlId &&
    existingByEmail.samlId !== profile.samlId,
  );
}

type ExistingUser = Awaited<ReturnType<PrismaClient["user"]["findFirst"]>>;

// Prefer email match (seed users may not have samlId), fall back to samlId. A
// samlId collision on the email hit is refused outright (not re-linked, not
// auto-created) rather than silently inheriting the old account's role/group.
async function resolveExistingUser(
  prisma: PrismaClient,
  profile: SamlProfile,
): Promise<ExistingUser> {
  const existingByEmail = await prisma.user.findFirst({
    where: { email: profile.email },
  });
  if (isSamlIdentityMismatch(existingByEmail, profile)) {
    throw new SamlIdentityMismatchError(
      `SAML profile samlId does not match the samlId on record for email ${profile.email}`,
    );
  }
  return (
    existingByEmail ??
    (await prisma.user.findFirst({ where: { samlId: profile.samlId } }))
  );
}

// `User.email` and `User.samlId` are each `@unique`; either colliding means a
// concurrent first-login raced us. The shared guard also reads the pg-adapter
// shape, where the old meta.target-only check was blind.
function isUserUniqueViolation(error: unknown): boolean {
  return (
    isUniqueViolation(error, { index: "User_email_key", columns: ["email"] }) ||
    isUniqueViolation(error, { index: "User_samlId_key", columns: ["samlId"] })
  );
}

// Every non-viewer owns a ReportingGroup: keep the one already on record, else
// adopt the oldest active group, else materialize the seeded default so a fresh
// install can still complete a first login. Viewers own none.
async function resolveNextReportingGroupId(
  prisma: PrismaClient,
  profile: SamlProfile,
  existing: { reportingGroupId: string | null } | null,
): Promise<string | null> {
  if (profile.role === "viewer") return null;
  if (existing?.reportingGroupId) return existing.reportingGroupId;

  const oldestActive = await prisma.reportingGroup.findFirst({
    where: { archived: false },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (oldestActive) return oldestActive.id;

  const seededDefault = await prisma.reportingGroup.upsert({
    where: { id: DEFAULT_REPORTING_GROUP_ID },
    create: {
      id: DEFAULT_REPORTING_GROUP_ID,
      name: "Software Development",
      description: "Default reporting group for newly provisioned users",
      archived: false,
    },
    update: { archived: false },
    select: { id: true },
  });
  return seededDefault.id;
}

// Two concurrent first-logins of the same new identity both miss the find and
// collide on the email/samlId unique index, so the create catches the unique
// violation and re-reads the winner's full row instead of throwing a 500.
async function createUserOrAdoptRaceWinner(
  prisma: PrismaClient,
  profile: SamlProfile,
  reportingGroupId: string | null,
) {
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
        reportingGroupId,
      },
    });
  } catch (error) {
    if (!isUserUniqueViolation(error)) throw error;
    // Create-race loser re-resolves; different samlId for this email must refuse.
    const won = await resolveExistingUser(prisma, profile);
    if (!won) throw error;
    return won;
  }
}

async function writeProvisionedUser(
  prisma: PrismaClient,
  profile: SamlProfile,
  existing: { id: string; reportingGroupId: string | null } | null,
) {
  const nextReportingGroupId = await resolveNextReportingGroupId(
    prisma,
    profile,
    existing,
  );

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
  return createUserOrAdoptRaceWinner(prisma, profile, nextReportingGroupId);
}

// A lead with no active section gets their workspace provisioned (period +
// section) through the injected seam — the auth module does not own that
// persistence. Other roles never auto-create a section, but head/viewer still
// need the active report id, so they fall back to the newest draft report.
async function resolveActiveWorkspace(
  prisma: PrismaClient,
  user: { id: string; role: string },
  provisionLeadWorkspace: ProvisionLeadWorkspace,
): Promise<{
  activeReportId: string | null;
  activeReportSectionId: string | null;
}> {
  // Multiple draft reports possible; order by report.createdAt so pick is recency, not insert order.
  const existingSection = await prisma.reportSection.findFirst({
    where: { authorId: user.id, report: { status: "draft" } },
    select: { id: true, reportId: true },
    orderBy: { report: { createdAt: "desc" } },
  });

  const provisioned =
    !existingSection && user.role === "lead"
      ? await provisionLeadWorkspace(user.id)
      : null;

  const activeSection =
    existingSection ??
    (provisioned
      ? { id: provisioned.sectionId, reportId: provisioned.reportId }
      : null);
  if (activeSection) {
    return {
      activeReportId: activeSection.reportId,
      activeReportSectionId: activeSection.id,
    };
  }

  const activeReport = await prisma.report.findFirst({
    where: { status: "draft" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return {
    activeReportId: activeReport?.id ?? null,
    activeReportSectionId: null,
  };
}

export async function buildUserSession(
  prisma: PrismaClient,
  profile: SamlProfile,
  provisionLeadWorkspace: ProvisionLeadWorkspace,
  options: { resyncExisting?: boolean } = {},
): Promise<UserSession> {
  const existing = await resolveExistingUser(prisma, profile);

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

  const { activeReportId, activeReportSectionId } =
    await resolveActiveWorkspace(prisma, user, provisionLeadWorkspace);

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
    activeReportId,
    activeReportSectionId,
    // Carry the owning ReportingGroup id in the JWT so groupScopeFilter needs no
    // per-request Prisma lookup. viewer sessions may have none; their visibility
    // hydrates lazily through `viewerGroupAccess` in trpc.context.
    reportingGroupId: user.reportingGroupId ?? undefined,
    reportingGroupName: reportingGroup?.name ?? undefined,
  };
}
