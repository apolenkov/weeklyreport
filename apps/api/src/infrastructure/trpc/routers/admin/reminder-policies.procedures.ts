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
    // Rules are scheduler-derived from ReminderPolicy; mutation is blocked.
    saveReminderRule: adminProcedure
      .input(adminReminderRuleSchema)
      .mutation(() => {
        throw new TRPCError({
          code: "METHOD_NOT_SUPPORTED",
          message:
            "Per-period reminder rules are read-only; they derive from reminder policies. Use admin.savePolicy instead.",
        });
      }),
    listPolicies: adminProcedure.query(async () => {
      try {
        return await deps.reminderAdminService.listPolicies();
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
    // Existence check before upsert so audit action is create vs update.
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
    // Hard-delete when no derived rules; else flip active. Audit on success only.
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
      .mutation(() => {
        // Rules may disappear only as part of permanent policy removal, which
        // deletes the policy and its derived rows as one domain operation.
        throw new TRPCError({
          code: "METHOD_NOT_SUPPORTED",
          message:
            "Per-period reminder rules are read-only; remove their reminder policy instead.",
        });
      }),
  };
}
