import type { TelemetryService } from "../../../modules/telemetry/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { leadershipProcedure, router } from "../trpc.middleware.js";

export interface TelemetryRouterDeps {
  // Required: a missing service must fail loud (resolver throws), never
  // fabricate a valid-looking zero payload. createAppRouter always wires it.
  telemetryService: TelemetryService;
}

// Lead is the KPI data subject, not a consumer — leadershipProcedure only.
// Redis cache (TelemetryCache) degrades to direct queries on outage.

export function createTelemetryRouter(deps: TelemetryRouterDeps) {
  return router({
    summary: leadershipProcedure.query(async ({ ctx }) => {
      try {
        return await deps.telemetryService.getSummary(ctx.session);
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
  });
}
