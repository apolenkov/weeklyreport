import {
  reportAssistantOutcomeSchema,
  reportAssistantRequestSchema,
} from "@customreport/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { groupScopeFilter } from "../../../lib/group-scope.js";
import type { SnapshotAdminService } from "../../../modules/admin/index.js";
import type { LeadFormService } from "../../../modules/report-sections/index.js";
import type { ReportAssistantService } from "../../../modules/search/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import {
  headProcedure,
  leadProcedure,
  protectedProcedure,
  router,
} from "../trpc.middleware.js";

const MAX_REOPEN_REASON_LENGTH = 500;

export interface LeadFormRouterDeps {
  snapshotAdminService: SnapshotAdminService;
  leadFormService: LeadFormService;
  reportAssistantService?: ReportAssistantService;
}

export function createLeadFormRouter(deps: LeadFormRouterDeps) {
  return router({
    assistant: leadProcedure
      .input(reportAssistantRequestSchema)
      .output(reportAssistantOutcomeSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          if (!deps.reportAssistantService) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Report assistant is not configured",
            });
          }
          return await deps.reportAssistantService.answer(
            input,
            ctx.session.userId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    // Org-wide lead-form presentation flags. Read-only slice of AppSettings
    // (admin-managed via admin.updateSettings, like every other setting);
    // exposed to every authenticated role so the lead form can pick classic
    // vs unified view.
    viewSettings: protectedProcedure.query(async () => {
      try {
        const settings = await deps.snapshotAdminService.getSettings();
        return { unifiedActivityView: settings.unifiedActivityView };
      } catch (error) {
        throw mapDomainError(error);
      }
    }),

    byPeriod: protectedProcedure
      .input(
        z.object({
          reportId: z.uuid(),
          authorId: z.uuid().optional(),
        }),
      )
      .query(async ({ input, ctx }) => {
        try {
          const form = await deps.leadFormService.getByPeriod(
            input.reportId,
            ctx.session.userId,
            ctx.session.role,
            input.authorId,
          );
          ctx.logger.info("lead form load succeeded", {
            phase: "lead-form.load",
            procedure: "leadForm.byPeriod",
            userId: ctx.session.userId,
            role: ctx.session.role,
            reportId: input.reportId,
            requestedAuthorId: input.authorId ?? null,
            resolvedAuthorId: form.section.authorId,
            readOnly: form.readOnly,
          });
          return form;
        } catch (error) {
          const errorInfo =
            error instanceof Error
              ? { name: error.name, message: error.message }
              : { name: typeof error, message: String(error) };
          const logFailure =
            errorInfo.name === "LeadFormDomainError"
              ? ctx.logger.warn.bind(ctx.logger)
              : ctx.logger.error.bind(ctx.logger);
          logFailure("lead form load failed", {
            phase: "lead-form.load",
            procedure: "leadForm.byPeriod",
            userId: ctx.session.userId,
            role: ctx.session.role,
            reportId: input.reportId,
            requestedAuthorId: input.authorId ?? null,
            error: errorInfo,
          });
          throw mapDomainError(error);
        }
      }),

    fillFrom: protectedProcedure
      .input(
        z.object({
          targetSectionId: z.uuid(),
          sourceSectionId: z.uuid(),
          // Optimistic-concurrency expected version of the TARGET section.
          version: z.number().int().min(1),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await deps.leadFormService.fillFrom(
            input.targetSectionId,
            input.sourceSectionId,
            ctx.session.userId,
            input.version,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    // TODO(versions-v2): the version-history procedures (versions,
    // restoreVersion, getVersion, createSnapshot, setVersionPinned) are
    // deferred; re-add them when versions-v2 is designed.

    revoke: headProcedure
      .input(z.object({ reportSectionId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        try {
          // scope-leadform-revoke-authz: object-level authz — a head may only
          // revoke a section authored in its own group (admin scope is {}).
          // Mirrors the respondReopenRequest scoped re-load.
          return await deps.leadFormService.revokeSubmission(
            input.reportSectionId,
            ctx.session.userId,
            groupScopeFilter(ctx.session, "reportSection"),
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    revokeAllSubmitted: headProcedure
      .input(z.object({ reportId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        try {
          // scope-leadform-revoke-authz: bulk revoke is bounded to the head's
          // own group inside a multi-group report (admin scope is {} → global).
          return await deps.leadFormService.revokeAllSubmitted(
            input.reportId,
            ctx.session.userId,
            groupScopeFilter(ctx.session, "reportSection"),
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    requestReopen: protectedProcedure
      .input(
        z.object({
          reportSectionId: z.uuid(),
          reason: z.string().max(MAX_REOPEN_REASON_LENGTH).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await deps.leadFormService.requestReopen(
            input.reportSectionId,
            ctx.session.userId,
            input.reason,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    crossAuthors: protectedProcedure
      .input(z.object({ reportId: z.uuid() }))
      .query(async ({ input, ctx }) => {
        try {
          return await deps.leadFormService.getCrossAuthors(
            input.reportId,
            ctx.session.userId,
            ctx.session.role,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    // scope-lead-report-to-own-contribution — the lead form's
    // "Everyone" visibility lens. Full foreign content, gated by report
    // access AND product co-ownership for ALL callers (no head/admin
    // bypass); the role is intentionally NOT passed.
    crossAuthorContent: protectedProcedure
      .input(z.object({ reportId: z.uuid() }))
      .query(async ({ input, ctx }) => {
        try {
          return await deps.leadFormService.getCrossAuthorContent(
            input.reportId,
            ctx.session.userId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  });
}
