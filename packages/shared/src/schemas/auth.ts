import { z } from "zod";

const MAX_REPORTING_GROUP_NAME_LENGTH = 200;
const MAX_ORG_SHORT_NAME_LENGTH = 16;
const MAX_ORG_FULL_NAME_LENGTH = 200;

/**
 * Role of a User row in the database (Prisma `Role` enum).
 * DB-bound writes (admin user CRUD) MUST validate against this set.
 *
 * Phase 32-C / H-01: widened to include 'admin' so the SAML callback can
 * persist admin-roled Keycloak users without crashing on Prisma's enum
 * validation. Stays in lockstep with `enum Role` in `prisma/schema.prisma`.
 */
export const roleSchema = z.enum(["lead", "head", "admin", "viewer"]);

/**
 * Role attached to an authenticated session (JWT / SAML claim).
 *
 * Identical to `roleSchema` today — both enumerate lead/head/admin/viewer. The
 * two names are kept as separate aliases so the session axis and the DB Role
 * column can diverge later without touching every call site.
 */
export const sessionRoleSchema = z.enum(["lead", "head", "admin", "viewer"]);

/**
 * Display label for a role. Single source consumed by the login page, the dev
 * role-switcher, and the lead-form author mapper, so a role's label cannot
 * drift between surfaces (the head label was once "Department Head" in one copy
 * and "Head" in two others). Exhaustive on the role enum — adding a role is a
 * compile error until it has a label.
 */
export const ROLE_LABEL: Record<Role, string> = {
  lead: "Lead",
  head: "Head",
  admin: "Admin",
  viewer: "Viewer",
};

/**
 * Canonical per-role post-login landing route. One home backing all three
 * landing surfaces — the api dev-login fallback, the web login default, and
 * `roleHomePath` (brand link / role-gate) — so a role's landing cannot diverge
 * between tiers. Exhaustive on the role enum with NO runtime fallback here:
 * a non-`Role` runtime value (persisted/retired role) is the web call site's
 * concern, guarded there. The viewer lands on `/reports/latest`, its canonical
 * primary Status entry, never the `/reports?tab=published` list surface.
 */
export const ROLE_HOME_PATH: Record<Role, string> = {
  lead: "/lead/report",
  head: "/head/dashboard",
  admin: "/admin",
  viewer: "/reports/latest",
};

export const userSessionSchema = z.object({
  userId: z.uuid(),
  email: z.email(),
  name: z.string().min(1),
  /**
   * Structured ФИО parts, plumbed from `auth.me` so the nav avatar renders
   * correct surname+given initials. Optional because the synthetic PDF-export
   * session and SAML stubs carry only `name` — consumers fall back to it.
   */
  lastName: z.string().optional(),
  firstName: z.string().optional(),
  middleName: z.string().nullable().optional(),
  role: sessionRoleSchema,
  activeReportId: z.uuid().nullable().optional(),
  activeReportSectionId: z.uuid().nullable().optional(),
  /**
   * UFB-040 / Phase 46-01: the user's owning reporting group (mirrors
   * `User.reportingGroupId` in Prisma). Optional on the session shape
   * because (a) the PDF-export synthetic session has no group context,
   * (b) legacy JWTs minted before Phase 46 do not carry it. Downstream
   * consumers (groupScopeFilter) treat `undefined` as "no head/lead
   * group context" and fall through to viewer-style empty filter.
   */
  reportingGroupId: z.uuid().optional(),
  /**
   * Display name for the owning reporting group. Hydrated per request by the
   * API context so long-lived JWTs can keep carrying only the stable group id
   * while the navbar still reflects admin-side group renames.
   */
  reportingGroupName: z
    .string()
    .min(1)
    .max(MAX_REPORTING_GROUP_NAME_LENGTH)
    .optional(),
  /**
   * UFB-040 / Phase 46-01: list of `ReportingGroup.id` values the viewer
   * has been granted access to via the `ViewerGroupAccess` join table.
   * Hydrated in `trpc.context.ts` for viewer sessions ONLY (head/lead/
   * admin do not use this list). Empty array is meaningful — it means
   * the viewer has been provisioned but granted access to no groups,
   * which `groupScopeFilter` translates into a zero-row filter.
   */
  viewerGroupAccess: z.array(z.uuid()).optional(),
  /**
   * UFB-047 / Phase 48-A: organization identity hydrated per-request from
   * the `Organization` singleton in the tRPC context factory. Optional on
   * the schema for two reasons:
   *   1. JWT payloads (signed by createJwtSigner) do NOT carry it — so a
   *      JWT minted before Phase 48-A still verifies and the context
   *      factory fills the field after `verifySession`. Baking the field
   *      into the JWT would invalidate every in-flight cookie on deploy
   *      and would also stale-cache admin renames until next login.
   *   2. The PDF-export synthetic session does not need it; the worker
   *      reads the singleton directly when stamping the report header.
   * Mirrors the `viewerGroupAccess` hydration pattern.
   */
  organization: z
    .object({
      shortName: z.string().min(1).max(MAX_ORG_SHORT_NAME_LENGTH),
      fullName: z.string().min(1).max(MAX_ORG_FULL_NAME_LENGTH),
    })
    .optional(),
});

/**
 * `Role` is the session-level role used by `assertRole` / `buildRoleMiddleware`
 * (api). It enumerates the same members as the DB Role enum today (use `DbRole`
 * for admin user writes); the alias stays separate so the session and
 * persistence axes can diverge without a wide refactor.
 */
export type Role = z.infer<typeof sessionRoleSchema>;
export type DbRole = z.infer<typeof roleSchema>;
export type UserSession = z.infer<typeof userSessionSchema>;
