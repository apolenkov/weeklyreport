import { access, link, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createManifestFixture,
  fakeManifestGit,
} from "../manifest/manifest-fixture.ts";
import {
  cleanSourceIdentity,
  cleanTreeDigest,
  writeAtomicManifestPair,
} from "./manifest-source.ts";

describe("atomic runtime artifact publication", () => {
  it("rolls back MATRIX when MANIFEST publication fails", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-pair-"));
    const matrixPath = path.join(root, "MATRIX.json");
    const manifestPath = path.join(root, "MANIFEST.json");
    const publishFile = async (
      oldPath: string,
      newPath: string,
    ): Promise<void> => {
      if (oldPath.endsWith("MANIFEST.json"))
        throw new Error("manifest publication failed");
      await link(oldPath, newPath);
    };
    try {
      await expect(
        writeAtomicManifestPair(
          {
            matrixPath,
            matrixText: "matrix",
            manifestPath,
            manifestText: "manifest",
          },
          publishFile,
        ),
      ).rejects.toThrow("manifest publication failed");
      await expect(access(matrixPath)).rejects.toThrow();
      await expect(access(manifestPath)).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("never overwrites or deletes a concurrently published pair", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-pair-race-"));
    const input = {
      matrixPath: path.join(root, "MATRIX.json"),
      manifestPath: path.join(root, "MANIFEST.json"),
    };
    try {
      const results = await Promise.allSettled([
        writeAtomicManifestPair({
          ...input,
          matrixText: "matrix-a",
          manifestText: "manifest-a",
        }),
        writeAtomicManifestPair({
          ...input,
          matrixText: "matrix-b",
          manifestText: "manifest-b",
        }),
      ]);
      expect(
        results.filter(({ status }) => status === "fulfilled"),
      ).toHaveLength(1);
      const [matrix, manifest] = await Promise.all([
        readFile(input.matrixPath, "utf8"),
        readFile(input.manifestPath, "utf8"),
      ]);
      expect(["matrix-a:manifest-a", "matrix-b:manifest-b"]).toContain(
        `${matrix}:${manifest}`,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("clean source identity", () => {
  it("keeps cleanTreeDigest as a digest-only compatibility wrapper", async () => {
    const fixture = await createManifestFixture();
    try {
      const identity = await cleanSourceIdentity(
        fixture.input,
        fakeManifestGit(),
      );
      await expect(
        cleanTreeDigest(fixture.input, fakeManifestGit()),
      ).resolves.toBe(identity.treeDigest);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
});
