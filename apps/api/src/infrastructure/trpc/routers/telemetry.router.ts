import type { TelemetryService } from "../../../modules/telemetry/telemetry.service.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { leadershipProcedure, router } from "../trpc.middleware.js";

export interface TelemetryRouterDeps {
  /**
   * Product-telemetry surface — `telemetry.summary`
   * returns the leadership-readable KPI bundle (reports submitted, on-time
   * ratio, active leads, late sections, pending reopens, PDF export
   * volume, 4-week sparkline). Optional so role-coverage test fixtures
   * that build the router with `{}` deps stay green; when undefined the
   * procedure is hidden from the surface, not 500-ed.
   */
  telemetryService?: TelemetryService;
}

// Product-KPI surface for the in-app dashboard card. Authorised by
// `leadershipProcedure` (head + admin + viewer); lead role is denied
// because lead is the data subject of these KPIs, not a consumer.
// Cached for 60s in Redis (see TelemetryCache); a Redis outage
// degrades to direct queries.

export function createTelemetryRouter(deps: TelemetryRouterDeps) {
  return router({
    summary: leadershipProcedure.query(async ({ ctx }) => {
      try {
        if (!deps.telemetryService) {
          // Test-fixture mode (createAppRouter({}) for role-coverage
          // harnesses). Return a zero-shape payload that still parses
          // the shared schema so the role-coverage harness can hit
          // the surface without a 500.
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
