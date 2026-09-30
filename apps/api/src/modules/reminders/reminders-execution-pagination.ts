import {
  type AdminReminderExecution,
  adminReminderExecutionSchema,
  type PaginatedResult,
  type PaginationInput,
} from "@customreport/shared";

export interface ExecutionPageRequest {
  readonly cursor: string | null;
  readonly take: number;
}

type FetchExecutionsPage = (
  page: ExecutionPageRequest,
) => Promise<AdminReminderExecution[]>;

// Keep sparse allowlist matches from degenerating into one-row round-trips while
// still bounding memory per query.
const MIN_BATCH_SIZE = 25;

// Bound per-query memory while walking an unpaginated history.
const FULL_SCAN_BATCH_SIZE = 200;

// Cap unpaginated walks so a caller that forgets pagination fails loudly.
const UNPAGINATED_HARD_CAP = 1000;

// Fetch batches until `needed` scoped rows are collected or the source is
// exhausted; the result may hold more than `needed` rows.
async function collectScoped(
  fetchPage: FetchExecutionsPage,
  matches: (execution: AdminReminderExecution) => boolean,
  scan: {
    readonly batchSize: number;
    readonly cursor: string | null;
    readonly needed: number;
    readonly acc: readonly AdminReminderExecution[];
  },
): Promise<readonly AdminReminderExecution[]> {
  const { batchSize, cursor, needed, acc } = scan;
  const batch = adminReminderExecutionSchema
    .array()
    .parse(await fetchPage({ cursor, take: batchSize }));
  const scoped = [...acc, ...batch.filter(matches)];
  const lastRow = batch.at(-1);
  if (batch.length < batchSize || scoped.length >= needed || !lastRow) {
    return scoped;
  }
  return collectScoped(fetchPage, matches, {
    ...scan,
    cursor: lastRow.id,
    acc: scoped,
  });
}

// Recipient allowlist is derived outside persistence: filter explicit
// recipientEmail values in batches until the page fills. Cursor is a
// previously returned row id (valid keyset input).
export async function paginateReminderExecutions(
  fetchPage: FetchExecutionsPage,
  pagination?: PaginationInput,
  recipientAllowlist?: ReadonlySet<string> | null,
): Promise<PaginatedResult<AdminReminderExecution>> {
  const matches = (execution: AdminReminderExecution): boolean =>
    !recipientAllowlist || recipientAllowlist.has(execution.recipientEmail);

  if (!pagination) {
    const all = await collectScoped(fetchPage, matches, {
      batchSize: FULL_SCAN_BATCH_SIZE,
      cursor: null,
      needed: UNPAGINATED_HARD_CAP + 1,
      acc: [],
    });
    if (all.length > UNPAGINATED_HARD_CAP) {
      throw new Error(
        `Reminder execution history exceeds the unpaginated cap of ${UNPAGINATED_HARD_CAP} rows; pass pagination.`,
      );
    }
    return { items: all, nextCursor: null };
  }

  const batchSize = Math.max(pagination.limit + 1, MIN_BATCH_SIZE);
  const scoped = await collectScoped(fetchPage, matches, {
    batchSize,
    cursor: pagination.cursor ?? null,
    needed: pagination.limit + 1,
    acc: [],
  });
  const items = scoped.slice(0, pagination.limit);
  const nextCursor =
    scoped.length > pagination.limit ? (items.at(-1)?.id ?? null) : null;
  return { items, nextCursor };
}
