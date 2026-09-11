import type { AiProviderControl, Prisma, PrismaClient } from "@prisma/client";
import { expect, it, vi } from "vitest";

import { seedAiProviderControl } from "./seed-ai-prompts.js";

it("leaves the existing-row update empty for an enabled provider", async () => {
  const existingControl: AiProviderControl = {
    id: "singleton",
    enabled: true,
    activeConfigurationId: "a0000000-0000-4000-8000-000000000001",
    createdAt: new Date("2026-07-06T00:00:00Z"),
    updatedAt: new Date("2026-07-06T00:00:00Z"),
  };
  const upsert = vi
    .fn<
      (args: Prisma.AiProviderControlUpsertArgs) => Promise<AiProviderControl>
    >()
    .mockResolvedValue(existingControl);
  const prisma = { aiProviderControl: { upsert } } as unknown as PrismaClient;

  await seedAiProviderControl(prisma);

  expect(upsert).toHaveBeenCalledExactlyOnceWith({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", enabled: false },
  });
});
