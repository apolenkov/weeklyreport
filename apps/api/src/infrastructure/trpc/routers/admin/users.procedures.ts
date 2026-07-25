import { adminUserSchema } from "@customreport/shared";
import { z } from "zod";

import type {
  SessionRevocationService,
  SnapshotAdminService,
} from "../../../../modules/admin/index.js";
import { mapDomainError } from "../../trpc.error-mapper.js";
import { adminProcedure } from "../../trpc.middleware.js";

export interface AdminUsersDeps {
  snapshotAdminService: SnapshotAdminService;
  // Optional for `{}` fixtures: isActive still flips; JWT TTL expires sessions.
  sessionRevocationService?: SessionRevocationService;
}

/**
 * Create Admin Users Procedures.
 * @param deps - The deps argument.
 */
export function createAdminUsersProcedures(deps: AdminUsersDeps) {
  return {
    saveUser: adminProcedure
      .input(adminUserSchema)
      .mutation(async ({ input }) => {
        try {
          return await deps.snapshotAdminService.upsertUser(input);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    deleteUser: adminProcedure
      .input(z.object({ userId: z.uuid() }))
      .mutation(async ({ input }) => {
        try {
          return await deps.snapshotAdminService.removeUser(input.userId);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    // Redis revoke so in-flight JWTs fail immediately (not only JWT TTL).
    deactivateUser: adminProcedure
      .input(z.object({ userId: z.uuid() }))
      .mutation(async ({ input }) => {
        try {
          const result = await deps.snapshotAdminService.deactivateUser(
            input.userId,
          );
          await deps.sessionRevocationService?.revokeSession(input.userId);
          return result;
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    // Clear Redis revoke so new logins are not blocked by a stale revoke set.
    activateUser: adminProcedure
      .input(z.object({ userId: z.uuid() }))
      .mutation(async ({ input }) => {
        try {
          const result = await deps.snapshotAdminService.activateUser(
            input.userId,
          );
          await deps.sessionRevocationService?.restoreSession(input.userId);
          return result;
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  };
}
