import {
  type SubmissionDashboardRow,
  submissionDashboardRowSchema,
  type UserSession,
} from "@customreport/shared";

import { createServiceLogger } from "../../../lib/logger-service.js";

export class ReviewAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewAccessError";
  }
}

// review-acknowledgement: a targeted record / section / comment does not exist
// (or is out of the caller's reach — no existence oracle) → NOT_FOUND.
export class ReviewNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewNotFoundError";
  }
}

// review-acknowledgement: a state constraint (e.g. a verdict on a non-editable
// period) → BAD_REQUEST.
export class ReviewConstraintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewConstraintError";
  }
}

// A verdict's optimistic version lock lost to a concurrent lead re-submit: the
// version the reviewer judged no longer matches the section's current version,
// so the verdict is rejected without writing a row → CONFLICT, letting the
// client reload the current version and re-decide.
export class ReviewVersionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewVersionConflictError";
  }
}

/**
 * Dashboard reads honour group-scope visibility.
 * The repository receives the requester's session so it can spread
 * `groupScopeFilter(session, 'reportSection')` into the Prisma where
 * fragment. Tests can pass a `Pick<UserSession, ...>` instead of a full
 * session shape.
 */
export type DashboardScopeSession = Pick<
  UserSession,
  "role" | "reportingGroupId" | "viewerGroupAccess"
>;

export interface ReviewRepository {
  getSubmissionDashboard(
    activeReportId: string,
    session: DashboardScopeSession,
  ): Promise<SubmissionDashboardRow[]>;
}

// DI token binding the ReviewRepository port to its adapter at the module
// boundary — lets the service depend on the port, not the concrete prisma class.
export const REVIEW_REPOSITORY = Symbol("ReviewRepository");

const statusOrder: Record<SubmissionDashboardRow["status"], number> = {
  draft: 0,
  submitted: 1,
};

function sortRows(rows: SubmissionDashboardRow[]): SubmissionDashboardRow[] {
  return [...rows].sort((left, right) => {
    const statusDiff = statusOrder[left.status] - statusOrder[right.status];

    if (statusDiff !== 0) {
      return statusDiff;
    }

    return left.leadName.localeCompare(right.leadName, "ru");
  });
}

export class ReviewService {
  private readonly logger = createServiceLogger("ReviewService");

  constructor(private readonly repository: ReviewRepository) {}

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
