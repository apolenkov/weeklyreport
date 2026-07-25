import type {
  CompiledHistoryResult,
  LatestForViewerReport,
  Role,
  UserSession,
  WeeklyReportReadModel,
} from "@customreport/shared";
import {
  compiledHistoryResultSchema,
  latestForViewerReportSchema,
} from "@customreport/shared";

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

import { createServiceLogger } from "../../lib/logger-service.js";
import {
  buildCompiledHistoryEntries,
  type CompiledHistoryReportRow,
} from "./compiled-history.js";

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
    session?: WeeklyReportScopeSession,
  ): Promise<WeeklyReportRepositoryResult | null>;
  getActiveReportId(): Promise<string | null>;
  // Unlike `getActiveReportId`, has NO published fallback and filters
  // `archived`, so the viewer gate cannot leak a published or archived-open
  // period through it.
  getCurrentEditableId(): Promise<string | null>;
  // The head's reopen authz target and leadership published fallback; skipping
  // archived rows keeps the default usable after a newer row is archived.
  getLatestPublishedNonArchivedId(): Promise<string | null>;
  // Scoped lead → own authored sections, otherwise group scope.
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
    session: WeeklyReportScopeSession,
  ): Promise<string | null>;
  getLatestPublishedVisibleId(
    session: WeeklyReportScopeSession,
  ): Promise<string | null>;
}

export class WeeklyReportService {
  private readonly logger = createServiceLogger("WeeklyReportService");

  constructor(private readonly repository: WeeklyReportRepository) {}

  // The router holds the service, not the repository, so routing
  // `latestForViewer` through this keeps the gate and the entry resolver on
  // one query.
  getCurrentEditableId(): Promise<string | null> {
    return this.repository.getCurrentEditableId();
  }

  async getCurrentLeadershipReportId(): Promise<string | null> {
    return (
      (await this.repository.getCurrentEditableId()) ??
      (await this.repository.getLatestPublishedNonArchivedId())
    );
  }

  // Leadership resolves through the SAME lifecycle resolvers the publish/reopen
  // authz uses, so a head's submitted `reportId` always equals the
  // server-derived target. Leads have no lifecycle gate, so they keep the plain
  // active id.
  private async resolveDefaultReportId(role?: Role): Promise<string | null> {
    if (role === "viewer" || role === "head") {
      return this.getCurrentLeadershipReportId();
    }
    return this.repository.getActiveReportId();
  }

  // A missing period returns the `no-period` sentinel rather than throwing:
  // React Query would otherwise retry a NOT_FOUND three times, showing a 3-5s
  // spinner on fresh installs and between period cycles.
  async getWeeklyReport(
    reportId?: string,
    role?: Role,
    session?: WeeklyReportScopeSession,
  ): Promise<WeeklyReportServiceResult> {
    const resolvedId = reportId ?? (await this.resolveDefaultReportId(role));

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
    if (role === "viewer" && readModel.periodStatus !== "published") {
      const currentEditableId = await this.repository.getCurrentEditableId();
      if (resolvedId !== currentEditableId) {
        throw new WeeklyReportDomainError(`Report ${resolvedId} not found.`);
      }
    }

    this.logger.info("weekly report fetched", { reportId: resolvedId, role });
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
  async latestForViewer(
    session: WeeklyReportScopeSession,
  ): Promise<LatestForViewerReport> {
    const currentEditableId = await this.getCurrentEditableId();

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
