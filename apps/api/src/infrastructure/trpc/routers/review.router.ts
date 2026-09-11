import {
  reviewAcknowledgeInputSchema,
  reviewCommentInputSchema,
  reviewDeleteCommentInputSchema,
  reviewListAcknowledgementsInputSchema,
  reviewVerdictInputSchema,
} from "@customreport/shared";
import { TRPCError } from "@trpc/server";

import type { PublicationService } from "../../../modules/publication/index.js";
import type { ReviewService } from "../../../modules/review/index.js";
import type { ReviewActionsService } from "../../../modules/review/index.js";
import type { WeeklyReportService } from "../../../modules/weekly-report/index.js";
import { withDomainErrorMapping } from "../trpc.error-mapper.js";
import {
  captureMutationAuditInputMiddleware,
  headProcedure,
  leadershipProcedure,
  router,
} from "../trpc.middleware.js";

export interface ReviewRouterDeps {
  weeklyReportService: WeeklyReportService;
  reviewService: ReviewService;
  publicationService: PublicationService;
  // Required: missing wiring must fail loud, never surface empty success.
  // Per-group scope + reviewer designation are enforced inside the service.
  reviewActionsService: ReviewActionsService;
}

// All on `leadershipProcedure` (head + admin + viewer; lead excluded) so
// `role-coverage-gate` stays green; the per-group scope + reviewer
// designation are enforced in the service.
function createReviewActionProcedures(deps: ReviewRouterDeps) {
  return {
    // Group-level "seen" receipt — any access-holder (scope check only).
    acknowledge: leadershipProcedure
      .input(reviewAcknowledgeInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.reviewActionsService.acknowledge(ctx.session, input),
        ),
      ),

    // Who has acknowledged the group's report this period (head surface).
    acknowledgements: leadershipProcedure
      .input(reviewListAcknowledgementsInputSchema)
      .query(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.reviewActionsService.listAcknowledgements(ctx.session, input),
        ),
      ),

    // Per-record comment — designated reviewer for the record's group.
    comment: leadershipProcedure
      .input(reviewCommentInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.reviewActionsService.comment(ctx.session, input),
        ),
      ),

    deleteComment: leadershipProcedure
      .input(reviewDeleteCommentInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.reviewActionsService.deleteComment(ctx.session, input),
        ),
      ),

    // Per-section verdict; `changes_requested` auto-un-submits, race-safe.
    verdict: leadershipProcedure
      .input(reviewVerdictInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.reviewActionsService.verdict(ctx.session, input),
        ),
      ),
  };
}

export function createReviewRouter(deps: ReviewRouterDeps) {
  return router({
    // review.dashboard is headProcedure — defense-in-depth: only heads (and
    // admins, aliased) see the submission dashboard.
    dashboard: headProcedure.query(({ ctx }) =>
      withDomainErrorMapping(async () => {
        // Resolve from the DB, not ctx.session.activeReportId (baked into the
        // JWT at login, can be stale). assembledReport uses this same current
        // editable-period resolver.
        const reportId = await deps.weeklyReportService.getCurrentEditableId(
          ctx.session,
        );

        if (!reportId) {
          return [];
        }

        return deps.reviewService.getSubmissionDashboard(reportId, ctx.session);
      }),
    ),

    assembledReport: headProcedure.query(({ ctx }) =>
      withDomainErrorMapping(async () => {
        const reportId = await deps.weeklyReportService.getCurrentEditableId(
          ctx.session,
        );

        if (!reportId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No active period.",
          });
        }

        return deps.publicationService.getAssembledReport(reportId);
      }),
    ),

    ...createReviewActionProcedures(deps),
  });
}
