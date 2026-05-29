import {
  type SubmissionDashboardRow,
  submissionDashboardRowSchema,
  type UserSession,
} from "@customreport/shared";
import { createAppLogger } from "../../lib/logger.js";

export class ReviewAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewAccessError";
  }
}

/**
 * UFB-040 / Phase 46-02: dashboard reads honour group-scope visibility.
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
  private readonly logger = createAppLogger({
    service: "ReviewService",
    logDir: process.env["LOG_DIR"],
    minLevel:
      (process.env["LOG_LEVEL"] as "debug" | "info" | "warn" | "error") ??
      "info",
  });

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
