import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  findRepoRoot,
  runtimeDatabaseSetupMode,
  selectedSeedProfile,
} from "./global-setup.js";

describe("findRepoRoot", () => {
  it("walks up from e2e/integration to the repo root", () => {
    const expectedRoot = path.resolve(import.meta.dirname, "../..");

    expect(findRepoRoot(import.meta.dirname)).toBe(expectedRoot);
  });

  it("throws a descriptive error instead of guessing when no ancestor has a package.json", () => {
    const orphan = mkdtempSync(path.join(tmpdir(), "find-repo-root-test-"));
    try {
      expect(() => findRepoRoot(orphan)).toThrow(
        /no ancestor of .* contains a package\.json/,
      );
    } finally {
      rmSync(orphan, { recursive: true, force: true });
    }
  });
});

describe("integration global setup profile selection", () => {
  it("uses the runtime sweep profile when it is the only profile", () => {
    expect(selectedSeedProfile({ RUNTIME_SWEEP_PROFILE: "minimal" })).toBe(
      "minimal",
    );
  });

  it("uses the integration profile when no runtime sweep is active", () => {
    expect(selectedSeedProfile({ E2E_SEED_PROFILE: "stress" })).toBe("stress");
  });

  it("rejects conflicting profile selectors before touching the database", () => {
    expect(() =>
      selectedSeedProfile({
        RUNTIME_SWEEP_PROFILE: "minimal",
        E2E_SEED_PROFILE: "full",
      }),
    ).toThrow(/must match/iu);
  });

  it("defaults to full for the integration configuration", () => {
    expect(selectedSeedProfile({})).toBe("full");
  });
});

describe("runtime database reuse", () => {
  it("requires explicit true before using data-only profile reseeding", () => {
    expect(runtimeDatabaseSetupMode({})).toBe("schema+seed");
    expect(
      runtimeDatabaseSetupMode({ RUNTIME_SWEEP_REUSE_DATABASE: "false" }),
    ).toBe("schema+seed");
    expect(
      runtimeDatabaseSetupMode({ RUNTIME_SWEEP_REUSE_DATABASE: "true" }),
    ).toBe("profile-reseed");
  });

  it("rejects a misspelled reuse value", () => {
    expect(() =>
      runtimeDatabaseSetupMode({ RUNTIME_SWEEP_REUSE_DATABASE: "yes" }),
    ).toThrow(/must be true or false/iu);
  });
});
