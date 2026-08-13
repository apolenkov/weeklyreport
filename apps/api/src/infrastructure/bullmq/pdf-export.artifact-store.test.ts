import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createDefaultPdfArtifactStore,
  type PdfArtifactAttempt,
} from "./pdf-export.processor.js";

const JOB_ID = "11111111-1111-4111-8111-111111111111";

function expectedChecksum(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("default PDF artifact store", () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), "pdf-artifact-store-"));
  });

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it("publishes first-writer-wins bytes and cleanup leaves the canonical file", async () => {
    const store = createDefaultPdfArtifactStore();
    const winner = Buffer.from("winner-bytes");
    const loser = Buffer.from("loser-bytes");
    const winnerAttempt = await store.createAttempt(outputDir, JOB_ID, winner);
    const loserAttempt = await store.createAttempt(outputDir, JOB_ID, loser);

    const winnerChecksum = await store.publishAndHash(winnerAttempt);
    const loserChecksum = await store.publishAndHash(loserAttempt);
    await store.cleanupAttempt(loserAttempt);
    await store.cleanupAttempt(winnerAttempt);

    expect(winnerChecksum).toBe(expectedChecksum(winner));
    expect(loserChecksum).toBe(expectedChecksum(winner));
    await expect(readFile(join(outputDir, `${JOB_ID}.pdf`))).resolves.toEqual(
      winner,
    );
  });

  it("adopts a canonical file left by a crash before completion CAS", async () => {
    const store = createDefaultPdfArtifactStore();
    const published = Buffer.from("published-before-crash");
    const firstAttempt = await store.createAttempt(
      outputDir,
      JOB_ID,
      published,
    );
    await store.publishAndHash(firstAttempt);
    await store.cleanupAttempt(firstAttempt);

    const retryAttempt = await store.createAttempt(
      outputDir,
      JOB_ID,
      Buffer.from("retry-bytes"),
    );
    const checksum = await store.publishAndHash(retryAttempt);
    await store.cleanupAttempt(retryAttempt);

    expect(checksum).toBe(expectedChecksum(published));
    await expect(readFile(join(outputDir, `${JOB_ID}.pdf`))).resolves.toEqual(
      published,
    );
  });

  it("rejects an existing symlink without following or unlinking it", async () => {
    const store = createDefaultPdfArtifactStore();
    const outsidePath = join(outputDir, "outside.pdf");
    const attempt = await store.createAttempt(
      outputDir,
      JOB_ID,
      Buffer.from("attempt-bytes"),
    );
    await writeFile(outsidePath, "outside-bytes");
    await symlink(outsidePath, attempt.canonicalPath);

    await expect(store.publishAndHash(attempt)).rejects.toMatchObject({
      code: "ELOOP",
    });
    await store.cleanupAttempt(attempt);

    await expect(readFile(outsidePath, "utf8")).resolves.toBe("outside-bytes");
    await expect(readFile(attempt.canonicalPath, "utf8")).resolves.toBe(
      "outside-bytes",
    );
  });

  it("rejects an existing directory at the canonical path", async () => {
    const store = createDefaultPdfArtifactStore();
    const attempt = await store.createAttempt(
      outputDir,
      JOB_ID,
      Buffer.from("attempt-bytes"),
    );
    await rm(attempt.canonicalPath, { force: true });
    await import("node:fs/promises").then(({ mkdir }) =>
      mkdir(attempt.canonicalPath),
    );

    await expect(store.publishAndHash(attempt)).rejects.toThrow(
      "not a regular file",
    );
    await store.cleanupAttempt(attempt);
  });

  it("keeps temp ownership explicit for cleanup after a terminal conflict", async () => {
    const store = createDefaultPdfArtifactStore();
    const attempt = await store.createAttempt(
      outputDir,
      JOB_ID,
      Buffer.from("winner-bytes"),
    );
    const canonical: PdfArtifactAttempt = {
      tempPath: attempt.tempPath,
      canonicalPath: attempt.canonicalPath,
    };
    await store.publishAndHash(canonical);
    await store.cleanupAttempt(canonical);

    await expect(readFile(canonical.canonicalPath, "utf8")).resolves.toBe(
      "winner-bytes",
    );
  });
});
