import type { PaginatedResult, PaginationInput } from "@customreport/shared";

const DEFAULT_ACTION_LOG_LIMIT = 20;

/**
 * One row of the queryable in-app mutation-audit history. The rows are
 * written by `mutationAuditMiddleware` and keyed by the same correlation id
 * as the structured app.log line, for support/debug lookups.
 */
interface ActionLogFields {
  id: string;
  userId: string;
  role: string | null;
  procedure: string;
  targetId: string | null;
  status: string;
  reason: string | null;
  ip: string | null;
  correlationId: string;
  durationMs: number;
}

export type ActionLogEntry = ActionLogFields & { createdAt: string };

export type ActionLogRow = ActionLogFields & { createdAt: Date };

export interface ActionLogRepository {
  /** `limit + 1` rows, keyset-paginated on `id` (cursor row excluded), newest first. */
  listActionLog(pagination: {
    limit: number;
    cursor?: string;
  }): Promise<ActionLogRow[]>;
}

export class ActionLogService {
  constructor(private readonly repository: ActionLogRepository) {}

  /**
   * Cursor-paginated mutation-audit history for the Admin Panel. Reads one
   * extra row (`limit + 1`) to detect whether a further page exists without
   * a separate count query.
   */
  async list(
    pagination?: PaginationInput,
  ): Promise<PaginatedResult<ActionLogEntry>> {
    const limit = pagination?.limit ?? DEFAULT_ACTION_LOG_LIMIT;
    const rows = await this.repository.listActionLog({
      limit: limit + 1,
      cursor: pagination?.cursor,
    });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;
    return {
      items: items.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }
}
