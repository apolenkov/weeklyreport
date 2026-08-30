import { describe, expect, it } from "vitest";

import {
  assertManifestLadder,
  parseSeedProfile,
  SEED_PROFILE_MANIFESTS,
  SEED_PROFILES,
} from "./seed-profile-contract.js";

describe("seed profile contract", () => {
  it("accepts exactly the four canonical names", () => {
    expect(SEED_PROFILES.map((profile) => parseSeedProfile(profile))).toEqual(
      SEED_PROFILES,
    );
  });

  it.each([undefined, "", "small", "middle", "huge", "FULL"])(
    "rejects missing and unsupported profile %s",
    (profile) => {
      expect(() => parseSeedProfile(profile)).toThrow(
        "Use exactly one of: minimal, demo, full, stress",
      );
    },
  );

  it("forms a strict monotonic capability ladder", () => {
    expect(() => assertManifestLadder()).not.toThrow();
  });

  it("increases volume for stress without dropping full capabilities", () => {
    const full = SEED_PROFILE_MANIFESTS.full;
    const stress = SEED_PROFILE_MANIFESTS.stress;

    expect(stress.counts.projects.min).toBeGreaterThan(
      full.counts.projects.min,
    );
    expect(stress.counts.items.min).toBeGreaterThan(full.counts.items.min);
    expect(stress.capabilities).toEqual(
      expect.arrayContaining([...full.capabilities]),
    );
  });

  it("owns stable identifiers and bounded counts for every profile", () => {
    for (const profile of SEED_PROFILES) {
      const manifest = SEED_PROFILE_MANIFESTS[profile];
      expect(Object.keys(manifest.stableIds).length).toBeGreaterThan(0);
      const bounds = Object.values(manifest.counts) as readonly {
        min: number;
        max: number;
      }[];
      for (const bound of bounds) {
        expect(bound.min).toBeGreaterThanOrEqual(0);
        expect(bound.max).toBeGreaterThanOrEqual(bound.min);
      }
    }
  });
});
