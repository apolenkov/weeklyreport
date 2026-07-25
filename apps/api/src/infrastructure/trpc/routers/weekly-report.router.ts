import { z } from "zod";

import type { AppLogger } from "../../../lib/logger.js";
import type { WeeklyReportService } from "../../../modules/weekly-report/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { anyRoleProcedure, router } from "../trpc.middleware.js";

const WEEKLY_REPORT_LOAD_LOG_PHASE = "weekly-report.load";
const WEEKLY_REPORT_GET_PROCEDURE = "weeklyReport.get";
// Domain failures are expected outcomes of a valid request (warn); anything
// else is a defect and must surface at error level.
const WEEKLY_REPORT_DOMAIN_ERROR_NAME = "WeeklyReportDomainError";

export interface WeeklyReportRouterDeps {
  weeklyReportService: WeeklyReportService;
}

// The request identity every weeklyReport.get log line is keyed by.
interface WeeklyReportLoadScope {
  readonly userId: string;
  readonly role: string;
  readonly requestedReportId: string | null;
}

function loadLogFields(scope: WeeklyReportLoadScope): Record<string, unknown> {
  return {
    phase: WEEKLY_REPORT_LOAD_LOG_PHASE,
    procedure: WEEKLY_REPORT_GET_PROCEDURE,
    userId: scope.userId,
    role: scope.role,
    requestedReportId: scope.requestedReportId,
  };
}

function logWeeklyReportFailure(
  logger: AppLogger,
  scope: WeeklyReportLoadScope,
  error: unknown,
): void {
  const errorInfo =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: typeof error, message: String(error) };
  const logFailure =
    errorInfo.name === WEEKLY_REPORT_DOMAIN_ERROR_NAME
      ? logger.warn.bind(logger)
      : logger.error.bind(logger);
  logFailure("weekly report load failed", {
    ...loadLogFields(scope),
    error: errorInfo,
  });
}

// Emit scopeAccessed once when a non-admin read surfaces cross-group products.
function shouldEmitScopeAudit<T extends { productIds: readonly string[] }>(
  crossGroup: T | null,
  role: string,
): crossGroup is T {
  return (
    crossGroup !== null && role !== "admin" && crossGroup.productIds.length > 0
  );
}

// weeklyReport.get uses anyRoleProcedure because
// viewers, leads, heads, and admins all consume this surface. The
// service layer scopes the read to published periods for viewers.

/**
 * Create Weekly Report Router.
 * @param deps - The deps argument.
 */
export function createWeeklyReportRouter(deps: WeeklyReportRouterDeps) {
  return router({
    get: anyRoleProcedure
      .input(z.object({ reportId: z.uuid().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const scope: WeeklyReportLoadScope = {
          userId: ctx.session.userId,
          role: ctx.session.role,
          requestedReportId: input?.reportId ?? null,
        };
        try {
          const result = await deps.weeklyReportService.getWeeklyReport(
            input?.reportId,
            ctx.session.role,
            ctx.session,
          );
          // No-period is a normal 200 response, not an error path.
          if (result.status === "no-period") {
            ctx.logger.info(
              "weekly report: no active period",
              loadLogFields(scope),
            );
            // crossGroup is an internal audit signal — strip before sending.
            const { crossGroup: _crossGroup, ...publicResult } = result;
            return publicResult;
          }
          // crossGroup is internal — strip before return.
          const { crossGroup, ...publicResult } = result;
          if (shouldEmitScopeAudit(crossGroup, ctx.session.role)) {
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
            ...loadLogFields(scope),
            resolvedReportId: result.reportId,
            periodStatus: result.periodStatus,
            submissionCount: result.submissionCount,
            totalLeads: result.totalLeads,
          });
          return publicResult;
        } catch (error) {
          logWeeklyReportFailure(ctx.logger, scope, error);
          throw mapDomainError(error);
        }
      }),
  });
}
