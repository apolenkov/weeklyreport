import { z } from "zod";

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
  reportingGroupName: z.string().min(1).max(200).optional(),
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
      shortName: z.string().min(1).max(16),
      fullName: z.string().min(1).max(200),
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
