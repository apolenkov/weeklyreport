import type { TelemetryService } from "../../../modules/telemetry/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { leadershipProcedure, router } from "../trpc.middleware.js";

export interface TelemetryRouterDeps {
  // Optional for role-coverage fixtures; an absent service returns a
  // schema-valid zero payload so the harness can traverse the procedure.
  telemetryService?: TelemetryService;
}

// Lead is the KPI data subject, not a consumer — leadershipProcedure only.
// Redis cache (TelemetryCache) degrades to direct queries on outage.

export function createTelemetryRouter(deps: TelemetryRouterDeps) {
  return router({
    summary: leadershipProcedure.query(async ({ ctx }) => {
      try {
        if (!deps.telemetryService) {
          // Test-fixture mode (createAppRouter({})): a zero-shape payload that
          // still parses the shared schema, so the role-coverage harness can
          // reach the surface without a 500.
          return {
            reportsThisPeriod: 0,
            onTimeRatio: null,
            activeLeads: 0,
            lateSections: 0,
            pendingReopens: 0,
            pdfExportsLast7d: 0,
            sparkline: [] as number[],
          };
        }
        return await deps.telemetryService.getSummary(ctx.session);
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
  });
}
