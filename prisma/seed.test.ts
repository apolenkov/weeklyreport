import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("canonical seed assistant readiness", () => {
  it("checks full readiness after coverage and before reporting the summary", async () => {
    const source = await readFile(
      new URL("./seed.ts", import.meta.url),
      "utf8",
    );
    const coverage = source.indexOf(
      'await assertSeedCoverage(prisma, "seed", SEED_REPORTS.active.id);',
    );
    const readiness = source.indexOf('assertAssistantReadiness("full");');
    const summary = source.indexOf("logSeedSummary({");

    expect(readiness).toBeGreaterThan(coverage);
    expect(readiness).toBeLessThan(summary);
  });
});
