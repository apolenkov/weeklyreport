import { z } from "zod";

import type { WeeklyReportService } from "../../../modules/weekly-report/weekly-report.service.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { anyRoleProcedure, router } from "../trpc.middleware.js";

const WEEKLY_REPORT_LOAD_LOG_PHASE = "weekly-report.load";
const WEEKLY_REPORT_GET_PROCEDURE = "weeklyReport.get";

export interface WeeklyReportRouterDeps {
  weeklyReportService: WeeklyReportService;
}

// weeklyReport.get uses anyRoleProcedure because
// viewers, leads, heads, and admins all consume this surface. The
// service layer scopes the read to published periods for viewers.

export function createWeeklyReportRouter(deps: WeeklyReportRouterDeps) {
  return router({
    get: anyRoleProcedure
      .input(z.object({ reportId: z.uuid().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const requestedReportId = input?.reportId ?? null;
        try {
          const result = await deps.weeklyReportService.getWeeklyReport(
            input?.reportId,
            ctx.session.role,
            ctx.session,
          );
          // No-period is a normal 200 response, not an error path.
          if (result.status === "no-period") {
            ctx.logger.info("weekly report: no active period", {
              phase: WEEKLY_REPORT_LOAD_LOG_PHASE,
              procedure: WEEKLY_REPORT_GET_PROCEDURE,
              userId: ctx.session.userId,
              role: ctx.session.role,
              requestedReportId,
            });
            // crossGroup is an internal audit signal — strip before sending.
            const { crossGroup: _crossGroup, ...publicResult } = result;
            return publicResult;
          }
          // Emit scopeAccessed once when a non-admin read surfaces
          // cross-group products. crossGroup is internal — strip before return.
          const { crossGroup, ...publicResult } = result;
          if (
            crossGroup !== null &&
            ctx.session.role !== "admin" &&
            crossGroup.productIds.length > 0
          ) {
            ctx.auditLogger.scopeAccessed({
              userId: ctx.session.userId,
              role: ctx.session.role,
              ip: ctx.ip,
              accessedScope: "weeklyReport.project",
              productIds: crossGroup.productIds,
              groupIds: crossGroup.groupIds,
              resourceId: result.reportId,
            });
          }
          ctx.logger.info("weekly report load succeeded", {
            phase: WEEKLY_REPORT_LOAD_LOG_PHASE,
            procedure: WEEKLY_REPORT_GET_PROCEDURE,
            userId: ctx.session.userId,
            role: ctx.session.role,
            requestedReportId,
            resolvedReportId: result.reportId,
            periodStatus: result.periodStatus,
            submissionCount: result.submissionCount,
            totalLeads: result.totalLeads,
          });
          return publicResult;
        } catch (error) {
          const errorInfo =
            error instanceof Error
              ? { name: error.name, message: error.message }
              : { name: typeof error, message: String(error) };
          const logFailure =
            errorInfo.name === "WeeklyReportDomainError"
              ? ctx.logger.warn.bind(ctx.logger)
              : ctx.logger.error.bind(ctx.logger);
          logFailure("weekly report load failed", {
            phase: WEEKLY_REPORT_LOAD_LOG_PHASE,
            procedure: WEEKLY_REPORT_GET_PROCEDURE,
            userId: ctx.session.userId,
            role: ctx.session.role,
            requestedReportId,
            error: errorInfo,
          });
          throw mapDomainError(error);
        }
      }),
  });
}
