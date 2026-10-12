import {
  leadVelocityInputSchema,
  periodComparisonInputSchema,
  trafficLightHistoryInputSchema,
} from "@weeklyreport/shared";

import type { AnalyticsService } from "../../../modules/analytics/index.js";
import { withDomainErrorMapping } from "../trpc.error-mapper.js";
import { anyRoleProcedure, router } from "../trpc.middleware.js";

export interface AnalyticsRouterDeps {
  readonly analyticsService: AnalyticsService;
}

// anyRoleProcedure: all roles consume trends; repository published-only floor
// keeps viewers on published-period rows.

export function createAnalyticsRouter(deps: AnalyticsRouterDeps) {
  return router({
    trafficLightHistory: anyRoleProcedure
      .input(trafficLightHistoryInputSchema)
      .query(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.analyticsService.trafficLightHistory(input, ctx.session),
        ),
      ),
    leadVelocity: anyRoleProcedure
      .input(leadVelocityInputSchema)
      .query(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.analyticsService.leadVelocity(input, ctx.session),
        ),
      ),
    periodComparison: anyRoleProcedure
      .input(periodComparisonInputSchema)
      .query(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.analyticsService.periodComparison(input, ctx.session),
        ),
      ),
  });
}
