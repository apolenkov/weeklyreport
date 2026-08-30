import { reminderPolicySchema } from "@customreport/shared";
import { z } from "zod";

import type { ReminderAdminService } from "../../../../modules/admin/index.js";
import { mapDomainError } from "../../trpc.error-mapper.js";
import {
  adminProcedure,
  captureMutationAuditInputMiddleware,
} from "../../trpc.middleware.js";

export interface AdminReminderPoliciesDeps {
  readonly reminderAdminService: ReminderAdminService;
}

function buildListPolicies(deps: AdminReminderPoliciesDeps) {
  return adminProcedure.query(async () => {
    try {
      return await deps.reminderAdminService.listPolicies();
    } catch (error) {
      throw mapDomainError(error);
    }
  });
}

// Existence check before upsert so audit action is create vs update.
function buildSavePolicy(deps: AdminReminderPoliciesDeps) {
  return adminProcedure
    .input(reminderPolicySchema)
    .use(captureMutationAuditInputMiddleware)
    .mutation(async ({ ctx, input }) => {
      try {
        const existed = await deps.reminderAdminService.policyExists(input.id);
        const saved = await deps.reminderAdminService.savePolicy(input);
        ctx.auditLogger.policySave({
          userId: ctx.session.userId,
          role: ctx.session.role,
          ip: ctx.ip,
          policyId: saved.id,
          kind: saved.kind,
          action: existed ? "update" : "create",
        });
        return saved;
      } catch (error) {
        throw mapDomainError(error);
      }
    });
}

// Hard-delete when no derived rules; else flip active. Audit on success only.
function buildRemovePolicy(deps: AdminReminderPoliciesDeps) {
  return adminProcedure
    .input(z.object({ id: z.uuid() }))
    .use(captureMutationAuditInputMiddleware)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await deps.reminderAdminService.removePolicy(input.id);
        ctx.auditLogger.policyRemove({
          userId: ctx.session.userId,
          role: ctx.session.role,
          ip: ctx.ip,
          policyId: input.id,
        });
        return result;
      } catch (error) {
        throw mapDomainError(error);
      }
    });
}

export function createAdminReminderPoliciesProcedures(
  deps: AdminReminderPoliciesDeps,
) {
  return {
    listPolicies: buildListPolicies(deps),
    savePolicy: buildSavePolicy(deps),
    removePolicy: buildRemovePolicy(deps),
  };
}
