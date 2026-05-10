import type { Role, UserSession, WeeklyReportReadModel } from '@customreport/shared';

export class WeeklyReportDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeeklyReportDomainError';
  }
}

/**
 * UFB-040 / Phase 46-04: weekly report visibility scope.
 * Repository receives the session so it can filter sections, lead users,
 * and projects by `groupScopeFilter`. Tests pass a narrow Pick.
 */
export type WeeklyReportScopeSession = Pick<
  UserSession,
  'role' | 'reportingGroupId' | 'viewerGroupAccess'
>;

export interface WeeklyReportRepository {
  getWeeklyReport(
    reportId: string,
    session?: WeeklyReportScopeSession,
  ): Promise<WeeklyReportReadModel | null>;
  getActiveReportId(): Promise<string | null>;
}

export class WeeklyReportService {
  constructor(private readonly repository: WeeklyReportRepository) {}

  /**
   * AUTH-04 (Phase 28-01): viewers see only PUBLISHED report periods. Non-viewer
   * roles (head/lead/admin) keep their existing visibility (open + published).
   *
   * Implementation: rather than push the role filter into the repository (which
   * would require a Prisma where-shape leak), we filter the read model after
   * fetch. The repository remains simple and the role gate is verifiable at
   * the service layer in unit tests — defense-in-depth on top of the
   * tRPC-procedure check.
   *
   * Behaviour:
   *   - role==='viewer' AND `report.periodStatus !== 'published'` → throw
   *     WeeklyReportDomainError (matches the existing not-found contract; the
   *     viewer simply sees "no published report yet").
   *   - role===undefined → no scoping (legacy contract preserved for existing
   *     callers and scripts that pre-date AUTH-04). The router always threads
   *     `ctx.session.role`, so a viewer session in production cannot reach
   *     the undefined branch.
   *   - role==='lead' | 'head' | 'admin' → existing behaviour preserved.
   */
  async getWeeklyReport(
    reportId?: string,
    role?: Role,
    session?: WeeklyReportScopeSession,
  ): Promise<WeeklyReportReadModel> {
    const resolvedId = reportId ?? (await this.repository.getActiveReportId());

    if (!resolvedId) {
      throw new WeeklyReportDomainError('No active report period found.');
    }

    const report = await this.repository.getWeeklyReport(resolvedId, session);

    if (!report) {
      throw new WeeklyReportDomainError(`Report ${resolvedId} not found.`);
    }

    if (role === 'viewer' && report.periodStatus !== 'published') {
      throw new WeeklyReportDomainError(`Report ${resolvedId} not found.`);
    }

    return report;
  }
}
