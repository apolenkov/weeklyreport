import type { PrismaClient, ReportSectionStatus } from "@prisma/client";
import { expect, it, vi } from "vitest";

import { runProfileJourney } from "./seed-profile-journeys.js";

function minimalPrisma(status: ReportSectionStatus): PrismaClient {
  return {
    report: {
      findUnique: vi.fn().mockResolvedValue({
        periodState: "open",
        sections: [
          {
            status,
            items: [{ id: "a0000000-0000-4000-8000-000000000001" }],
          },
        ],
      }),
    },
  } as unknown as PrismaClient;
}

it("accepts the minimal draft fixture containing an item", async () => {
  await expect(
    runProfileJourney(minimalPrisma("draft"), "minimal"),
  ).resolves.toBeUndefined();
});

it("rejects a submitted minimal section even when an item exists", async () => {
  await expect(
    runProfileJourney(minimalPrisma("submitted"), "minimal"),
  ).rejects.toThrow("Seed journey failed: minimal lead section is draft");
});

it.each(["minimal", "demo", "full"] as const)(
  "names the public %s profile when its active report is absent",
  async (profile) => {
    const prisma = {
      report: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient;
    await expect(runProfileJourney(prisma, profile)).rejects.toThrow(
      `Seed journey failed: ${profile} active report is open`,
    );
  },
);
