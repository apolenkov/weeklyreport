import type { Prisma, PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { RuntimeStateTransaction } from "../../support/state-preparation.ts";
import { createPrismaRuntimeStateDatabase } from "./prisma-state-database.ts";

describe("Prisma runtime state database", () => {
  it("forwards the preflight transaction budget and preserves generic results", async () => {
    const transactionClient = {} as unknown as Prisma.TransactionClient;
    const executeTransaction = vi.fn(
      async (
        work: (transaction: Prisma.TransactionClient) => Promise<unknown>,
        _options: { maxWait?: number; timeout?: number },
      ) => work(transactionClient),
    );
    const prisma = {
      $transaction: executeTransaction,
    } as unknown as PrismaClient;
    const database = createPrismaRuntimeStateDatabase(prisma);
    const expected = { state: "prepared" } as const;

    const result = await database.transaction(
      (_transaction: RuntimeStateTransaction) => Promise.resolve(expected),
    );

    expect(result).toBe(expected);
    expect(executeTransaction).toHaveBeenCalledOnce();
    expect(executeTransaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10_000,
      timeout: 30_000,
    });
  });

  it("reads every UserActionLog field in deterministic order for the mutation sentinel", async () => {
    const rows = [
      {
        id: "log-1",
        userId: "user-1",
        role: "admin",
        procedure: "admin.savePolicy",
        targetId: "policy-1",
        status: "success",
        reason: null,
        ip: "127.0.0.1",
        correlationId: "corr-1",
        durationMs: 4,
        createdAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    ];
    const findMany = vi.fn(() => Promise.resolve(rows));
    const transactionClient = {
      userActionLog: { findMany },
    } as unknown as Prisma.TransactionClient;
    const prisma = {
      $transaction: async (
        work: (transaction: Prisma.TransactionClient) => Promise<unknown>,
      ) => work(transactionClient),
    } as unknown as PrismaClient;
    const database = createPrismaRuntimeStateDatabase(prisma);

    const sentinel = await database.transaction((transaction) =>
      transaction.readMutationSentinel(),
    );

    expect(sentinel).toEqual([
      {
        ...rows[0],
        createdAt: "2020-01-01T00:00:00.000Z",
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        userId: true,
        role: true,
        procedure: true,
        targetId: true,
        status: true,
        reason: true,
        ip: true,
        correlationId: true,
        durationMs: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  });
});
