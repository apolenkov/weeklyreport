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
import { mapDomainError } from "../trpc.error-mapper.js";
import {
  headProcedure,
  leadershipProcedure,
  router,
} from "../trpc.middleware.js";

/**
 * review-acknowledgement: resolve the review-actions service or fail loudly.
 * Optional on `RouterDeps` only so role-coverage fixtures build with `{}` deps;
 * a real boot always wires it, so `undefined` here is a config bug, not a
 * user-reachable state.
 */
function requireReviewActions(deps: ReviewRouterDeps): ReviewActionsService {
  if (!deps.reviewActionsService) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Review actions service is not configured.",
    });
  }
  return deps.reviewActionsService;
}

export interface ReviewRouterDeps {
  weeklyReportService: WeeklyReportService;
  reviewService: ReviewService;
  publicationService: PublicationService;
  /**
   * review-acknowledgement: the review capability's write surface —
   * `review.acknowledge` / `review.comment` / `review.deleteComment` /
   * `review.verdict` / `review.acknowledgements`. All ride `leadershipProcedure`
   * (head + admin + viewer; lead excluded); the per-group scope + reviewer
   * designation are enforced inside the service. Optional so role-coverage test
   * fixtures that build the router with `{}` deps keep compiling.
   */
  reviewActionsService?: ReviewActionsService;
}

export function createReviewRouter(deps: ReviewRouterDeps) {
  return router({
    // review.dashboard is headProcedure — defense-in-depth: only heads (and
    // admins, aliased) see the submission dashboard.
    dashboard: headProcedure.query(async ({ ctx }) => {
      try {
        // Resolve the current editable period from the DB through the shared
        // current-editable resolver (newest non-archived open/reopened period,
        // periodStart <= now, ordered periodStart desc then id desc) instead
        // of ctx.session.activeReportId (baked into the JWT at login, can be
        // stale). assembledReport and publish resolve through the same method,
        // so all three agree on the target period; the archived:false filter
        // and id-desc tiebreak keep the pick non-arbitrary.
        const reportId = await deps.weeklyReportService.getCurrentEditableId();

        if (!reportId) {
          return [];
        }

        return await deps.reviewService.getSubmissionDashboard(
          reportId,
          ctx.session,
        );
      } catch (error) {
        throw mapDomainError(error);
      }
    }),

    assembledReport: headProcedure.query(async () => {
      try {
        const reportId = await deps.weeklyReportService.getCurrentEditableId();

        if (!reportId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No active period.",
          });
        }

        return await deps.publicationService.getAssembledReport(reportId);
      } catch (error) {
        throw mapDomainError(error);
      }
    }),

    // review-acknowledgement: all on `leadershipProcedure` (head + admin +
    // viewer; lead excluded) so `role-coverage-gate` stays green; the
    // per-group scope + reviewer designation are enforced in the service.

    // Group-level "seen" receipt — any access-holder (scope check only).
    acknowledge: leadershipProcedure
      .input(reviewAcknowledgeInputSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          return await requireReviewActions(deps).acknowledge(
            ctx.session,
            input,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    // Who has acknowledged the group's report this period (head surface).
    acknowledgements: leadershipProcedure
      .input(reviewListAcknowledgementsInputSchema)
      .query(async ({ input, ctx }) => {
        try {
          return await requireReviewActions(deps).listAcknowledgements(
            ctx.session,
            input,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    // Per-record comment — designated reviewer for the record's group.
    comment: leadershipProcedure
      .input(reviewCommentInputSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          return await requireReviewActions(deps).comment(ctx.session, input);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    deleteComment: leadershipProcedure
      .input(reviewDeleteCommentInputSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          return await requireReviewActions(deps).deleteComment(
            ctx.session,
            input,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    // Per-section verdict; `changes_requested` auto-un-submits, race-safe.
    verdict: leadershipProcedure
      .input(reviewVerdictInputSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          return await requireReviewActions(deps).verdict(ctx.session, input);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  });
}
