import { adminUserSchema } from "@customreport/shared";
import { z } from "zod";

import type {
  SessionRevocationService,
  SnapshotAdminService,
} from "../../../../modules/admin/index.js";
import {
  mapDomainError,
  withDomainErrorMapping,
} from "../../trpc.error-mapper.js";
import {
  adminProcedure,
  captureMutationAuditInputMiddleware,
} from "../../trpc.middleware.js";

export interface AdminUsersDeps {
  readonly snapshotAdminService: SnapshotAdminService;
  // Required: a deactivation without the revoked-set fast path silently leaves
  // in-flight JWTs valid until TTL. Wiring is enforced at the composition root.
  readonly sessionRevocationService: SessionRevocationService;
}

export function createAdminUsersProcedures(deps: AdminUsersDeps) {
  return {
    saveUser: adminProcedure
      .input(adminUserSchema)
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.snapshotAdminService.upsertUser(input, ctx.session.userId),
        ),
      ),

    deleteUser: adminProcedure
      .input(z.object({ userId: z.uuid() }))
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.snapshotAdminService.removeUser(
            input.userId,
            ctx.session.userId,
          ),
        ),
      ),

    // Redis revoke so in-flight JWTs fail immediately (not only JWT TTL).
    deactivateUser: adminProcedure
      .input(z.object({ userId: z.uuid() }))
      .use(captureMutationAuditInputMiddleware)
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await deps.snapshotAdminService.deactivateUser(
            input.userId,
            ctx.session.userId,
          );
          await deps.sessionRevocationService.revokeSession(input.userId);
          return result;
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    // Clear Redis revoke so new logins are not blocked by a stale revoke set.
    // A failed removal converges via the service's hourly reconcile sweep.
    activateUser: adminProcedure
      .input(z.object({ userId: z.uuid() }))
      .use(captureMutationAuditInputMiddleware)
      .mutation(async ({ input }) => {
        try {
          const result = await deps.snapshotAdminService.activateUser(
            input.userId,
          );
          await deps.sessionRevocationService.restoreSession(input.userId);
          return result;
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  };
}
