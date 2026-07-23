import type { ActivityService } from "../../../modules/activity/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { headProcedure, router } from "../trpc.middleware.js";

export interface ActivityRouterDeps {
  /**
   * Live activity feed for the head/admin dashboard
   * "Активность за текущий период" panel. One row per lead's section in
   * the open period, with section-level counts + last-edit timestamp.
   * Polled every 15s by the dashboard.
   */
  activityService: ActivityService;
}

export function createActivityRouter(deps: ActivityRouterDeps) {
  return router({
    live: headProcedure.query(async ({ ctx }) => {
      try {
        return await deps.activityService.getLiveActivity(ctx.session);
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
  });
}
