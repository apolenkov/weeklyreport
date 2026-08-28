import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { findRepoRoot, selectedSeedProfile } from "./global-setup.js";

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
  it("uses the explicit integration profile", () => {
    expect(selectedSeedProfile({ E2E_SEED_PROFILE: "stress" })).toBe("stress");
  });

  it("defaults to full for the integration configuration", () => {
    expect(selectedSeedProfile({})).toBe("full");
  });
});
