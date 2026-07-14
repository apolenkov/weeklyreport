import {
  adminTestTelegramSendSchema,
  appSettingsUpdateSchema,
  organizationUpdateSchema,
} from "@customreport/shared";
import { TRPCError } from "@trpc/server";
import type { Queue } from "bullmq";

import { isTelegramConfigured } from "../../../../lib/env.js";
import type { AdminService } from "../../../../modules/admin/admin.service.js";
import type { OrganizationService } from "../../../../modules/organization/organization.service.js";
import { TELEGRAM_OUTBOUND_JOB_OPTS } from "../../../../modules/telegram/telegram.queue.js";
import { captureJobTraceContext } from "../../../bullmq/worker-observability.js";
import type { EnvConfig } from "../../../config/env.schema";
import { clearOrgCache } from "../../trpc.context.js";
import { mapDomainError } from "../../trpc.error-mapper.js";
import { adminProcedure } from "../../trpc.middleware.js";

export interface AdminSettingsDeps {
  adminService: AdminService;
  /**
   * Validated env from main.ts — Telegram configured-check
   * (`integrationsStatus`) and reseed repo-root override (`dev.wipeAndReseed`);
   * not raw `process.env`.
   */
  env: EnvConfig;
  /**
   * BullMQ `telegram-outbound` queue for `admin.testTelegramSend` (queue →
   * worker → MockTelegramAdapter) without an active bot. Optional for `{}`
   * role-coverage deps; when undefined throws `INTERNAL_SERVER_ERROR` instead
   * of null-deref 500.
   */
  telegramOutboundQueue?: Queue;
  /**
   * Organization identity: `org.getPublic` (landing hero shortName/fullName);
   * `admin.getOrganization` / `admin.updateOrganization` (Settings → Identity).
   * Optional for role-coverage `{}` deps that never exercise org.* paths.
   */
  organizationService?: OrganizationService;
}

export function createAdminSettingsProcedures(deps: AdminSettingsDeps) {
  return {
    snapshot: adminProcedure.query(async () => {
      try {
        return await deps.adminService.getSnapshot();
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
    getSettings: adminProcedure.query(async () => {
      try {
        return await deps.adminService.getSettings();
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
    updateSettings: adminProcedure
      .input(appSettingsUpdateSchema)
      .mutation(async ({ input }) => {
        try {
          return await deps.adminService.updateSettings(input);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    /**
     * External-integrations status for Settings → Integrations (v1: Telegram).
     * Active only when `TG_BOT_TOKEN` is set AND ≥1 TelegramBinding has
     * `active=true`; either gate failing keeps the badge muted.
     * adminProcedure-gated (head/admin) so a lead can't poll the binding count.
     */
    integrationsStatus: adminProcedure.query(async () => {
      try {
        const configured = isTelegramConfigured(deps.env);
        return await deps.adminService.integrationsStatus(configured);
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
    /**
     * Admin smoke-test for telegram-outbound: enqueue one job for
     * TelegramProcessor → MockTelegramAdapter (or real bot). Returns
     * `{ jobId }` so the UI confirms queue without BullMQ events. Retry
     * (3 attempts, exponential backoff) is on job options so producers stay
     * free of queue semantics.
     */
    testTelegramSend: adminProcedure
      .input(adminTestTelegramSendSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          if (!deps.telegramOutboundQueue) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                "Telegram outbound queue is not wired into the tRPC router.",
            });
          }
          const job = await deps.telegramOutboundQueue.add(
            "telegram-test",
            {
              chatId: input.chatId,
              text: input.text,
              ...captureJobTraceContext(ctx.correlationId),
            },
            { ...TELEGRAM_OUTBOUND_JOB_OPTS },
          );
          return { jobId: job.id ?? null };
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    /**
     * Singleton `Organization` for Settings → Identity (full row + timestamps
     * for "last updated"). Public landing uses `org.getPublic` instead.
     */
    getOrganization: adminProcedure.query(async () => {
      try {
        if (!deps.organizationService) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "OrganizationService is not wired into the tRPC router.",
          });
        }
        return await deps.organizationService.getOrganization();
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
    /**
     * Update singleton `Organization`. Emits `admin.organization.update` plus
     * the generic `mutation` envelope so SIEM/brand dashboards filter on
     * `event` without parsing the procedure. Before-state is read in the same
     * call so the audit line has previous and new identity.
     */
    updateOrganization: adminProcedure
      .input(organizationUpdateSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          if (!deps.organizationService) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "OrganizationService is not wired into the tRPC router.",
            });
          }
          const previous = await deps.organizationService.getOrganization();
          const next = await deps.organizationService.updateOrganization(input);
          clearOrgCache();
          ctx.auditLogger.organizationUpdate({
            userId: ctx.session.userId,
            role: ctx.session.role,
            ip: ctx.ip,
            previousShortName: previous.shortName,
            previousFullName: previous.fullName,
            nextShortName: next.shortName,
            nextFullName: next.fullName,
          });
          return next;
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  };
}
