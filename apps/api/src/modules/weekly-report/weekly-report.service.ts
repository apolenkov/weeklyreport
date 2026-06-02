import type {
  Role,
  UserSession,
  WeeklyReportGetResponse,
  WeeklyReportReadModel,
} from "@customreport/shared";
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

export interface WeeklyReportRepository {
  getWeeklyReport(
    reportId: string,
    session?: WeeklyReportScopeSession,
  ): Promise<WeeklyReportReadModel | null>;
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
  ): Promise<WeeklyReportGetResponse> {
    const resolvedId = reportId ?? (await this.repository.getActiveReportId());

    if (!resolvedId) {
      // R3a: no active period — return sentinel instead of throwing NOT_FOUND.
      this.logger.info("weekly report: no active period");
      return { status: "no-period", report: null };
    }

    const report = await this.repository.getWeeklyReport(resolvedId, session);

    if (!report) {
      throw new WeeklyReportDomainError(`Report ${resolvedId} not found.`);
    }

    if (role === "viewer" && report.periodStatus !== "published") {
      throw new WeeklyReportDomainError(`Report ${resolvedId} not found.`);
    }

    this.logger.info("weekly report fetched", { reportId: resolvedId, role });
    return { status: "active", ...report };
  }
}
