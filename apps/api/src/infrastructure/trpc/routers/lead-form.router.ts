import { TRPCError } from "@trpc/server";
import {
  itemOutcomeResultSchema,
  leadOpenWorkHistoryInputSchema,
  leadOpenWorkHistoryOutputSchema,
  leadStatusOverviewInputSchema,
  leadStatusOverviewOutputSchema,
  MAX_REOPEN_REASON_LENGTH,
  promotePlanInputSchema,
  reportAssistantOutcomeSchema,
  reportAssistantRequestSchema,
  resolvePlanInputSchema,
  restorePlanInputSchema,
  type Role,
} from "@weeklyreport/shared";
import { assertRole } from "@weeklyreport/shared/trpc";
import { z } from "zod";

import { groupScopeFilter } from "../../../lib/group-scope.js";
import type { SnapshotAdminService } from "../../../modules/admin/index.js";
import {
  LeadFormAccessError,
  LeadFormDomainError,
  type LeadFormService,
} from "../../../modules/report-sections/index.js";
import type { ReportAssistantService } from "../../../modules/search/index.js";
import {
  mapDomainError,
  withDomainErrorMapping,
} from "../trpc.error-mapper.js";
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
  return protectedProcedure.query(() =>
    withDomainErrorMapping(async () => {
      const settings = await deps.snapshotAdminService.getSettings();
      return { unifiedActivityView: settings.unifiedActivityView };
    }),
  );
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
        // Expected refusals log at warn: a missing target (LeadFormDomainError,
        // NOT_FOUND) and a foreign-author scope denial (LeadFormAccessError,
        // FORBIDDEN). Anything else is an operational fault (error).
        const isExpectedRefusal =
          error instanceof LeadFormDomainError ||
          error instanceof LeadFormAccessError;
        const logFailure = isExpectedRefusal
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
    .query(({ input, ctx }) =>
      withDomainErrorMapping(() =>
        deps.leadFormService.getStatusOverview(
          input.reportId,
          ctx.session.userId,
          ctx.session.role,
          input.authorId,
        ),
      ),
    );
}

function openWorkProcedure(deps: LeadFormRouterDeps) {
  return leadProcedure
    .input(leadOpenWorkHistoryInputSchema)
    .output(leadOpenWorkHistoryOutputSchema)
    .query(({ input, ctx }) =>
      withDomainErrorMapping(() =>
        deps.leadFormService.getOpenWork(input, ctx.session.userId),
      ),
    );
}

function resolvePlanProcedure(deps: LeadFormRouterDeps) {
  return leadProcedure
    .input(resolvePlanInputSchema)
    .output(itemOutcomeResultSchema)
    .use(captureMutationAuditInputMiddleware)
    .mutation(({ input, ctx }) =>
      withDomainErrorMapping(() =>
        deps.leadFormService.resolvePlan(input, ctx.session.userId),
      ),
    );
}

function restorePlanProcedure(deps: LeadFormRouterDeps) {
  return leadProcedure
    .input(restorePlanInputSchema)
    .output(itemOutcomeResultSchema)
    .use(captureMutationAuditInputMiddleware)
    .mutation(({ input, ctx }) =>
      withDomainErrorMapping(() =>
        deps.leadFormService.restorePlan(input, ctx.session.userId),
      ),
    );
}

function promotePlanProcedure(deps: LeadFormRouterDeps) {
  return leadProcedure
    .input(promotePlanInputSchema)
    .output(itemOutcomeResultSchema)
    .use(captureMutationAuditInputMiddleware)
    .mutation(({ input, ctx }) =>
      withDomainErrorMapping(() =>
        deps.leadFormService.promotePlan(input, ctx.session.userId),
      ),
    );
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
    .mutation(({ input, ctx }) =>
      withDomainErrorMapping(() => {
        const allowed = ["lead", "head", "admin"] satisfies Role[];
        try {
          assertRole(ctx.session, allowed);
        } catch (error) {
          if (error instanceof TRPCError && error.code === "FORBIDDEN") {
            ctx.auditLogger.roleDenied({
              userId: ctx.session.userId,
              role: ctx.session.role,
              attemptedRole: allowed,
              ip: ctx.ip,
            });
          }
          throw error;
        }
        return deps.leadFormService.fillFrom(
          input.targetSectionId,
          input.sourceSectionId,
          ctx.session.userId,
          input.version,
        );
      }),
    );
}

// Object-level authz — a head may only revoke a section authored in its own
// group (admin scope is {}). Mirrors the respondReopenRequest scoped re-load.
function revokeProcedure(deps: LeadFormRouterDeps) {
  return headProcedure
    .input(z.object({ reportSectionId: z.uuid() }))
    .use(captureMutationAuditInputMiddleware)
    .mutation(({ input, ctx }) =>
      withDomainErrorMapping(() =>
        deps.leadFormService.revokeSubmission(
          input.reportSectionId,
          ctx.session.userId,
          groupScopeFilter(ctx.session, "reportSection"),
        ),
      ),
    );
}

// Bulk revoke is bounded to the head's own group inside a multi-group report
// (admin scope is {} → global).
function revokeAllSubmittedProcedure(deps: LeadFormRouterDeps) {
  return headProcedure
    .input(reportIdInput)
    .use(captureMutationAuditInputMiddleware)
    .mutation(({ input, ctx }) =>
      withDomainErrorMapping(() =>
        deps.leadFormService.revokeAllSubmitted(
          input.reportId,
          ctx.session.userId,
          groupScopeFilter(ctx.session, "reportSection"),
        ),
      ),
    );
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
    .mutation(({ input, ctx }) =>
      withDomainErrorMapping(() =>
        deps.leadFormService.requestReopen(
          input.reportSectionId,
          ctx.session.userId,
          input.reason,
        ),
      ),
    );
}

function crossAuthorsProcedure(deps: LeadFormRouterDeps) {
  return protectedProcedure
    .input(reportIdInput)
    .query(({ input, ctx }) =>
      withDomainErrorMapping(() =>
        deps.leadFormService.getCrossAuthors(
          input.reportId,
          ctx.session.userId,
          ctx.session.role,
        ),
      ),
    );
}

// The lead form's "Everyone" visibility lens. Full foreign content, gated by
// report access AND product co-ownership for ALL callers (no head/admin
// bypass); the role is intentionally NOT passed.
function crossAuthorContentProcedure(deps: LeadFormRouterDeps) {
  return protectedProcedure
    .input(reportIdInput)
    .query(({ input, ctx }) =>
      withDomainErrorMapping(() =>
        deps.leadFormService.getCrossAuthorContent(
          input.reportId,
          ctx.session.userId,
        ),
      ),
    );
}

function assistantProcedure(deps: LeadFormRouterDeps) {
  return leadProcedure
    .input(reportAssistantRequestSchema)
    .use(captureMutationAuditInputMiddleware)
    .output(reportAssistantOutcomeSchema)
    .mutation(({ input, ctx }) =>
      withDomainErrorMapping(() =>
        deps.reportAssistantService.answer(input, ctx.session.userId),
      ),
    );
}

export function createLeadFormRouter(deps: LeadFormRouterDeps) {
  return router({
    assistant: assistantProcedure(deps),
    viewSettings: viewSettingsProcedure(deps),
    byPeriod: byPeriodProcedure(deps),
    statusOverview: statusOverviewProcedure(deps),
    openWork: openWorkProcedure(deps),
    resolvePlan: resolvePlanProcedure(deps),
    restorePlan: restorePlanProcedure(deps),
    promotePlan: promotePlanProcedure(deps),
    fillFrom: fillFromProcedure(deps),
    revoke: revokeProcedure(deps),
    revokeAllSubmitted: revokeAllSubmittedProcedure(deps),
    requestReopen: requestReopenProcedure(deps),
    crossAuthors: crossAuthorsProcedure(deps),
    crossAuthorContent: crossAuthorContentProcedure(deps),
  });
}
