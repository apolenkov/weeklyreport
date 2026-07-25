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

// Optional only for role-coverage fixtures with `{}` deps; undefined at
// runtime is a config bug, not a user-reachable state.
function requireReviewActions(deps: ReviewRouterDeps): ReviewActionsService {
  if (!deps.reviewActionsService) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Review actions service is not configured.",
    });
  }
  return deps.reviewActionsService;
}

// Every resolver body runs through here so domain errors reach the client as
// their tRPC equivalents; the service lookup happens inside the try too.
async function withMappedDomainErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw mapDomainError(error);
  }
}

export interface ReviewRouterDeps {
  weeklyReportService: WeeklyReportService;
  reviewService: ReviewService;
  publicationService: PublicationService;
  // Optional so role-coverage fixtures with `{}` deps compile; per-group
  // scope + reviewer designation are enforced inside the service.
  reviewActionsService?: ReviewActionsService;
}

// All on `leadershipProcedure` (head + admin + viewer; lead excluded) so
// `role-coverage-gate` stays green; the per-group scope + reviewer
// designation are enforced in the service.
function createReviewActionProcedures(deps: ReviewRouterDeps) {
  return {
    // Group-level "seen" receipt — any access-holder (scope check only).
    acknowledge: leadershipProcedure
      .input(reviewAcknowledgeInputSchema)
      .mutation(({ input, ctx }) =>
        withMappedDomainErrors(() =>
          requireReviewActions(deps).acknowledge(ctx.session, input),
        ),
      ),

    // Who has acknowledged the group's report this period (head surface).
    acknowledgements: leadershipProcedure
      .input(reviewListAcknowledgementsInputSchema)
      .query(({ input, ctx }) =>
        withMappedDomainErrors(() =>
          requireReviewActions(deps).listAcknowledgements(ctx.session, input),
        ),
      ),

    // Per-record comment — designated reviewer for the record's group.
    comment: leadershipProcedure
      .input(reviewCommentInputSchema)
      .mutation(({ input, ctx }) =>
        withMappedDomainErrors(() =>
          requireReviewActions(deps).comment(ctx.session, input),
        ),
      ),

    deleteComment: leadershipProcedure
      .input(reviewDeleteCommentInputSchema)
      .mutation(({ input, ctx }) =>
        withMappedDomainErrors(() =>
          requireReviewActions(deps).deleteComment(ctx.session, input),
        ),
      ),

    // Per-section verdict; `changes_requested` auto-un-submits, race-safe.
    verdict: leadershipProcedure
      .input(reviewVerdictInputSchema)
      .mutation(({ input, ctx }) =>
        withMappedDomainErrors(() =>
          requireReviewActions(deps).verdict(ctx.session, input),
        ),
      ),
  };
}

/**
 * Create Review Router.
 * @param deps - The deps argument.
 */
export function createReviewRouter(deps: ReviewRouterDeps) {
  return router({
    // review.dashboard is headProcedure — defense-in-depth: only heads (and
    // admins, aliased) see the submission dashboard.
    dashboard: headProcedure.query(({ ctx }) =>
      withMappedDomainErrors(async () => {
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

        return deps.reviewService.getSubmissionDashboard(reportId, ctx.session);
      }),
    ),

    assembledReport: headProcedure.query(() =>
      withMappedDomainErrors(async () => {
        const reportId = await deps.weeklyReportService.getCurrentEditableId();

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
