import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  INFRASTRUCTURE_FAULT_DECLARATIONS,
  INFRASTRUCTURE_FAULT_IDS,
} from "./infrastructure-fault-declarations.ts";

const EXPECTED_FAULT_IDS = [
  "rate-limit-redis-unavailable",
  "smtp-transport-unavailable",
  "pdf-queue-unavailable",
] as const;

const workspaceRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

describe("infrastructure fault declarations", () => {
  it("declares exactly the proven Redis, SMTP, and PDF seams once", () => {
    const faultIds = INFRASTRUCTURE_FAULT_DECLARATIONS.map(
      ({ faultId }) => faultId,
    );

    expect(INFRASTRUCTURE_FAULT_IDS).toEqual(EXPECTED_FAULT_IDS);
    expect(faultIds).toEqual(EXPECTED_FAULT_IDS);
    expect(new Set(faultIds).size).toBe(EXPECTED_FAULT_IDS.length);
    faultIds.forEach((faultId) => {
      expect(faultId).toMatch(/^[a-z0-9][a-z0-9._-]*$/u);
    });
  });

  it("keeps declarations immutable and tied to real test cases", () => {
    expect(Object.isFrozen(INFRASTRUCTURE_FAULT_DECLARATIONS)).toBe(true);

    INFRASTRUCTURE_FAULT_DECLARATIONS.forEach((declaration) => {
      expect(Object.isFrozen(declaration)).toBe(true);
      expect(declaration.testFile).not.toMatch(/^\.?\//u);
      expect(declaration.testFile).not.toContain("browser");
      expect(existsSync(resolve(workspaceRoot, declaration.testFile))).toBe(
        true,
      );

      const source = readFileSync(
        resolve(workspaceRoot, declaration.testFile),
        "utf8",
      );
      expect(source).toContain(`"${declaration.testName}"`);
    });
  });

  it("requires operation and all three scoped oracles", () => {
    INFRASTRUCTURE_FAULT_DECLARATIONS.forEach((declaration) => {
      expect(declaration.subsystem.trim()).not.toBe("");
      expect(declaration.operation.trim()).not.toBe("");
      expect(declaration.cleanupOracle.trim()).not.toBe("");
      expect(declaration.nonMutationOracle.trim()).not.toBe("");
      expect(declaration.recoveryOracle.trim()).not.toBe("");
    });
  });
});
