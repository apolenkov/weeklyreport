import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { ProjectActivityConflictError } from "./project-activity.errors.js";
import { runProjectActivityTransaction } from "./project-activity.transaction.js";

const serializationConflict = () =>
  Object.assign(new Error("write conflict"), { code: "P2034" });

const adapterSerializationConflict = () =>
  Object.assign(new Error("write conflict"), {
    name: "DriverAdapterError",
    cause: { kind: "TransactionWriteConflict" },
  });

function fakePrisma(transaction: ReturnType<typeof vi.fn>): PrismaService {
  return { $transaction: transaction } as unknown as PrismaService;
}

describe("runProjectActivityTransaction", () => {
  it("runs once at Serializable isolation", async () => {
    const transaction = vi.fn((operation: (tx: unknown) => unknown) =>
      operation({ id: "tx" }),
    );
    const operation = vi.fn(() => Promise.resolve("committed"));

    await expect(
      runProjectActivityTransaction(fakePrisma(transaction), operation),
    ).resolves.toBe("committed");
    expect(transaction).toHaveBeenCalledWith(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it("retries two serialization conflicts and returns the third attempt", async () => {
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(serializationConflict())
      .mockRejectedValueOnce(serializationConflict())
      .mockResolvedValueOnce("committed");

    await expect(
      runProjectActivityTransaction(fakePrisma(transaction), vi.fn()),
    ).resolves.toBe("committed");
    expect(transaction).toHaveBeenCalledTimes(3);
  });

  it("maps third serialization conflict to the typed exhaustion error", async () => {
    const transaction = vi.fn(() => Promise.reject(serializationConflict()));

    await expect(
      runProjectActivityTransaction(fakePrisma(transaction), vi.fn()),
    ).rejects.toBeInstanceOf(ProjectActivityConflictError);
    expect(transaction).toHaveBeenCalledTimes(3);
  });

  it("retries the PrismaPg driver-adapter conflict shape", async () => {
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(adapterSerializationConflict())
      .mockResolvedValueOnce("committed");

    await expect(
      runProjectActivityTransaction(fakePrisma(transaction), vi.fn()),
    ).resolves.toBe("committed");
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("does not retry unrelated failures", async () => {
    const failure = new Error("connection lost");
    const transaction = vi.fn(() => Promise.reject(failure));

    await expect(
      runProjectActivityTransaction(fakePrisma(transaction), vi.fn()),
    ).rejects.toBe(failure);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
