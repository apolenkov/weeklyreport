import {
  type ActivityLiveResponse,
  activityLiveResponseSchema,
  type UserSession,
} from "@customreport/shared";

export interface ActivityRepository {
  // Synthetic draft row when a lead has no section yet.
  readonly getLiveActivity: (
    reportId: string | null,
    session: UserSession,
  ) => Promise<ActivityLiveResponse>;
}

export type LeadershipReportResolver = () => Promise<string | null>;

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
