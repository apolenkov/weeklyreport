import type { DbRole, UserSession } from "@customreport/shared";
import { normalizeEmail } from "@customreport/shared";
import type { Prisma, PrismaClient } from "@prisma/client";

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

// SAML gives only displayName but ФИО columns are required, and we don't guess
// name order: whole displayName → lastName; firstName is a whitespace placeholder
// the name helpers treat as absent (canSave trims it, so it never re-saves).
const SAML_STUB_FIRST_NAME_PLACEHOLDER = " ";

const LIVE_REPORT_WHERE = {
  status: "draft",
  archived: false,
  periodStatus: "open",
  periodState: { in: ["scheduled", "open"] },
  autoPublished: false,
  autoArchived: false,
  publishedAt: null,
  publishedById: null,
  reopenedAt: null,
} satisfies Prisma.ReportWhereInput;

// Email match with both samlIds present and differing — reused email, different IdP identity.
// Caller's catch-all already maps any throw to a failed login.
export class SamlIdentityMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SamlIdentityMismatchError";
  }
}

// A non-viewer with no group on record is a provisioning gap: silently adopting
// the oldest group (or materializing the seeded default) turns a missing
// ownership into a valid-looking assignment the admin never chose.
export class ReportingGroupRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportingGroupRequiredError";
  }
}

// A persisted User always carries a samlId. An email match with a different
// stable SAML identity is therefore a security mismatch, never a relink.
function isSamlIdentityMismatch(
  existingByEmail: { samlId: string } | null,
  profile: SamlProfile,
): boolean {
  return Boolean(existingByEmail && existingByEmail.samlId !== profile.samlId);
}

type ExistingUser = Awaited<ReturnType<PrismaClient["user"]["findFirst"]>>;

// Prefer email match, then resolve the same stable SAML identity when an email
// changed. A samlId collision on the email hit is refused outright (not
// re-linked, not auto-created) rather than silently inheriting the matched
// account's role/group.
async function resolveExistingUser(
  prisma: PrismaClient,
  profile: SamlProfile,
): Promise<ExistingUser> {
  // Email identity is case-insensitive, so the lookup folds both sides — a
  // stored mixed-case row stays reachable and a case-variant assertion can
  // never slip a second account past the email match.
  const existingByEmail = await prisma.user.findFirst({
    where: {
      email: { equals: normalizeEmail(profile.email), mode: "insensitive" },
    },
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

// `User.email` (exact and lower()) and `User.samlId` are each `@unique`;
// either colliding means a concurrent first-login raced us. The shared guard
// also reads the pg-adapter error shape and checks both the constraint
// metadata and indexed columns.
function isUserUniqueViolation(error: unknown): boolean {
  return (
    isUniqueViolation(error, { index: "User_email_key", columns: ["email"] }) ||
    isUniqueViolation(error, { index: "User_email_lower_key" }) ||
    isUniqueViolation(error, { index: "User_samlId_key", columns: ["samlId"] })
  );
}

// Every non-viewer owns a ReportingGroup: keep the one already on record, else
// fail loud — a lead/head/admin with no group is an incomplete provision, not a
// reason to adopt an arbitrary group silently. Viewers own none.
function resolveNextReportingGroupId(
  profile: SamlProfile,
  existing: { reportingGroupId: string | null } | null,
): string | null {
  if (profile.role === "viewer") return null;
  if (existing?.reportingGroupId) return existing.reportingGroupId;

  throw new ReportingGroupRequiredError(
    `A reporting group is required for a ${profile.role} user; assign one before login.`,
  );
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
        email: normalizeEmail(profile.email),
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
  const nextReportingGroupId = resolveNextReportingGroupId(profile, existing);

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
// section) through the injected seam — auth does not own that persistence.
// Other roles fall back to the newest draft report for the active report id.
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
    where: { authorId: user.id, report: LIVE_REPORT_WHERE },
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
    where: LIVE_REPORT_WHERE,
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
  // its development-only query-param role switch updates the live row.
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
