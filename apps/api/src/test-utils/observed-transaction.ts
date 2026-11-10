import { setTimeout as delay } from "node:timers/promises";

import type { Prisma, PrismaClient } from "@prisma/client";

import { expectDefined } from "./expect-defined.js";
import { createPauseGate } from "./paused-prisma.js";

const LOCK_WAIT_TIMEOUT_MS = 3000;

/** Real transactions with their backend PID exposed and an optional pre-commit pause. */
export function observeTransaction(
  prisma: PrismaClient,
  pauseAtCommit = false,
) {
  const gate = createPauseGate();
  const backend = { pid: 0 };
  const transaction = prisma.$transaction.bind(prisma);
  const client = new Proxy(prisma, {
    get(target, property): unknown {
      if (property === "$transaction") {
        return (
          callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
          options?: { timeout?: number },
        ) =>
          transaction(
            async (tx) => {
              const rows = await tx.$queryRaw<
                { pid: number }[]
              >`SELECT pg_backend_pid() AS pid`;
              backend.pid = expectDefined(rows[0]).pid;
              const result = await callback(tx);
              if (pauseAtCommit) await gate.pause();
              return result;
            },
            { ...options, timeout: 15_000 },
          );
      }
      return Reflect.get(target, property, target) as unknown;
    },
  });
  return { client, backend, gate };
}

/** Assert actual PostgreSQL contention, not merely two pending JS promises. */
export async function waitForTransactionBlock(
  prisma: PrismaClient,
  holder: { readonly pid: number },
  waiter: { readonly pid: number },
): Promise<void> {
  const expires = Date.now() + LOCK_WAIT_TIMEOUT_MS;
  while (Date.now() < expires) {
    const blocked = await prisma.$queryRaw<{ blocked: boolean }[]>`
      SELECT ${holder.pid}::int = ANY(pg_blocking_pids(${waiter.pid}::int)) AS blocked
    `;
    if (blocked[0]?.blocked) return;
    await delay(20);
  }
  throw new Error("Competing transaction did not block on the first writer");
}

export async function waitForCommitPause(
  observed: ReturnType<typeof observeTransaction>,
  pending: Promise<unknown>,
): Promise<void> {
  const timeout = Promise.withResolvers<never>();
  const timer = setTimeout(
    () => timeout.reject(new Error("Commit pause not reached")),
    LOCK_WAIT_TIMEOUT_MS,
  );
  try {
    await Promise.race([
      observed.gate.paused,
      pending.then(() => {
        throw new Error("Transaction committed without pausing");
      }),
      timeout.promise,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
