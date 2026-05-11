import { z } from 'zod';

/**
 * Role of a User row in the database (Prisma `Role` enum).
 * DB-bound writes (admin user CRUD) MUST validate against this set.
 *
 * Phase 32-C / H-01: widened to include 'admin' so the SAML callback can
 * persist admin-roled Keycloak users without crashing on Prisma's enum
 * validation. Stays in lockstep with `enum Role` in `prisma/schema.prisma`.
 *
 * UFB-057 / Phase 57: 'director' added. Director is a leadership-audience
 * consumer (read-only view across ALL groups) — distinct from 'admin'
 * (god-mode, manages users/groups/settings) and from 'head' (owns one
 * group). Viewer-equivalent in capability but lands on the head-dashboard
 * surface instead of the published archive.
 */
export const roleSchema = z.enum(['lead', 'head', 'admin', 'viewer', 'director']);

/**
 * Role attached to an authenticated session (JWT / SAML claim).
 *
 * Wider than `roleSchema` because the session layer recognises 'admin' for
 * the requireRole middleware factory (D-AUTH-03). adminProcedure ===
 * headProcedure for v6.0; the alias is preserved so Phase 29 can split them
 * without breaking call sites.
 *
 * UFB-057 / Phase 57: 'director' carried alongside the DB-bound set.
 */
export const sessionRoleSchema = z.enum(['lead', 'head', 'admin', 'viewer', 'director']);

export const userSessionSchema = z.object({
  userId: z.string().uuid(),
  email: z.email(),
  name: z.string().min(1),
  role: sessionRoleSchema,
  activeReportId: z.string().uuid().nullable().optional(),
  activeReportSectionId: z.string().uuid().nullable().optional(),
  /**
   * UFB-040 / Phase 46-01: the user's owning reporting group (mirrors
   * `User.reportingGroupId` in Prisma). Optional on the session shape
   * because (a) the PDF-export synthetic session has no group context,
   * (b) legacy JWTs minted before Phase 46 do not carry it. Downstream
   * consumers (groupScopeFilter) treat `undefined` as "no head/lead
   * group context" and fall through to viewer-style empty filter.
   */
  reportingGroupId: z.string().uuid().optional(),
  /**
   * UFB-040 / Phase 46-01: list of `ReportingGroup.id` values the viewer
   * has been granted access to via the `ViewerGroupAccess` join table.
   * Hydrated in `trpc.context.ts` for viewer sessions ONLY (head/lead/
   * admin do not use this list). Empty array is meaningful — it means
   * the viewer has been provisioned but granted access to no groups,
   * which `groupScopeFilter` translates into a zero-row filter.
   */
  viewerGroupAccess: z.array(z.string().uuid()).optional(),
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
 * `Role` is the session-level role used by the requireRole tRPC middleware
 * factory. It is wider than the DB Role enum (use `DbRole` for admin user
 * writes) — this matches the v6.0 contract where admin sessions exist but
 * admin User rows do not yet.
 */
export type Role = z.infer<typeof sessionRoleSchema>;
export type DbRole = z.infer<typeof roleSchema>;
export type UserSession = z.infer<typeof userSessionSchema>;
