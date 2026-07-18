import {
  type ActivityLiveResponse,
  activityLiveResponseSchema,
  type UserSession,
} from "@customreport/shared";

export interface ActivityRepository {
  /**
   * Returns one row per scoped lead for the resolved leadership report,
   * including a synthetic draft row when the lead has no section.
   */
  getLiveActivity(
    reportId: string | null,
    session: UserSession,
  ): Promise<ActivityLiveResponse>;
}

export type LeadershipReportResolver = () => Promise<string | null>;

/**
 * Activity service for the head/admin dashboard.
 *
 * Returns a live snapshot of every lead's section status in the report that
 * leadership currently sees. The frontend polls this endpoint every 15s.
 */
export class ActivityService {
  constructor(
    private readonly repository: ActivityRepository,
    private readonly resolveReportId: LeadershipReportResolver,
  ) {}

  async getLiveActivity(session: UserSession): Promise<ActivityLiveResponse> {
    const reportId = await this.resolveReportId();
    const raw = await this.repository.getLiveActivity(reportId, session);
    return activityLiveResponseSchema.parse(raw);
  }
}
