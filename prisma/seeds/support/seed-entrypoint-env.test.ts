import { describe, expect, it, vi } from "vitest";

// Seed entrypoints validate DATABASE_URL before their guarded main functions
// construct a pg pool. A missing or blank value must abort the import with the
// canonical missing-variable error instead of reaching the driver as undefined.
async function expectSeedRefusesBlankUrl(modulePath: string): Promise<void> {
  vi.stubEnv("DATABASE_URL", "");
  await expect(import(modulePath)).rejects.toThrow(
    "Missing required environment variable: DATABASE_URL",
  );
}

describe("seed entrypoint environment boundary", () => {
  it("seed.ts refuses a blank DATABASE_URL", async () => {
    await expectSeedRefusesBlankUrl("../../seed.js");
  });

  it("seed-simple.ts refuses a blank DATABASE_URL", async () => {
    await expectSeedRefusesBlankUrl("../simple/seed-simple.js");
  });
});
