import type {
  CompiledHistoryResult,
  LatestForViewerReport,
  UserSession,
  WeeklyReportReadModel,
} from "@customreport/shared";
import {
  compiledHistoryResultSchema,
  latestForViewerReportSchema,
} from "@customreport/shared";

import { type AppLogger, createNullLogger } from "../../lib/logger.js";
import {
  buildCompiledHistoryEntries,
  type CompiledHistoryReportRow,
} from "./compiled-history.js";

// Non-empty when a non-admin read surfaced products from another group; the
// router emits `scopeAccessed` off it.
interface CrossGroupSignal {
  readonly productIds: readonly string[];
  readonly groupIds: readonly string[];
}

// The public `WeeklyReportGetResponse` plus the audit signal the router
// consumes and strips before replying to tRPC clients.
export type WeeklyReportServiceResult =
  | { status: "no-period"; report: null; crossGroup: null }
  | (WeeklyReportReadModel & {
      status: "active";
      crossGroup: CrossGroupSignal | null;
    });

export class WeeklyReportDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeeklyReportDomainError";
  }
}

export type WeeklyReportScopeSession = Pick<
  UserSession,
  "userId" | "role" | "reportingGroupId" | "viewerGroupAccess"
>;

export interface WeeklyReportRepositoryResult {
  readonly readModel: WeeklyReportReadModel;
  readonly crossGroup: CrossGroupSignal | null;
}

export interface WeeklyReportRepository {
  getWeeklyReport(
    reportId: string,
    session: UserSession,
  ): Promise<WeeklyReportRepositoryResult | null>;
  // Lifecycle-only lookup shared with PeriodPrismaRepository. Interactive
  // callers use getCurrentEditableIdForSession below, which guards identity.
  getCurrentEditableId(): Promise<string | null>;
  getCurrentEditableIdForSession(session: UserSession): Promise<string | null>;
  // Lifecycle-only resolver used by PeriodPrismaRepository when reopening a
  // period. It is deliberately not used to default an interactive read.
  getLatestPublishedNonArchivedId(): Promise<string | null>;
  getCompiledHistory(
    session: WeeklyReportScopeSession,
    includeArchive: boolean,
  ): Promise<{
    readonly reports: readonly CompiledHistoryReportRow[];
    readonly archiveCount: number;
  }>;
  // Confirms or rejects this exact id only — it must NOT fall back to
  // searching older editable periods.
  getVisibleReportId(
    reportId: string,
    session: UserSession,
  ): Promise<string | null>;
  getLatestPublishedVisibleId(session: UserSession): Promise<string | null>;
}

export class WeeklyReportService {
  constructor(
    private readonly repository: WeeklyReportRepository,
    private readonly logger: AppLogger = createNullLogger(),
  ) {}

  // The router holds the service, not the repository, so routing
  // `latestForViewer` through this keeps the gate and the entry resolver on
  // one query.
  getCurrentEditableId(session: UserSession): Promise<string | null> {
    return this.repository.getCurrentEditableIdForSession(session);
  }

  // Internal activity aggregation needs the same lifecycle target as period
  // reopening. It does not return report contents and never backs an
  // interactive weeklyReport.get request.
  async getCurrentLeadershipReportId(): Promise<string | null> {
    return (
      (await this.repository.getCurrentEditableId()) ??
      (await this.repository.getLatestPublishedNonArchivedId())
    );
  }

  // A missing period returns the `no-period` sentinel rather than throwing:
  // React Query would otherwise retry a NOT_FOUND three times, showing a 3-5s
  // spinner on fresh installs and between period cycles.
  async getWeeklyReport(
    reportId: string | undefined,
    session: UserSession,
  ): Promise<WeeklyReportServiceResult> {
    const resolvedId = reportId ?? (await this.getCurrentEditableId(session));

    if (!resolvedId) {
      this.logger.info("weekly report: no active period");
      return { status: "no-period", report: null, crossGroup: null };
    }

    const result = await this.repository.getWeeklyReport(resolvedId, session);

    if (!result) {
      throw new WeeklyReportDomainError(`Report ${resolvedId} not found.`);
    }

    const { readModel, crossGroup } = result;

    // `currentEditableId` is resolved AFTER the fetch, so an `open → published`
    // flip mid-request no longer matches and the gate fails closed toward
    // not-found rather than serving a stale model.
    if (session.role === "viewer" && readModel.periodStatus !== "published") {
      const currentEditableId =
        await this.repository.getCurrentEditableIdForSession(session);
      if (resolvedId !== currentEditableId) {
        throw new WeeklyReportDomainError(`Report ${resolvedId} not found.`);
      }
    }

    this.logger.info("weekly report fetched", {
      reportId: resolvedId,
      role: session.role,
    });
    return { status: "active", ...readModel, crossGroup };
  }

  async compiledHistory(
    session: WeeklyReportScopeSession,
    includeArchive: boolean,
  ): Promise<CompiledHistoryResult> {
    const { reports, archiveCount } = await this.repository.getCompiledHistory(
      session,
      includeArchive,
    );
    return compiledHistoryResultSchema.parse({
      entries: buildCompiledHistoryEntries(reports),
      archiveCount,
    });
  }

  // Must NOT search older editable periods: `getVisibleReportId` only confirms
  // the exact current id before falling back to the newest visible published.
  async latestForViewer(session: UserSession): Promise<LatestForViewerReport> {
    const currentEditableId = await this.getCurrentEditableId(session);

    if (currentEditableId) {
      const currentVisible = await this.repository.getVisibleReportId(
        currentEditableId,
        session,
      );
      if (currentVisible) {
        return latestForViewerReportSchema.parse({ reportId: currentVisible });
      }
    }

    const published =
      await this.repository.getLatestPublishedVisibleId(session);
    return latestForViewerReportSchema.parse({
      reportId: published ?? null,
    });
  }
}
