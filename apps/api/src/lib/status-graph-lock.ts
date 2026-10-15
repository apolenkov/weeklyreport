import type { Prisma } from "@prisma/client";

// One MVP-wide serialization lane for writes that derive child status rows
// from the current assignment graph. A global lane is intentional: a new
// report can appear after another writer's candidate scan, so a narrower key
// would leave a phantom gap unless every report-creation path joined it.
export const STATUS_GRAPH_ADVISORY_LOCK_KEY = 2_147_483_647;

/** Serializes assignment/status projection scans with section provisioning. */
export async function lockStatusGraph(
  tx: Prisma.TransactionClient,
): Promise<void> {
  // The advisory-lock function returns PostgreSQL's `void` type. Prisma 7's
  // pg adapter cannot deserialize void result columns, while executeRaw only
  // consumes the command row count and preserves the transaction lock.
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(${STATUS_GRAPH_ADVISORY_LOCK_KEY})
  `;
}
