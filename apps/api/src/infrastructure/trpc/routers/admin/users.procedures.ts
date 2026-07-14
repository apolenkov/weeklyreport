import { adminUserSchema } from "@customreport/shared";
import { z } from "zod";

import type { AdminService } from "../../../../modules/admin/admin.service.js";
import type { SessionRevocationService } from "../../../../modules/admin/session-revocation.service.js";
import { mapDomainError } from "../../trpc.error-mapper.js";
import { adminProcedure } from "../../trpc.middleware.js";

export interface AdminUsersDeps {
  adminService: AdminService;
  /**
   * Redis-backed session revocation for
   * deactivate/activate user. Optional so existing role-coverage test
   * fixtures that build the router with `{}` deps keep compiling —
   * when undefined the mutations still flip isActive in Prisma but skip
   * the Redis fast-path (sessions expire naturally via JWT TTL).
   */
  sessionRevocationService?: SessionRevocationService;
}

export function createAdminUsersProcedures(deps: AdminUsersDeps) {
  return {
    saveUser: adminProcedure
      .input(adminUserSchema)
      .mutation(async ({ input }) => {
        try {
          return await deps.adminService.upsertUser(input);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    deleteUser: adminProcedure
      .input(z.object({ userId: z.uuid() }))
      .mutation(async ({ input }) => {
        try {
          return await deps.adminService.removeUser(input.userId);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    /**
     * Deactivate a user — sets isActive=false in
     * Prisma and adds the userId to the Redis revoked set so any in-flight
     * JWT session is rejected immediately by the context factory.
     */
    deactivateUser: adminProcedure
      .input(z.object({ userId: z.uuid() }))
      .mutation(async ({ input }) => {
        try {
          const result = await deps.adminService.deactivateUser(input.userId);
          await deps.sessionRevocationService?.revokeSession(input.userId);
          return result;
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    /**
     * Re-activate a user — sets isActive=true in
     * Prisma and removes the userId from the Redis revoked set so new logins
     * can proceed normally.
     */
    activateUser: adminProcedure
      .input(z.object({ userId: z.uuid() }))
      .mutation(async ({ input }) => {
        try {
          const result = await deps.adminService.activateUser(input.userId);
          await deps.sessionRevocationService?.restoreSession(input.userId);
          return result;
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  };
}
