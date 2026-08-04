import type { PaginatedResult, PaginationInput } from "@customreport/shared";

const DEFAULT_ACTION_LOG_LIMIT = 20;

// Mutation-audit rows share correlationId with app.log for support lookups.
interface ActionLogFields {
  readonly id: string;
  readonly userId: string;
  readonly role: string | null;
  readonly procedure: string;
  readonly targetId: string | null;
  readonly status: string;
  readonly reason: string | null;
  readonly ip: string | null;
  readonly correlationId: string;
  readonly durationMs: number;
}

export type ActionLogEntry = ActionLogFields & { createdAt: string };

export type ActionLogRow = ActionLogFields & { createdAt: Date };

export interface ActionLogRepository {
  // Newest-first composite keyset: `createdAt DESC`, then unique `id DESC`.
  readonly listActionLog: (pagination: {
    readonly limit: number;
    readonly cursor?: string;
  }) => Promise<readonly ActionLogRow[]>;
}

export class ActionLogService {
  constructor(private readonly repository: ActionLogRepository) {}

  // limit+1 detects a further page without a separate count query.
  async list(
    pagination?: PaginationInput,
  ): Promise<PaginatedResult<ActionLogEntry>> {
    const limit = pagination?.limit ?? DEFAULT_ACTION_LOG_LIMIT;
    const rows = await this.repository.listActionLog({
      limit: limit + 1,
      ...(pagination?.cursor === undefined
        ? {}
        : { cursor: pagination.cursor }),
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
