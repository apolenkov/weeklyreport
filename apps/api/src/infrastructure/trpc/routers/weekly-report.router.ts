import type { Role } from "@customreport/shared";
import { z } from "zod";

import type { AppLogger } from "../../../lib/logger.js";
import {
  WeeklyReportDomainError,
  type WeeklyReportService,
} from "../../../modules/weekly-report/index.js";
import type { TrpcContext } from "../trpc.context.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { anyRoleProcedure, router } from "../trpc.middleware.js";

const WEEKLY_REPORT_LOAD_LOG_PHASE = "weekly-report.load";
const WEEKLY_REPORT_GET_PROCEDURE = "weeklyReport.get";
// Domain failures are expected outcomes of a valid request (warn); anything
// else is a defect and must surface at error level.

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
    error instanceof WeeklyReportDomainError
      ? logger.warn.bind(logger)
      : logger.error.bind(logger);
  logFailure("weekly report load failed", {
    ...loadLogFields(scope),
    error: errorInfo,
  });
}

function logWeeklyReportSuccess(
  logger: AppLogger,
  scope: WeeklyReportLoadScope,
  result: {
    readonly reportId: string;
    readonly periodStatus: string;
    readonly submissionCount: number;
    readonly totalLeads: number;
  },
): void {
  logger.info("weekly report load succeeded", {
    ...loadLogFields(scope),
    resolvedReportId: result.reportId,
    periodStatus: result.periodStatus,
    submissionCount: result.submissionCount,
    totalLeads: result.totalLeads,
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

function emitScopeAudit(
  ctx: Pick<TrpcContext, "auditLogger" | "ip">,
  session: { readonly userId: string; readonly role: Role },
  crossGroup: {
    readonly productIds: readonly string[];
    readonly groupIds: readonly string[];
  },
  resourceId: string,
): void {
  ctx.auditLogger.scopeAccessed({
    userId: session.userId,
    role: session.role,
    ip: ctx.ip,
    accessedScope: "weeklyReport.project",
    productIds: crossGroup.productIds,
    groupIds: crossGroup.groupIds,
    resourceId,
  });
}

// weeklyReport.get uses anyRoleProcedure because
// viewers, leads, heads, and admins all consume this surface. The
// service layer scopes the read to published periods for viewers.

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
          const { crossGroup, ...publicResult } = result;
          if (shouldEmitScopeAudit(crossGroup, ctx.session.role)) {
            emitScopeAudit(ctx, ctx.session, crossGroup, result.reportId);
          }
          logWeeklyReportSuccess(ctx.logger, scope, result);
          return publicResult;
        } catch (error) {
          logWeeklyReportFailure(ctx.logger, scope, error);
          throw mapDomainError(error);
        }
      }),
  });
}
