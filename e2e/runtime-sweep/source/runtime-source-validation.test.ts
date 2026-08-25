import { access, rm, writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { buildCampaignSource } from "../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../manifest/manifest-fixture.ts";
import { sha256Hex } from "../support/ids.ts";
import {
  assertValidatedRuntimeSource,
  writeRuntimeSourceValidationReceipt,
} from "./runtime-source-validation.ts";
import { parseSourceArtifact, writeSourceArtifact } from "./source-artifact.ts";

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

describe("canonical runtime source validation", () => {
  it("creates and rechecks an immutable PASS receipt for canonical bytes", async () => {
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

      expect(receiptFile.receipt).toMatchObject({
        artifact: "RUNTIME_SOURCE_VALIDATION",
        version: 1,
        status: "PASS",
        validatedAt: VALIDATED_AT,
        campaignId: expectedSource.campaignId,
        sourceSha: expectedSource.sourceSha,
        sourceTree: expectedSource.sourceTree,
        sourceDigest: expectedSource.sourceDigest,
        planDigest: expectedSource.plan.digest,
      });
      const validated = await assertValidatedRuntimeSource({
        sourcePath,
        receiptPath,
        expectedSource,
        expectedReceiptFileSha256: receiptFile.receiptFileSha256,
      });
      expect(validated.source.sourceDigest).toBe(expectedSource.sourceDigest);
      expect(validated.receipt).toEqual(receiptFile.receipt);
      await expect(
        writeRuntimeSourceValidationReceipt({
          sourcePath,
          receiptPath,
          expectedSource,
          validatedAt: VALIDATED_AT,
        }),
      ).rejects.toThrow("Cannot create immutable campaign manifest");
    });
  });

  it("rejects a manually altered and correctly rehashed campaign before writing a receipt", async () => {
    await withFixture(async ({ input, sourcePath, receiptPath }) => {
      const expectedSource = await buildCampaignSource(
        input,
        fakeManifestGit(),
      );
      const alteredSource = alteredCampaignSource(expectedSource);
      expect(alteredSource.campaignId).not.toBe(expectedSource.campaignId);
      await writeSourceArtifact(sourcePath, alteredSource);

      await expect(
        writeRuntimeSourceValidationReceipt({
          sourcePath,
          receiptPath,
          expectedSource,
          validatedAt: VALIDATED_AT,
        }),
      ).rejects.toThrow("canonical source builder output");
      await expect(access(receiptPath)).rejects.toMatchObject({
        code: "ENOENT",
      });
    });
  });

  it("rejects semantically equivalent whitespace and key-order byte drift", async () => {
    await withFixture(async ({ input, sourcePath, receiptPath }) => {
      const expectedSource = await buildCampaignSource(
        input,
        fakeManifestGit(),
      );
      await writeFile(
        sourcePath,
        `${JSON.stringify(expectedSource, null, 2)}\n`,
        "utf8",
      );

      await expect(
        writeRuntimeSourceValidationReceipt({
          sourcePath,
          receiptPath,
          expectedSource,
          validatedAt: VALIDATED_AT,
        }),
      ).rejects.toThrow("canonical source builder output");
    });
  });

  it("rejects a frozen source after canonical builder inputs change", async () => {
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
      const catalogPath = input.catalogPaths.at(0);
      if (catalogPath === undefined)
        throw new Error("catalog fixture is empty");
      await writeFile(
        catalogPath,
        "role: lead\nroutes:\nchanged: true\n",
        "utf8",
      );
      const rebuilt = await buildCampaignSource(input, fakeManifestGit());

      await expect(
        assertValidatedRuntimeSource({
          sourcePath,
          receiptPath,
          expectedSource: rebuilt,
          expectedReceiptFileSha256: receiptFile.receiptFileSha256,
        }),
      ).rejects.toThrow("canonical source builder output");
    });
  });
});
