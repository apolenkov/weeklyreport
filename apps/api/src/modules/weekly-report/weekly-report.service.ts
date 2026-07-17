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

/**
 * Cross-group signal returned by the repository when a non-admin read
 * surfaces at least one product from another group via the explicit
 * GroupProduct join. The router emits `scopeAccessed` when this is
 * non-empty and the caller is not admin.
 */
export interface CrossGroupSignal {
  readonly productIds: readonly string[];
  readonly groupIds: readonly string[];
}

/**
 * Internal result type for `WeeklyReportService.getWeeklyReport`.
 * Extends the public `WeeklyReportGetResponse` with an optional
 * cross-group audit signal that the router consumes before forwarding
 * the public shape to tRPC clients.
 */
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

/**
 * Weekly report visibility scope.
 * Repository receives the session so it can filter sections, lead users,
 * and projects by `groupScopeFilter`. Tests pass a narrow Pick.
 */
export type WeeklyReportScopeSession = Pick<
  UserSession,
  "userId" | "role" | "reportingGroupId" | "viewerGroupAccess"
>;

/**
 * Result type for `WeeklyReportRepository.getWeeklyReport`.
 * The `crossGroup` signal is non-null only when the session is non-admin
 * and at least one returned product is cross-group; the router uses it
 * to emit the `scopeAccessed` audit event.
 */
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
  /**
   * viewer-live-status (Decision 0): the single newest **editable** period —
   * `open`/`reopened`, non-archived, `periodStart <= now`, NO published
   * fallback. This is the one id both the viewer read gate and the
   * `latestForViewer` resolver hinge on. Distinct from `getActiveReportId`
   * (which carries a published fallback and no `archived` filter), so the gate
   * cannot leak a published or archived-open period through it.
   */
  getCurrentEditableId(): Promise<string | null>;
  /**
   * The newest non-archived `published` report id (deterministic `periodStart
   * desc, id desc`), or null. It is the head's reopen authz target and
   * published-fallback default for leadership readers — the default remains
   * usable even when a newer published row has been archived.
   */
  getLatestPublishedNonArchivedId(): Promise<string | null>;
  /**
   * Report rows behind `WeeklyReportService.compiledHistory`, scoped by
   * `session` (lead → own authored sections, else group scope) and
   * `includeArchive`. Returns the raw report+section rows plus the separate
   * archive count; `buildCompiledHistoryEntries` does the pure post-processing.
   */
  getCompiledHistory(
    session: WeeklyReportScopeSession,
    includeArchive: boolean,
  ): Promise<{
    readonly reports: readonly CompiledHistoryReportRow[];
    readonly archiveCount: number;
  }>;
  /**
   * Resolve `reportId` to itself when it has a `session`-visible section
   * (`sections.some(sectionScope)`), else `null`. Used by `latestForViewer`'s
   * exact-id visibility check on the current editable period — it must NOT
   * search older editable periods, only confirm or reject this exact id.
   */
  getVisibleReportId(
    reportId: string,
    session: WeeklyReportScopeSession,
  ): Promise<string | null>;
  /**
   * The newest `published` report id visible to `session`
   * (`sections.some(sectionScope)`, deterministic `periodStart desc, id
   * desc`), or null. `latestForViewer`'s published fallback.
   */
  getLatestPublishedVisibleId(
    session: WeeklyReportScopeSession,
  ): Promise<string | null>;
}

export class WeeklyReportService {
  private readonly logger = createServiceLogger("WeeklyReportService");

  constructor(private readonly repository: WeeklyReportRepository) {}

  /**
   * viewer-live-status (Decision 0): passthrough to the repository's single
   * source of truth for the current editable period id. The router resolves
   * `latestForViewer` through this (it holds the service, not the repository),
   * so the gate and the entry resolver share one query and cannot diverge.
   */
  getCurrentEditableId(): Promise<string | null> {
    return this.repository.getCurrentEditableId();
  }

  /**
   * Resolve the report shown on leadership dashboard surfaces. The current
   * editable period wins; otherwise the newest usable published period does.
   */
  async getCurrentLeadershipReportId(): Promise<string | null> {
    return (
      (await this.repository.getCurrentEditableId()) ??
      (await this.repository.getLatestPublishedNonArchivedId())
    );
  }

  /**
   * Resolve the default report when the caller passes no `reportId`. Leadership
   * readers use the current editable period, else the newest non-archived
   * published period, so their default cannot land on an archived report.
   *
   * The head resolves through the SAME lifecycle resolvers the publish/reopen
   * authz uses (`getCurrentEditableId` else `getLatestPublishedNonArchivedId`),
   * so the `reportId` the head submits always equals the server-derived
   * lifecycle target and a legitimate head action is never rejected as
   * out-of-scope. The lead keeps `getActiveReportId` — it has no lifecycle gate,
   * so there is no divergence to close.
   */
  private async resolveDefaultReportId(role?: Role): Promise<string | null> {
    if (role === "viewer" || role === "head") {
      return this.getCurrentLeadershipReportId();
    }
    return this.repository.getActiveReportId();
  }

  /**
   * viewer-live-status: viewers read the Status target — any `published` report
   * OR the current editable period (drafts included), gated published-or-current.
   * Non-viewer roles (head/lead/admin) keep their existing visibility.
   *
   * When no active Period exists the service returns
   * `{ status: 'no-period', report: null }` instead of throwing. This
   * eliminates the React Query retry storm (retry: 3 → 3-5 s spinner) on
   * fresh installs and between period cycles. The router logs this path as
   * info, not error, so it never pollutes the error dashboard.
   *
   * Implementation: rather than push the role filter into the repository (which
   * would require a Prisma where-shape leak), we filter the read model after
   * fetch. The repository remains simple and the role gate is verifiable at
   * the service layer in unit tests — defense-in-depth on top of the
   * tRPC-procedure check.
   *
   * Behaviour:
   *   - no active period → { status: 'no-period', report: null } (never throws)
   *   - reportId given but not found → throws WeeklyReportDomainError (explicit
   *     lookup; the caller asked for a specific report that doesn't exist)
   *   - role==='viewer' AND not published AND not the current editable period →
   *     throw WeeklyReportDomainError (published-or-current gate, fail-closed)
   *   - role===undefined → no scoping (legacy contract for existing callers)
   *   - role==='lead' | 'head' | 'admin' → existing behaviour preserved
   */
  async getWeeklyReport(
    reportId?: string,
    role?: Role,
    session?: WeeklyReportScopeSession,
  ): Promise<WeeklyReportServiceResult> {
    const resolvedId = reportId ?? (await this.resolveDefaultReportId(role));

    if (!resolvedId) {
      // No active period — return sentinel instead of throwing NOT_FOUND.
      this.logger.info("weekly report: no active period");
      return { status: "no-period", report: null, crossGroup: null };
    }

    const result = await this.repository.getWeeklyReport(resolvedId, session);

    if (!result) {
      throw new WeeklyReportDomainError(`Report ${resolvedId} not found.`);
    }

    const { readModel, crossGroup } = result;

    // viewer-live-status (Decision 1): published-or-current read gate. A viewer
    // may read a report iff its period is `published` OR it is the current
    // editable period. `currentEditableId` is resolved here — AFTER the report
    // fetch — and is editable-only (no published fallback), so an
    // `open → published` race rejects (the fetched-open id no longer equals the
    // now-recomputed current id) and a mid-request new period fails closed. Every
    // race resolves toward not-found, never a stale live model or a leak. The
    // route recovers a race not-found via a one-shot re-resolution through
    // `/reports/latest` (see viewer-report-shell).
    if (role === "viewer" && readModel.periodStatus !== "published") {
      const currentEditableId = await this.repository.getCurrentEditableId();
      if (resolvedId !== currentEditableId) {
        throw new WeeklyReportDomainError(`Report ${resolvedId} not found.`);
      }
    }

    this.logger.info("weekly report fetched", { reportId: resolvedId, role });
    return { status: "active", ...readModel, crossGroup };
  }

  /**
   * The compiled report History surface, scoped by `session` and
   * `includeArchive`. Pure post-processing (traffic-light folding, counts,
   * distinct-product counting) lives in `buildCompiledHistoryEntries`; this
   * method only threads the repository rows through it.
   */
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

  /**
   * viewer-live-status (task 1.1): resolve the **Status target** for the
   * `/reports/latest` redirect. The target is the current editable period
   * (Decision 0) when that period has a `session`-visible section, else the
   * newest visible `published` report, else `null`. It must NOT search older
   * editable periods — `getVisibleReportId` checks only the exact current id.
   */
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
