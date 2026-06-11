import type {
  Role,
  UserSession,
  WeeklyReportReadModel,
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

import { createAppLogger } from "../../lib/logger.js";

export class WeeklyReportDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeeklyReportDomainError";
  }
}

/**
 * UFB-040 / Phase 46-04: weekly report visibility scope.
 * Repository receives the session so it can filter sections, lead users,
 * and projects by `groupScopeFilter`. Tests pass a narrow Pick.
 */
export type WeeklyReportScopeSession = Pick<
  UserSession,
  "role" | "reportingGroupId" | "viewerGroupAccess"
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
}

export class WeeklyReportService {
  private readonly logger = createAppLogger({
    service: "WeeklyReportService",
    logDir: process.env.LOG_DIR,
    minLevel:
      (process.env.LOG_LEVEL as
        | "debug"
        | "info"
        | "warn"
        | "error"
        | undefined) ?? "info",
  });

  constructor(private readonly repository: WeeklyReportRepository) {}

  /**
   * AUTH-04 (Phase 28-01): viewers see only PUBLISHED report periods. Non-viewer
   * roles (head/lead/admin) keep their existing visibility (open + published).
   *
   * R3a (UFB-HEAD-DASH): when no active Period exists the service returns
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
   *   - role==='viewer' AND `report.periodStatus !== 'published'` → throw
   *     WeeklyReportDomainError (viewer sees "no published report yet")
   *   - role===undefined → no scoping (legacy contract for existing callers)
   *   - role==='lead' | 'head' | 'admin' → existing behaviour preserved
   */
  async getWeeklyReport(
    reportId?: string,
    role?: Role,
    session?: WeeklyReportScopeSession,
  ): Promise<WeeklyReportServiceResult> {
    const resolvedId = reportId ?? (await this.repository.getActiveReportId());

    if (!resolvedId) {
      // R3a: no active period — return sentinel instead of throwing NOT_FOUND.
      this.logger.info("weekly report: no active period");
      return { status: "no-period", report: null, crossGroup: null };
    }

    const result = await this.repository.getWeeklyReport(resolvedId, session);

    if (!result) {
      throw new WeeklyReportDomainError(`Report ${resolvedId} not found.`);
    }

    const { readModel, crossGroup } = result;

    if (role === "viewer" && readModel.periodStatus !== "published") {
      throw new WeeklyReportDomainError(`Report ${resolvedId} not found.`);
    }

    this.logger.info("weekly report fetched", { reportId: resolvedId, role });
    return { status: "active", ...readModel, crossGroup };
  }
}
