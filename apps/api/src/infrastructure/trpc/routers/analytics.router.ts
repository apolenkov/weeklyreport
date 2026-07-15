import {
  leadVelocityInputSchema,
  periodComparisonInputSchema,
  trafficLightHistoryInputSchema,
} from "@customreport/shared";

import type { AnalyticsService } from "../../../modules/analytics/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { anyRoleProcedure, router } from "../trpc.middleware.js";

export interface AnalyticsRouterDeps {
  /**
   * Analytics surface — traffic light history,
   * lead velocity, period comparison. Cached via Redis with prefix-wide
   * invalidation on PeriodService.publishPeriod / reopenPeriod.
   */
  analyticsService: AnalyticsService;
}

// These procedures use anyRoleProcedure because heads, leads, admins, and
// viewers all consume trend data. The repository layer enforces the
// published-only floor (PUBLISHED_FLOOR mirrors archive.prisma-repository
// pattern), so viewer sessions only ever see published-period rows.

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
