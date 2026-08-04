import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { ProjectActivityConflictError } from "./project-activity.errors.js";
import { ProjectActivityPrismaRepository } from "./project-activity.prisma-repository.js";

const GROUP_A = "11111111-1111-4111-8111-111111111111";
const GROUP_B = "22222222-2222-4222-8222-222222222222";
const ACTIVITY = "33333333-3333-4333-8333-333333333333";
const LEAD = "44444444-4444-4444-8444-444444444444";

const adapterConflict = () =>
  Object.assign(new Error("write conflict"), {
    name: "DriverAdapterError",
    cause: { kind: "TransactionWriteConflict" },
  });

type TransactionOperation = (tx: Prisma.TransactionClient) => Promise<unknown>;

function fakePrisma(
  first: Prisma.TransactionClient,
  retry: Prisma.TransactionClient,
  conflictAfterFirstOperation = false,
): { prisma: PrismaService; transaction: ReturnType<typeof vi.fn> } {
  const firstAttempt = async (operation: TransactionOperation) => {
    const result = await operation(first);
    if (conflictAfterFirstOperation) throw adapterConflict();
    return result;
  };
  const transaction = vi
    .fn()
    .mockImplementationOnce(firstAttempt)
    .mockImplementationOnce((operation: TransactionOperation) =>
      operation(retry),
    );
  return {
    prisma: { $transaction: transaction } as unknown as PrismaService,
    transaction,
  };
}

function moveTransaction(
  conflictAt: "activity-read" | "edge-check" | "activity-write" | "none",
  attachedLeadCount = 0,
): Prisma.TransactionClient {
  const conflict = () => Promise.reject(adapterConflict());
  return {
    projectActivity: {
      findUnique: vi.fn().mockResolvedValue({ groupId: GROUP_A }),
      update:
        conflictAt === "edge-check"
          ? vi.fn(conflict)
          : vi.fn().mockResolvedValue({ id: ACTIVITY }),
    },
    projectActivityLead: {
      count:
        conflictAt === "activity-read"
          ? vi.fn(conflict)
          : vi.fn().mockResolvedValue(attachedLeadCount),
    },
    projectActivityProduct: {
      findMany:
        conflictAt === "activity-write"
          ? vi.fn(conflict)
          : vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  } as unknown as Prisma.TransactionClient;
}

function attachTransaction(
  activityGroup: string,
  conflictAt: "activity-read" | "lead-read" | "edge-write" | "none",
): Prisma.TransactionClient {
  const conflict = () => Promise.reject(adapterConflict());
  return {
    projectActivity: {
      findUnique: vi.fn().mockResolvedValue({
        groupId: activityGroup,
        archived: false,
      }),
    },
    user: {
      findUnique:
        conflictAt === "activity-read"
          ? vi.fn(conflict)
          : vi.fn().mockResolvedValue({
              role: "lead",
              reportingGroupId: GROUP_A,
            }),
    },
    projectActivityLead: {
      upsert:
        conflictAt === "lead-read"
          ? vi.fn(conflict)
          : vi.fn().mockResolvedValue({}),
    },
  } as unknown as Prisma.TransactionClient;
}

describe("ProjectActivityPrismaRepository concurrent boundaries", () => {
  it.each(["activity-read", "edge-check", "activity-write"] as const)(
    "revalidates a group move when attachment commits after %s",
    async (boundary) => {
      const first = moveTransaction(boundary);
      const retry = moveTransaction("none", 1);
      const { prisma, transaction } = fakePrisma(first, retry);
      const repository = new ProjectActivityPrismaRepository(prisma);

      await expect(
        repository.update({
          id: ACTIVITY,
          name: "Release duty",
          groupId: GROUP_B,
          linkedProductIds: [],
          jiraAccounts: [],
        }),
      ).rejects.toBeInstanceOf(ProjectActivityConflictError);
      expect(transaction).toHaveBeenCalledTimes(2);
    },
  );

  it.each(["activity-read", "lead-read", "edge-write"] as const)(
    "revalidates an attachment when the group move commits after %s",
    async (boundary) => {
      const first = attachTransaction(GROUP_A, boundary);
      const retry = attachTransaction(GROUP_B, "none");
      const { prisma, transaction } = fakePrisma(
        first,
        retry,
        boundary === "edge-write",
      );
      const repository = new ProjectActivityPrismaRepository(prisma);

      await expect(
        repository.attachLead({ activityId: ACTIVITY, leadId: LEAD }),
      ).rejects.toBeInstanceOf(ProjectActivityConflictError);
      expect(transaction).toHaveBeenCalledTimes(2);
    },
  );
});
