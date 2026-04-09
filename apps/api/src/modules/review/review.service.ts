import {
  submissionDashboardRowSchema,
  type SubmissionDashboardRow,
} from '@customreport/shared';

export class ReviewAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReviewAccessError';
  }
}

export interface ReviewRepository {
  getSubmissionDashboard(activeReportId: string): Promise<SubmissionDashboardRow[]>;
}

const statusOrder: Record<SubmissionDashboardRow['status'], number> = {
  draft: 0,
  submitted: 1,
};

function sortRows(rows: SubmissionDashboardRow[]): SubmissionDashboardRow[] {
  return [...rows].sort((left, right) => {
    const statusDiff = statusOrder[left.status] - statusOrder[right.status];

    if (statusDiff !== 0) {
      return statusDiff;
    }

    return left.leadName.localeCompare(right.leadName, 'ru');
  });
}

export class ReviewService {
  constructor(private readonly repository: ReviewRepository) {}

  async getSubmissionDashboard(activeReportId: string): Promise<SubmissionDashboardRow[]> {
    const rows = await this.repository.getSubmissionDashboard(activeReportId);

    return submissionDashboardRowSchema.array().parse(sortRows(rows));
  }
}
