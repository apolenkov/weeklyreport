import { z } from "zod";

const MAX_REPORTING_GROUP_NAME_LENGTH = 200;
const MAX_ORG_SHORT_NAME_LENGTH = 16;
const MAX_ORG_FULL_NAME_LENGTH = 200;

/**
 * DB Role enum wire values (must match Prisma; includes admin for SAML persistence).
 */
export const roleSchema = z.enum(["lead", "head", "admin", "viewer"]);

/** Session-axis role enum (separate home from DB `roleSchema` / role-type). */
export const sessionRoleSchema = z.enum(["lead", "head", "admin", "viewer"]);

/** Single role→label map for session and DB axes so surfaces cannot drift. */
export const ROLE_LABEL: Record<Role | DbRole, string> = {
  lead: "Lead",
  head: "Head",
  admin: "Admin",
  viewer: "Viewer",
};

/** Canonical post-login home path per session role (viewer → /reports/latest). */
export const ROLE_HOME_PATH: Record<Role, string> = {
  lead: "/lead/report",
  head: "/head/dashboard",
  admin: "/admin",
  viewer: "/reports/latest",
};

/** Shared dev-login email roster; api and web must list the same address per role. */
export const DEV_LOGIN_EMAIL_BY_ROLE: Record<DbRole, string> = {
  lead: "lead1@customreport.local",
  head: "head@customreport.local",
  admin: "admin@customreport.local",
  viewer: "viewer@customreport.local",
};

/**
 * Session JWT/read-model shape: optional name parts, hydrated group/org
 * fields, viewer group access as a deliberate zero-row filter when empty.
 */
export const userSessionSchema = z.object({
  userId: z.uuid(),
  email: z.email(),
  name: z.string().min(1),
  // Optional: PDF-export and SAML stubs may only carry `name`.
  lastName: z.string().optional(),
  firstName: z.string().optional(),
  middleName: z.string().nullable().optional(),
  role: sessionRoleSchema,
  activeReportId: z.uuid().nullable().optional(),
  activeReportSectionId: z.uuid().nullable().optional(),
  // Optional: PDF session has no group; undefined means no head/lead group context.
  reportingGroupId: z.uuid().optional(),
  // Hydrated per request so JWTs keep only the group id while renames stay fresh.
  reportingGroupName: z
    .string()
    .min(1)
    .max(MAX_REPORTING_GROUP_NAME_LENGTH)
    .optional(),
  // Viewer-only; empty array is a deliberate zero-row filter, not "unset".
  viewerGroupAccess: z.array(z.uuid()).optional(),
  // Hydrated post-verify so JWTs stay small and admin renames do not stale-cache.
  organization: z
    .object({
      shortName: z.string().min(1).max(MAX_ORG_SHORT_NAME_LENGTH),
      fullName: z.string().min(1).max(MAX_ORG_FULL_NAME_LENGTH),
    })
    .optional(),
});

/** Session-axis role for assertRole. */
export type Role = z.infer<typeof sessionRoleSchema>;
/** Persistence-axis role for admin user writes (Prisma Role). */
export type DbRole = z.infer<typeof roleSchema>;
/** Authenticated session read model. */
export type UserSession = z.infer<typeof userSessionSchema>;
