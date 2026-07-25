import type { ActivityService } from "../../../modules/activity/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { headProcedure, router } from "../trpc.middleware.js";

export interface ActivityRouterDeps {
  activityService: ActivityService;
}

/**
 * Create Activity Router.
 * @param deps - The deps argument.
 */
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
