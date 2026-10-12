import {
  type SubmissionDashboardRow,
  submissionDashboardRowSchema,
  type UserSession,
} from "@weeklyreport/shared";

import { type AppLogger } from "../../../lib/logger.js";

export class ReviewAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewAccessError";
  }
}

// Targeted record / section / comment does not exist (or is out of reach —
// no existence oracle) → NOT_FOUND.
export class ReviewNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewNotFoundError";
  }
}

// State constraint (e.g. a verdict on a non-editable period) → BAD_REQUEST.
export class ReviewConstraintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewConstraintError";
  }
}

// Optimistic version lock lost to a concurrent lead re-submit: the judged
// version no longer matches → CONFLICT without writing; client reloads and re-decides.
export class ReviewVersionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewVersionConflictError";
  }
}

// Dashboard reads honour group-scope; repository spreads groupScopeFilter
// from this session into the Prisma where fragment.
export type DashboardScopeSession = Pick<
  UserSession,
  "role" | "reportingGroupId" | "viewerGroupAccess"
>;

export interface ReviewRepository {
  readonly getSubmissionDashboard: (
    activeReportId: string,
    session: DashboardScopeSession,
  ) => Promise<readonly SubmissionDashboardRow[]>;
}

// DI token binding the ReviewRepository port to its adapter at the module
// boundary — lets the service depend on the port, not the concrete prisma class.
export const REVIEW_REPOSITORY = Symbol("ReviewRepository");

const statusOrder: Record<SubmissionDashboardRow["status"], number> = {
  draft: 0,
  submitted: 1,
};

function sortRows(
  rows: readonly SubmissionDashboardRow[],
): readonly SubmissionDashboardRow[] {
  return [...rows].sort((left, right) => {
    const statusDiff = statusOrder[left.status] - statusOrder[right.status];

    if (statusDiff !== 0) {
      return statusDiff;
    }

    return left.leadName.localeCompare(right.leadName, "ru");
  });
}

export class ReviewService {
  constructor(
    private readonly repository: ReviewRepository,
    private readonly logger: AppLogger,
  ) {}

  async getSubmissionDashboard(
    activeReportId: string,
    session: DashboardScopeSession,
  ): Promise<SubmissionDashboardRow[]> {
    const rows = await this.repository.getSubmissionDashboard(
      activeReportId,
      session,
    );

    const result = submissionDashboardRowSchema.array().parse(sortRows(rows));
    this.logger.info("submission dashboard fetched", {
      activeReportId,
      count: result.length,
    });
    return result;
  }
}
