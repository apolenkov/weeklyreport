import { DEFAULT_ORGANIZATION_IDENTITY } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { OrganizationPrismaRepository } from "./organization.prisma-repository";

const existingRow = {
  id: "singleton",
  shortName: DEFAULT_ORGANIZATION_IDENTITY.shortName,
  fullName: DEFAULT_ORGANIZATION_IDENTITY.fullName,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

describe("OrganizationPrismaRepository.getOrganization", () => {
  it("performs no write when the singleton row already exists", async () => {
    const findUnique = vi.fn().mockResolvedValue(existingRow);
    const upsert = vi.fn();
    const prisma = {
      organization: { findUnique, upsert },
    } as unknown as PrismaService;

    const repo = new OrganizationPrismaRepository(prisma);
    const org = await repo.getOrganization();

    expect(org.shortName).toBe(existingRow.shortName);
    expect(findUnique).toHaveBeenCalledOnce();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts the singleton (race-safe) only when the row is absent", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const upsert = vi.fn().mockResolvedValue(existingRow);
    const prisma = {
      organization: { findUnique, upsert },
    } as unknown as PrismaService;

    const repo = new OrganizationPrismaRepository(prisma);
    await repo.getOrganization();

    expect(upsert).toHaveBeenCalledOnce();
    // A concurrent create must collapse to a no-op update, not a P2002.
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "singleton" },
        update: {},
      }),
    );
  });
});
