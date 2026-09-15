import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { OUTCOME_STAGE } from "./item-outcome.integration.fixtures.js";

const operationalSource = readFileSync(
  new URL("./item-outcome.operational.integration.test.ts", import.meta.url),
  "utf8",
);

describe("item outcome operational fixture ownership", () => {
  it("keeps a foreign Development stage and its links outside cleanup scope", () => {
    expect(OUTCOME_STAGE.name).not.toBe("Development");

    const stageCleanup = operationalSource
      .split("await prisma.stage.deleteMany(")[1]
      ?.split(");\n  await prisma.groupProduct")[0];

    expect(stageCleanup).toContain("where: { id: OUTCOME_STAGE.id }");
    expect(stageCleanup).not.toMatch(/\b(?:name|OR)\b/u);
  });
});
