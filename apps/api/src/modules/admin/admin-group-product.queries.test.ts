import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { attachProductToGroup } from "./admin-group-product.queries.js";
import { AdminGroupProductConflictError } from "./admin-shared.js";

const OWNER_GROUP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_GROUP = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PRODUCT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function prismaWith(
  existing: { groupId: string },
  groupRow: { name: string } | null,
): PrismaService {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "lead-1" }]),
    project: {
      findUnique: vi
        .fn()
        .mockResolvedValueOnce({ leadId: "lead-1" })
        .mockResolvedValueOnce({ leadId: "lead-1" })
        .mockResolvedValueOnce({
          leadId: "lead-1",
          lead: { role: "lead", reportingGroupId: OWNER_GROUP },
        }),
    },
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ role: "lead", reportingGroupId: OWNER_GROUP }),
    },
    groupProduct: {
      findUnique: vi.fn().mockResolvedValue({
        id: "edge-1",
        productId: PRODUCT_ID,
        ...existing,
      }),
      create: vi.fn(),
    },
    reportingGroup: {
      findUnique: vi.fn().mockResolvedValue(groupRow),
    },
  };
  return {
    $transaction: vi.fn((operation: (client: typeof tx) => unknown) =>
      Promise.resolve(operation(tx)),
    ),
    groupProduct: {
      findUnique: vi.fn(),
    },
    reportingGroup: {
      findUnique: vi.fn(),
    },
  } as unknown as PrismaService;
}

describe("attachProductToGroup — ownership-conflict naming", () => {
  it("names the owning group when its row exists", async () => {
    const prisma = prismaWith({ groupId: OWNER_GROUP }, { name: "Test Group" });

    await expect(
      attachProductToGroup(prisma, {
        groupId: OTHER_GROUP,
        productId: PRODUCT_ID,
      }),
    ).rejects.toThrow(/already attached to Test Group/);
  });

  it("fails loud when the owning group's row is missing (never fabricates 'another group')", async () => {
    const prisma = prismaWith({ groupId: OWNER_GROUP }, null);
    const attempt = attachProductToGroup(prisma, {
      groupId: OTHER_GROUP,
      productId: PRODUCT_ID,
    });

    await expect(attempt).rejects.toBeInstanceOf(
      AdminGroupProductConflictError,
    );
    await expect(attempt).rejects.toThrow(
      /already attached to group aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/,
    );
    await expect(attempt).rejects.toThrow(/group's row is missing/);
  });

  it("reports a never-existing product as a typed conflict, not a raw Prisma error", async () => {
    const tx = { project: { findUnique: vi.fn().mockResolvedValue(null) } };
    const prisma = {
      $transaction: vi.fn((operation: (client: typeof tx) => unknown) =>
        Promise.resolve(operation(tx)),
      ),
    } as unknown as PrismaService;

    await expect(
      attachProductToGroup(prisma, {
        groupId: OTHER_GROUP,
        productId: PRODUCT_ID,
      }),
    ).rejects.toBeInstanceOf(AdminGroupProductConflictError);
  });
});
