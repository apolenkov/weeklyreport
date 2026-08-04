import {
  leadVelocityInputSchema,
  periodComparisonInputSchema,
  trafficLightHistoryInputSchema,
} from "@customreport/shared";

import type { AnalyticsService } from "../../../modules/analytics/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
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
      .query(async ({ input, ctx }) => {
        try {
          return await deps.analyticsService.trafficLightHistory(
            input,
            ctx.session,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    leadVelocity: anyRoleProcedure
      .input(leadVelocityInputSchema)
      .query(async ({ input, ctx }) => {
        try {
          return await deps.analyticsService.leadVelocity(input, ctx.session);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    periodComparison: anyRoleProcedure
      .input(periodComparisonInputSchema)
      .query(async ({ input, ctx }) => {
        try {
          return await deps.analyticsService.periodComparison(
            input,
            ctx.session,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  });
}
