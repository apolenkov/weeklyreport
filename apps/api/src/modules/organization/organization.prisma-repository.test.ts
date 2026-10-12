import { DEFAULT_ORGANIZATION_IDENTITY } from "@weeklyreport/shared";
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

  it("fails loudly when the seeded singleton row is absent", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const prisma = {
      organization: { findUnique },
    } as unknown as PrismaService;

    const repo = new OrganizationPrismaRepository(prisma);
    await expect(repo.getOrganization()).rejects.toThrow(
      /singleton row 'singleton' is missing/,
    );
  });
});

describe("OrganizationPrismaRepository.updateOrganization", () => {
  it("updates the seeded singleton with the input shortName and fullName", async () => {
    const input = {
      shortName: "NEW",
      fullName: "New Organization Name",
    };
    const updatedRow = {
      ...existingRow,
      shortName: input.shortName,
      fullName: input.fullName,
    };
    const update = vi.fn().mockResolvedValue(updatedRow);
    const prisma = {
      organization: { update },
    } as unknown as PrismaService;

    const repo = new OrganizationPrismaRepository(prisma);
    const org = await repo.updateOrganization(input);

    expect(org.shortName).toBe(input.shortName);
    expect(org.fullName).toBe(input.fullName);
    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith({
      where: { id: "singleton" },
      data: {
        shortName: input.shortName,
        fullName: input.fullName,
      },
    });
  });
});
