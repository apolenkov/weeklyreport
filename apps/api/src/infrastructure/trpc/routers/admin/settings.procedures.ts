import {
  adminTestTelegramSendSchema,
  appSettingsUpdateSchema,
  organizationUpdateSchema,
} from "@customreport/shared";
import { TRPCError } from "@trpc/server";
import type { Queue } from "bullmq";

import { isTelegramConfigured } from "../../../../lib/env.js";
import type { SnapshotAdminService } from "../../../../modules/admin/index.js";
import type { OrganizationService } from "../../../../modules/organization/index.js";
import { TELEGRAM_OUTBOUND_JOB_OPTS } from "../../../../modules/telegram/index.js";
import { captureJobTraceContext } from "../../../bullmq/worker-observability.js";
import type { EnvConfig } from "../../../config/env.schema";
import { clearOrgCache } from "../../trpc.context.js";
import { mapDomainError } from "../../trpc.error-mapper.js";
import { adminProcedure } from "../../trpc.middleware.js";

export interface AdminSettingsDeps {
  snapshotAdminService: SnapshotAdminService;
  // Validated env from main.ts — not raw process.env.
  env: EnvConfig;
  // Optional for `{}` fixtures; undefined throws INTERNAL_SERVER_ERROR, not 500.
  telegramOutboundQueue?: Queue;
  // Optional for role-coverage `{}` deps that never hit org.* paths.
  organizationService?: OrganizationService;
}

// The optional deps are wiring, not request data: an unwired collaborator is a
// composition-root bug, so it surfaces as INTERNAL_SERVER_ERROR rather than a
// silent no-op.
function requireOrganizationService(
  deps: AdminSettingsDeps,
): OrganizationService {
  if (!deps.organizationService) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "OrganizationService is not wired into the tRPC router.",
    });
  }
  return deps.organizationService;
}

function requireTelegramOutboundQueue(deps: AdminSettingsDeps): Queue {
  if (!deps.telegramOutboundQueue) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Telegram outbound queue is not wired into the tRPC router.",
    });
  }
  return deps.telegramOutboundQueue;
}

function createSnapshotSettingsProcedures(deps: AdminSettingsDeps) {
  return {
    snapshot: adminProcedure.query(async () => {
      try {
        return await deps.snapshotAdminService.getSnapshot();
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
    getSettings: adminProcedure.query(async () => {
      try {
        return await deps.snapshotAdminService.getSettings();
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
    updateSettings: adminProcedure
      .input(appSettingsUpdateSchema)
      .mutation(async ({ input }) => {
        try {
          return await deps.snapshotAdminService.updateSettings(input);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  };
}

function createTelegramSettingsProcedures(deps: AdminSettingsDeps) {
  return {
    // Active only when TG_BOT_TOKEN is set AND ≥1 active TelegramBinding.
    integrationsStatus: adminProcedure.query(async () => {
      try {
        const configured = isTelegramConfigured(deps.env);
        return await deps.snapshotAdminService.integrationsStatus(configured);
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
    // Retry lives on job options so producers stay free of queue semantics.
    testTelegramSend: adminProcedure
      .input(adminTestTelegramSendSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          const job = await requireTelegramOutboundQueue(deps).add(
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
  };
}

function createOrganizationProcedures(deps: AdminSettingsDeps) {
  return {
    getOrganization: adminProcedure.query(async () => {
      try {
        return await requireOrganizationService(deps).getOrganization();
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
    // Read before-state in the same call so audit has previous and new identity.
    updateOrganization: adminProcedure
      .input(organizationUpdateSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const organizationService = requireOrganizationService(deps);
          const previous = await organizationService.getOrganization();
          const next = await organizationService.updateOrganization(input);
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

export function createAdminSettingsProcedures(deps: AdminSettingsDeps) {
  return {
    ...createSnapshotSettingsProcedures(deps),
    ...createTelegramSettingsProcedures(deps),
    ...createOrganizationProcedures(deps),
  };
}
