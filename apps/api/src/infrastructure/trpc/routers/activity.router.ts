import type { ActivityService } from "../../../modules/activity/index.js";
import { withDomainErrorMapping } from "../trpc.error-mapper.js";
import { headProcedure, router } from "../trpc.middleware.js";

export interface ActivityRouterDeps {
  readonly activityService: ActivityService;
}

export function createActivityRouter(deps: ActivityRouterDeps) {
  return router({
    live: headProcedure.query(({ ctx }) =>
      withDomainErrorMapping(() =>
        deps.activityService.getLiveActivity(ctx.session),
      ),
    ),
  });
}
