import { z } from "zod";

import type { PeriodService } from "../../../modules/period/index.js";
import { withDomainErrorMapping } from "../trpc.error-mapper.js";
import {
  captureMutationAuditInputMiddleware,
  headProcedure,
  router,
} from "../trpc.middleware.js";

export interface PeriodRouterDeps {
  periodService: PeriodService;
}

export function createPeriodRouter(deps: PeriodRouterDeps) {
  return router({
    publish: headProcedure
      .input(z.object({ reportId: z.uuid() }))
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.periodService.publishPeriod(input.reportId, ctx.session),
        ),
      ),

    reopen: headProcedure
      .input(z.object({ reportId: z.uuid() }))
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.periodService.reopenPeriod(input.reportId, ctx.session),
        ),
      ),
  });
}
