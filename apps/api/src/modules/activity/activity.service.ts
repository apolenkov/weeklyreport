import {
  activityLiveResponseSchema,
  type ActivityLiveResponse,
  type ActivityLiveRow,
} from '@customreport/shared';

export interface ActivityRepository {
  /**
   * Returns the current open report period along with one row per lead's
   * section in that period (or one row per `lead` user if their section
   * does not exist yet — UI shows "ещё не начал" in that case).
   */
  getLiveActivity(): Promise<ActivityLiveResponse>;
}

/**
 * UX-18 (Phase 35-08): activity service for the head/admin dashboard.
 *
 * Returns a live snapshot of every lead's section status in the currently
 * open period. The frontend polls this endpoint every 15s. Service layer
 * just delegates to the repository — Zod validation runs on the way out
 * so the contract is enforced at the boundary.
 */
export class ActivityService {
  constructor(private readonly repository: ActivityRepository) {}

  async getLiveActivity(): Promise<ActivityLiveResponse> {
    const raw = await this.repository.getLiveActivity();
    return activityLiveResponseSchema.parse(raw);
  }
}

export type { ActivityLiveRow };
