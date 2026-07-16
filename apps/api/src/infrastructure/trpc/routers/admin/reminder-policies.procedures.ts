import {
  adminReminderRuleSchema,
  reminderPolicySchema,
} from "@customreport/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { ReminderAdminService } from "../../../../modules/admin/index.js";
import { mapDomainError } from "../../trpc.error-mapper.js";
import { adminProcedure } from "../../trpc.middleware.js";

export interface AdminReminderPoliciesDeps {
  reminderAdminService: ReminderAdminService;
}

export function createAdminReminderPoliciesProcedures(
  deps: AdminReminderPoliciesDeps,
) {
  return {
    /**
     * Per-period reminder rules are read-only here (scheduler derives them
     * from `ReminderPolicy`). Read path `admin.getSnapshot.reminderRules`
     * still visualizes derived rows in the admin UI.
     */
    saveReminderRule: adminProcedure
      .input(adminReminderRuleSchema)
      .mutation(() => {
        throw new TRPCError({
          code: "METHOD_NOT_SUPPORTED",
          message:
            "Per-period reminder rules are read-only; they derive from reminder policies. Use admin.savePolicy instead.",
        });
      }),
    /** List reminder policies (active + archived) for the policy editor grid. */
    listPolicies: adminProcedure.query(async () => {
      try {
        return await deps.reminderAdminService.listPolicies();
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
    /**
     * Upsert a reminder policy by id. Emits `admin.policy.save` plus generic
     * `mutation` so SIEM can filter on `event` / create-vs-update without
     * parsing the procedure name. Existence check runs BEFORE the upsert so
     * audit `action` reflects the pre-state.
     */
    savePolicy: adminProcedure
      .input(reminderPolicySchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const existed = await deps.reminderAdminService.policyExists(
            input.id,
          );
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
      }),
    /**
     * Archive a reminder policy: hard-delete when no derived rules, else flip
     * `active`. Emits `admin.policy.remove` on success only (failures already
     * surface via the generic `mutation` audit envelope).
     */
    removePolicy: adminProcedure
      .input(z.object({ id: z.uuid() }))
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
      }),
    deleteReminderRule: adminProcedure
      .input(z.object({ ruleId: z.uuid() }))
      .mutation(async ({ input }) => {
        try {
          return await deps.reminderAdminService.removeReminderRule(
            input.ruleId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  };
}
