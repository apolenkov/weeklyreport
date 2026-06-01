import {
  type SubmissionDashboardRow,
  submissionDashboardRowSchema,
  type UserSession,
} from "@customreport/shared";

import { createRoleGuard } from "../auth/roles.guard";
import { ReviewAccessError, type ReviewService } from "./review.service";

export interface ReviewRouterContext {
  reviewService: ReviewService;
  session: UserSession;
}

const headRoleGuard = createRoleGuard("head");

function assertHeadAccess(session: UserSession): void {
  if (!headRoleGuard.canActivate({ user: { role: session.role } })) {
    throw new ReviewAccessError(
      "Head dashboard is available only to head users.",
    );
  }

  if (!session.activeReportId) {
    throw new ReviewAccessError("Head dashboard requires an active report.");
  }
}

export const reviewRouter = {
  async getSubmissionDashboard(
    ctx: ReviewRouterContext,
  ): Promise<SubmissionDashboardRow[]> {
    assertHeadAccess(ctx.session);
    const activeReportId = ctx.session.activeReportId;

    if (!activeReportId) {
      throw new ReviewAccessError("Head dashboard requires an active report.");
    }

    return submissionDashboardRowSchema
      .array()
      .parse(
        await ctx.reviewService.getSubmissionDashboard(
          activeReportId,
          ctx.session,
        ),
      );
  },
};
