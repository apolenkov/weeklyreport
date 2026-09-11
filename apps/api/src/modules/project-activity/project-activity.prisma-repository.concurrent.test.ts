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
  conflictAt: "lead-count" | "activity-update" | "product-read" | "none",
  attachedLeadCount = 0,
): Prisma.TransactionClient {
  const conflict = () => Promise.reject(adapterConflict());
  return {
    report: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "55555555-5555-4555-8555-555555555555" }]),
    },
    $executeRaw: vi.fn().mockResolvedValue(0),
    $queryRaw: vi.fn().mockResolvedValue([
      {
        id: "55555555-5555-4555-8555-555555555555",
        status: "draft",
        periodState: "open",
        periodStatus: "open",
        archived: false,
        autoPublished: false,
        autoArchived: false,
        publishedAt: null,
        publishedById: null,
        reopenedAt: null,
      },
    ]),
    projectActivity: {
      findUnique: vi.fn().mockResolvedValue({ groupId: GROUP_A }),
      update:
        conflictAt === "activity-update"
          ? vi.fn(conflict)
          : vi.fn().mockResolvedValue({ id: ACTIVITY }),
    },
    projectActivityLead: {
      count:
        conflictAt === "lead-count"
          ? vi.fn(conflict)
          : vi.fn().mockResolvedValue(attachedLeadCount),
    },
    projectActivityProduct: {
      findMany:
        conflictAt === "product-read"
          ? vi.fn(conflict)
          : vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  } as unknown as Prisma.TransactionClient;
}

function attachTransaction(
  activityGroup: string,
  conflictAt: "lead-read" | "edge-upsert" | "transaction-completion" | "none",
): Prisma.TransactionClient {
  const conflict = () => Promise.reject(adapterConflict());
  return {
    report: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "55555555-5555-4555-8555-555555555555" }]),
    },
    $executeRaw: vi.fn().mockResolvedValue(0),
    $queryRaw: vi.fn().mockResolvedValue([
      {
        id: "55555555-5555-4555-8555-555555555555",
        status: "draft",
        periodState: "open",
        periodStatus: "open",
        archived: false,
        autoPublished: false,
        autoArchived: false,
        publishedAt: null,
        publishedById: null,
        reopenedAt: null,
      },
    ]),
    projectActivity: {
      findUnique: vi.fn().mockResolvedValue({
        groupId: activityGroup,
        archived: false,
      }),
    },
    user: {
      findUnique:
        conflictAt === "lead-read"
          ? vi.fn(conflict)
          : vi.fn().mockResolvedValue({
              role: "lead",
              reportingGroupId: GROUP_A,
            }),
    },
    projectActivityLead: {
      upsert:
        conflictAt === "edge-upsert"
          ? vi.fn(conflict)
          : vi.fn().mockResolvedValue({}),
    },
    reportSection: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    project: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    activityStatus: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  } as unknown as Prisma.TransactionClient;
}

describe("ProjectActivityPrismaRepository conflict retries", () => {
  it.each(["lead-count", "activity-update", "product-read"] as const)(
    "rejects a group move when retry after %s observes an attachment",
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

  it.each(["lead-read", "edge-upsert", "transaction-completion"] as const)(
    "rejects an attachment when retry after %s observes another group",
    async (boundary) => {
      const first = attachTransaction(GROUP_A, boundary);
      const retry = attachTransaction(GROUP_B, "none");
      const { prisma, transaction } = fakePrisma(
        first,
        retry,
        boundary === "transaction-completion",
      );
      const repository = new ProjectActivityPrismaRepository(prisma);

      await expect(
        repository.attachLead({ activityId: ACTIVITY, leadId: LEAD }),
      ).rejects.toBeInstanceOf(ProjectActivityConflictError);
      expect(transaction).toHaveBeenCalledTimes(2);
    },
  );

  it("bumps the affected draft versions when a lead is detached", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      report: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "55555555-5555-4555-8555-555555555555" }]),
      },
      $executeRaw: vi.fn().mockResolvedValue(0),
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "55555555-5555-4555-8555-555555555555",
          status: "draft",
          periodState: "open",
          periodStatus: "open",
          archived: false,
          autoPublished: false,
          autoArchived: false,
          publishedAt: null,
          publishedById: null,
          reopenedAt: null,
        },
      ]),
      projectActivityLead: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      reportSection: {
        findMany: vi.fn().mockResolvedValue([{ id: "section-1" }]),
        updateMany,
      },
      activityStatus: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    } as unknown as Prisma.TransactionClient;
    const prisma = {
      $transaction: vi.fn((operation: TransactionOperation) => operation(tx)),
    } as unknown as PrismaService;
    const repository = new ProjectActivityPrismaRepository(prisma);

    await repository.detachLead({ activityId: ACTIVITY, leadId: LEAD });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["section-1"] } },
      data: { version: { increment: 1 } },
    });
  });
});
