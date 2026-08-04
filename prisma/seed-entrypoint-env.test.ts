import { describe, expect, it, vi } from "vitest";

// The seed entrypoints construct their pg pool at module-evaluation time via
// requireEnv("DATABASE_URL") (CONFIG-BOUNDARY-002). A missing or blank value
// must abort the import with the canonical missing-variable error instead of
// reaching the driver as `undefined`.
async function expectSeedRefusesBlankUrl(modulePath: string): Promise<void> {
  vi.stubEnv("DATABASE_URL", "");
  await expect(import(modulePath)).rejects.toThrow(
    "Missing required environment variable: DATABASE_URL",
  );
}

describe("seed entrypoint environment boundary", () => {
  it("seed.ts refuses a blank DATABASE_URL", async () => {
    await expectSeedRefusesBlankUrl("./seed.js");
  });

  it("seed-simple.ts refuses a blank DATABASE_URL", async () => {
    await expectSeedRefusesBlankUrl("./seed-simple.js");
  });
});
