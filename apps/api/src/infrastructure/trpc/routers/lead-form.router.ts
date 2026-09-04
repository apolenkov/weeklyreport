import {
  leadStatusOverviewInputSchema,
  leadStatusOverviewOutputSchema,
  MAX_REOPEN_REASON_LENGTH,
  reportAssistantOutcomeSchema,
  reportAssistantRequestSchema,
} from "@customreport/shared";
import { z } from "zod";

import { groupScopeFilter } from "../../../lib/group-scope.js";
import type { SnapshotAdminService } from "../../../modules/admin/index.js";
import {
  LeadFormDomainError,
  type LeadFormService,
} from "../../../modules/report-sections/index.js";
import type { ReportAssistantService } from "../../../modules/search/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import {
  captureMutationAuditInputMiddleware,
  headProcedure,
  leadProcedure,
  protectedProcedure,
  router,
} from "../trpc.middleware.js";

export interface LeadFormRouterDeps {
  snapshotAdminService: SnapshotAdminService;
  leadFormService: LeadFormService;
  reportAssistantService: ReportAssistantService;
}

const reportIdInput = z.object({ reportId: z.uuid() });

// AppSettings slice for classic vs unified lead-form view (all auth roles).
function viewSettingsProcedure(deps: LeadFormRouterDeps) {
  return protectedProcedure.query(async () => {
    try {
      const settings = await deps.snapshotAdminService.getSettings();
      return { unifiedActivityView: settings.unifiedActivityView };
    } catch (error) {
      throw mapDomainError(error);
    }
  });
}

function describeError(error: unknown): { name: string; message: string } {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: typeof error, message: String(error) };
}

function byPeriodProcedure(deps: LeadFormRouterDeps) {
  return protectedProcedure
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
        // A domain error is an expected refusal (warn); anything else is a bug (error).
        const logFailure =
          error instanceof LeadFormDomainError
            ? ctx.logger.warn.bind(ctx.logger)
            : ctx.logger.error.bind(ctx.logger);
        logFailure("lead form load failed", {
          phase: "lead-form.load",
          procedure: "leadForm.byPeriod",
          userId: ctx.session.userId,
          role: ctx.session.role,
          reportId: input.reportId,
          requestedAuthorId: input.authorId ?? null,
          error: describeError(error),
        });
        throw mapDomainError(error);
      }
    });
}

function statusOverviewProcedure(deps: LeadFormRouterDeps) {
  return protectedProcedure
    .input(leadStatusOverviewInputSchema)
    .output(leadStatusOverviewOutputSchema)
    .query(async ({ input, ctx }) => {
      try {
        return await deps.leadFormService.getStatusOverview(
          input.reportId,
          ctx.session.userId,
          ctx.session.role,
          input.authorId,
        );
      } catch (error) {
        throw mapDomainError(error);
      }
    });
}

function fillFromProcedure(deps: LeadFormRouterDeps) {
  return protectedProcedure
    .input(
      z.object({
        targetSectionId: z.uuid(),
        sourceSectionId: z.uuid(),
        // Optimistic-concurrency expected version of the TARGET section.
        version: z.number().int().min(1),
      }),
    )
    .use(captureMutationAuditInputMiddleware)
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
    });
}

// Object-level authz — a head may only revoke a section authored in its own
// group (admin scope is {}). Mirrors the respondReopenRequest scoped re-load.
function revokeProcedure(deps: LeadFormRouterDeps) {
  return headProcedure
    .input(z.object({ reportSectionId: z.uuid() }))
    .use(captureMutationAuditInputMiddleware)
    .mutation(async ({ input, ctx }) => {
      try {
        return await deps.leadFormService.revokeSubmission(
          input.reportSectionId,
          ctx.session.userId,
          groupScopeFilter(ctx.session, "reportSection"),
        );
      } catch (error) {
        throw mapDomainError(error);
      }
    });
}

// Bulk revoke is bounded to the head's own group inside a multi-group report
// (admin scope is {} → global).
function revokeAllSubmittedProcedure(deps: LeadFormRouterDeps) {
  return headProcedure
    .input(reportIdInput)
    .use(captureMutationAuditInputMiddleware)
    .mutation(async ({ input, ctx }) => {
      try {
        return await deps.leadFormService.revokeAllSubmitted(
          input.reportId,
          ctx.session.userId,
          groupScopeFilter(ctx.session, "reportSection"),
        );
      } catch (error) {
        throw mapDomainError(error);
      }
    });
}

function requestReopenProcedure(deps: LeadFormRouterDeps) {
  return protectedProcedure
    .input(
      z.object({
        reportSectionId: z.uuid(),
        reason: z.string().max(MAX_REOPEN_REASON_LENGTH).optional(),
      }),
    )
    .use(captureMutationAuditInputMiddleware)
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
    });
}

function crossAuthorsProcedure(deps: LeadFormRouterDeps) {
  return protectedProcedure
    .input(reportIdInput)
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
    });
}

// The lead form's "Everyone" visibility lens. Full foreign content, gated by
// report access AND product co-ownership for ALL callers (no head/admin
// bypass); the role is intentionally NOT passed.
function crossAuthorContentProcedure(deps: LeadFormRouterDeps) {
  return protectedProcedure
    .input(reportIdInput)
    .query(async ({ input, ctx }) => {
      try {
        return await deps.leadFormService.getCrossAuthorContent(
          input.reportId,
          ctx.session.userId,
        );
      } catch (error) {
        throw mapDomainError(error);
      }
    });
}

function assistantProcedure(deps: LeadFormRouterDeps) {
  return leadProcedure
    .input(reportAssistantRequestSchema)
    .use(captureMutationAuditInputMiddleware)
    .output(reportAssistantOutcomeSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await deps.reportAssistantService.answer(
          input,
          ctx.session.userId,
        );
      } catch (error) {
        throw mapDomainError(error);
      }
    });
}

export function createLeadFormRouter(deps: LeadFormRouterDeps) {
  return router({
    assistant: assistantProcedure(deps),
    viewSettings: viewSettingsProcedure(deps),
    byPeriod: byPeriodProcedure(deps),
    statusOverview: statusOverviewProcedure(deps),
    fillFrom: fillFromProcedure(deps),
    revoke: revokeProcedure(deps),
    revokeAllSubmitted: revokeAllSubmittedProcedure(deps),
    requestReopen: requestReopenProcedure(deps),
    crossAuthors: crossAuthorsProcedure(deps),
    crossAuthorContent: crossAuthorContentProcedure(deps),
  });
}
