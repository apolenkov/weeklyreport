import {
  type AdminReminderExecution,
  adminReminderExecutionSchema,
  type PaginatedResult,
  type PaginationInput,
} from "@customreport/shared";

/** One keyset-page request against the execution history (newest first). */
export interface ExecutionPageRequest {
  /** Id of the previous page's last row; null starts from the newest row. */
  readonly cursor: string | null;
  readonly take: number;
}

type FetchExecutionsPage = (
  page: ExecutionPageRequest,
) => Promise<AdminReminderExecution[]>;

/** Rows-per-query floor: keeps sparse allowlist matches from degenerating
 * into one-row round-trips while still bounding memory per query. */
const MIN_BATCH_SIZE = 25;

/** Batch size for an unpaginated read: bounds per-query memory while walking
 * the whole history. */
const FULL_SCAN_BATCH_SIZE = 200;

/** Fetch batches until `needed` scoped rows are collected or the source is
 * exhausted; returns the scoped rows (possibly more than `needed`). */
async function collectScoped(
  fetchPage: FetchExecutionsPage,
  matches: (execution: AdminReminderExecution) => boolean,
  batchSize: number,
  cursor: string | null,
  needed: number,
  acc: readonly AdminReminderExecution[],
): Promise<readonly AdminReminderExecution[]> {
  const batch = adminReminderExecutionSchema
    .array()
    .parse(await fetchPage({ cursor, take: batchSize }));
  const scoped = [...acc, ...batch.filter(matches)];
  const lastRow = batch.at(-1);
  if (batch.length < batchSize || scoped.length >= needed || !lastRow) {
    return scoped;
  }
  return collectScoped(
    fetchPage,
    matches,
    batchSize,
    lastRow.id,
    needed,
    scoped,
  );
}

// Recipient allowlist is derived (not a column): filter batches until the
// page fills. Cursor is a previously returned row id (valid keyset input).
/**
 * Paginate Reminder Executions.
 * @param fetchPage - The fetchPage argument.
 * @param pagination - The pagination argument.
 * @param recipientAllowlist - The recipientAllowlist argument.
 */
export async function paginateReminderExecutions(
  fetchPage: FetchExecutionsPage,
  pagination?: PaginationInput,
  recipientAllowlist?: ReadonlySet<string> | null,
): Promise<PaginatedResult<AdminReminderExecution>> {
  const matches = (execution: AdminReminderExecution): boolean =>
    !recipientAllowlist || recipientAllowlist.has(execution.recipientEmail);

  if (!pagination) {
    const all = await collectScoped(
      fetchPage,
      matches,
      FULL_SCAN_BATCH_SIZE,
      null,
      Number.POSITIVE_INFINITY,
      [],
    );
    return { items: [...all], nextCursor: null };
  }

  const batchSize = Math.max(pagination.limit + 1, MIN_BATCH_SIZE);
  const scoped = await collectScoped(
    fetchPage,
    matches,
    batchSize,
    pagination.cursor ?? null,
    pagination.limit + 1,
    [],
  );
  const items = scoped.slice(0, pagination.limit);
  const nextCursor =
    scoped.length > pagination.limit ? (items.at(-1)?.id ?? null) : null;
  return { items, nextCursor };
}
