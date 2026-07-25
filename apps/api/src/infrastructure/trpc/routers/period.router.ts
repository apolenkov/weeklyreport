import { z } from "zod";

import type { PeriodService } from "../../../modules/period/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { headProcedure, router } from "../trpc.middleware.js";

export interface PeriodRouterDeps {
  periodService: PeriodService;
}

/**
 * Create Period Router.
 * @param deps - The deps argument.
 */
export function createPeriodRouter(deps: PeriodRouterDeps) {
  return router({
    publish: headProcedure
      .input(z.object({ reportId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await deps.periodService.publishPeriod(
            input.reportId,
            ctx.session,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    reopen: headProcedure
      .input(z.object({ reportId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await deps.periodService.reopenPeriod(
            input.reportId,
            ctx.session,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  });
}
