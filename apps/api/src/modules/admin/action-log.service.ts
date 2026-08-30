import {
  actionLogFailureReasonSchema,
  type AdminActionLogEvent,
  adminActionLogEventSchema,
  type AdminActionLogPage,
  adminActionLogPageSchema,
  type PaginationInput,
  type Role,
} from "@customreport/shared";

const DEFAULT_ACTION_LOG_LIMIT = 20;

// Mutation-audit rows share correlationId with app.log for support lookups.
interface ActionLogFields {
  readonly id: string;
  readonly userId: string;
  readonly role: Role | null;
  readonly procedure: string;
  readonly targetId: string | null;
  readonly status: "success" | "fail";
  readonly reason: string | null;
  readonly ip: string | null;
  readonly correlationId: string;
  readonly durationMs: number;
}

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
  async list(pagination?: PaginationInput): Promise<AdminActionLogPage> {
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
    return adminActionLogPageSchema.parse({
      items: items.map(mapActionLogRow),
      nextCursor,
    });
  }
}

function mapActionLogRow(row: ActionLogRow): AdminActionLogEvent {
  const common = {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    userId: row.userId,
    role: row.role,
    procedure: row.procedure,
    targetId: row.targetId,
    ip: row.ip,
    correlationId: row.correlationId,
    durationMs: row.durationMs,
  } as const;

  return adminActionLogEventSchema.parse(
    row.status === "success"
      ? { ...common, status: "success", reason: null }
      : {
          ...common,
          status: "fail",
          // Current writers persist only the shared allowlist. Parsing here
          // deliberately fails closed if an out-of-contract row is present;
          // historical arbitrary reasons are not part of the MVP contract.
          reason: actionLogFailureReasonSchema.parse(row.reason),
        },
  );
}
