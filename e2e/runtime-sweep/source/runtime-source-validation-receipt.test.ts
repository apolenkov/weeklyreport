import { readFile, rm, writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { buildCampaignSource } from "../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../manifest/manifest-fixture.ts";
import { sha256Hex, stableSerialize } from "../support/ids.ts";
import {
  assertValidatedRuntimeSource,
  writeRuntimeSourceValidationReceipt,
} from "./runtime-source-validation.ts";
import {
  createRuntimeSourceValidationReceipt,
  serializeRuntimeSourceValidationReceipt,
} from "./runtime-source-validation-contract.ts";
import {
  parseSourceArtifact,
  serializeSourceArtifact,
  writeSourceArtifact,
} from "./source-artifact.ts";

const VALIDATED_AT = "2026-08-24T00:00:00.000Z";

async function withFixture(
  callback: (
    fixture: Awaited<ReturnType<typeof createManifestFixture>> & {
      readonly sourcePath: string;
      readonly receiptPath: string;
    },
  ) => Promise<void>,
): Promise<void> {
  const fixture = await createManifestFixture();
  const sourcePath = fixture.input.sourcePath;
  const receiptPath = fixture.input.sourceValidationPath;
  if (sourcePath === undefined || receiptPath === undefined)
    throw new Error("Source validation fixture paths are required");
  try {
    await callback({ ...fixture, sourcePath, receiptPath });
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
}

const alteredCampaignSource = (
  source: Awaited<ReturnType<typeof buildCampaignSource>>,
) => {
  const { sourceDigest: _sourceDigest, ...body } = source;
  const alteredBody = { ...body, campaignId: "manually-altered-campaign" };
  return parseSourceArtifact({
    ...alteredBody,
    sourceDigest: sha256Hex(alteredBody),
  });
};

describe("runtime source validation receipt authority", () => {
  it("rejects missing, tampered, rehashed, and foreign receipts", async () => {
    await withFixture(async ({ input, sourcePath, receiptPath }) => {
      const expectedSource = await buildCampaignSource(
        input,
        fakeManifestGit(),
      );
      await writeSourceArtifact(sourcePath, expectedSource);
      await expect(
        assertValidatedRuntimeSource({
          sourcePath,
          receiptPath,
          expectedSource,
          expectedReceiptFileSha256: "0".repeat(64),
        }),
      ).rejects.toThrow("Cannot read SOURCE-VALIDATION.json");

      const receiptFile = await writeRuntimeSourceValidationReceipt({
        sourcePath,
        receiptPath,
        expectedSource,
        validatedAt: VALIDATED_AT,
      });
      await writeFile(
        receiptPath,
        `${stableSerialize({
          ...receiptFile.receipt,
          sourceFileSha256: "f".repeat(64),
        })}\n`,
        "utf8",
      );
      await expect(
        assertValidatedRuntimeSource({
          sourcePath,
          receiptPath,
          expectedSource,
          expectedReceiptFileSha256: receiptFile.receiptFileSha256,
        }),
      ).rejects.toThrow("digest does not match contents");

      const { receiptDigest: _receiptDigest, ...body } = receiptFile.receipt;
      const foreign = createRuntimeSourceValidationReceipt({
        ...body,
        campaignId: "foreign-campaign",
      });
      await writeFile(
        receiptPath,
        serializeRuntimeSourceValidationReceipt(foreign),
        "utf8",
      );
      await expect(
        assertValidatedRuntimeSource({
          sourcePath,
          receiptPath,
          expectedSource,
          expectedReceiptFileSha256: receiptFile.receiptFileSha256,
        }),
      ).rejects.toThrow("file SHA does not match external authority");
    });
  });

  it("rejects a changed validatedAt even when the receipt digest is recalculated", async () => {
    await withFixture(async ({ input, sourcePath, receiptPath }) => {
      const expectedSource = await buildCampaignSource(
        input,
        fakeManifestGit(),
      );
      await writeSourceArtifact(sourcePath, expectedSource);
      const receiptFile = await writeRuntimeSourceValidationReceipt({
        sourcePath,
        receiptPath,
        expectedSource,
        validatedAt: VALIDATED_AT,
      });
      const { receiptDigest: _receiptDigest, ...body } = receiptFile.receipt;
      const rehashed = createRuntimeSourceValidationReceipt({
        ...body,
        validatedAt: "2026-08-24T00:01:00.000Z",
      });
      await writeFile(
        receiptPath,
        serializeRuntimeSourceValidationReceipt(rehashed),
        "utf8",
      );

      await expect(
        assertValidatedRuntimeSource({
          sourcePath,
          receiptPath,
          expectedSource,
          expectedReceiptFileSha256: receiptFile.receiptFileSha256,
        }),
      ).rejects.toThrow("file SHA does not match external authority");
    });
  });

  it("rejects source changes made after receipt creation", async () => {
    await withFixture(async ({ input, sourcePath, receiptPath }) => {
      const expectedSource = await buildCampaignSource(
        input,
        fakeManifestGit(),
      );
      await writeSourceArtifact(sourcePath, expectedSource);
      const receiptFile = await writeRuntimeSourceValidationReceipt({
        sourcePath,
        receiptPath,
        expectedSource,
        validatedAt: VALIDATED_AT,
      });
      await writeFile(
        sourcePath,
        serializeSourceArtifact(alteredCampaignSource(expectedSource)),
        "utf8",
      );

      await expect(
        assertValidatedRuntimeSource({
          sourcePath,
          receiptPath,
          expectedSource,
          expectedReceiptFileSha256: receiptFile.receiptFileSha256,
        }),
      ).rejects.toThrow("canonical source builder output");
      expect(await readFile(receiptPath, "utf8")).toContain(
        stableSerialize(expectedSource.sourceDigest),
      );
    });
  });
});
