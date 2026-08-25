import { describe, expect, it } from "vitest";

import { manifestDigestFor } from "./product-variant-hash.ts";
import {
  generateProductVariantManifest,
  readAndGenerateProductVariantManifest,
  validateProductVariantManifest,
} from "./product-variant-manifest.ts";
import { readProductVariantSource } from "./product-variant-source.ts";

const repoRoot = new URL("../../", import.meta.url).pathname.replace(
  /\/$/u,
  "",
);

const copyOf = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const rehashed = <T extends Parameters<typeof manifestDigestFor>[0]>(
  candidate: T,
): T => ({ ...candidate, manifestDigest: manifestDigestFor(candidate) });

describe("product-variant reconciliation binding", () => {
  it.each([
    "omitted",
    "tampered historical ID",
    "tampered historical source",
    "tampered reconciliation status",
  ] as const)("rejects %s historical reconciliation", async (kind) => {
    const source = await readProductVariantSource(repoRoot);
    const manifest = generateProductVariantManifest(source);

    if (kind === "omitted") {
      const candidate = { ...copyOf(manifest) } as Record<string, unknown>;
      delete candidate.historicalReconciliation;
      const validation = validateProductVariantManifest(candidate, source);
      expect(validation.valid).toBe(false);
      return;
    }

    const candidate = copyOf(manifest);
    if (kind === "tampered historical ID") {
      const variantIds = [
        ...candidate.historicalReconciliation.historicalInventory.variantIds,
      ];
      variantIds[0] = "R99";
      candidate.historicalReconciliation = {
        ...candidate.historicalReconciliation,
        historicalInventory: {
          ...candidate.historicalReconciliation.historicalInventory,
          variantIds,
        },
      };
    } else if (kind === "tampered historical source") {
      candidate.historicalReconciliation = {
        ...candidate.historicalReconciliation,
        source: {
          ...candidate.historicalReconciliation.source,
          sourceSha: "a".repeat(40),
        },
      };
    } else {
      const malformed = {
        ...candidate,
        historicalReconciliation: {
          ...candidate.historicalReconciliation,
          status: "PASS",
        },
      };
      const validation = validateProductVariantManifest(malformed, source);
      expect(validation.valid).toBe(false);
      return;
    }

    const validation = validateProductVariantManifest(
      rehashed(candidate),
      source,
    );
    expect(validation.valid).toBe(false);
    expect(validation.issues).toContain(
      "manifest does not match canonical manifest reconstructed from current source",
    );
  });

  it("fails closed before generation when Git source is dirty", async () => {
    const dirtyGit = (args: readonly string[]): Promise<string> => {
      if (args[0] === "status")
        return Promise.resolve(" M e2e/product-variants/source.ts\n");
      return Promise.reject(new Error("git must stop after dirty status"));
    };

    await expect(
      readAndGenerateProductVariantManifest(repoRoot, undefined, dirtyGit),
    ).rejects.toThrow("source worktree is not clean");
  });

  it("rejects a clean source identity switch during read", async () => {
    const initialSha = "a".repeat(40);
    const initialTree = "b".repeat(40);
    const finalSha = "c".repeat(40);
    const finalTree = "d".repeat(40);
    const calls = new Map<string, number>();
    const switchingGit = (args: readonly string[]): Promise<string> => {
      if (args[0] === "status") return Promise.resolve("");
      const command = args.join(" ");
      const call = (calls.get(command) ?? 0) + 1;
      calls.set(command, call);
      if (command === "rev-parse --verify HEAD")
        return Promise.resolve(`${call === 1 ? initialSha : finalSha}\n`);
      if (command === "rev-parse --verify HEAD^{tree}")
        return Promise.resolve(`${call === 1 ? initialTree : finalTree}\n`);
      return Promise.reject(new Error(`unexpected Git command: ${command}`));
    };

    await expect(
      readProductVariantSource(repoRoot, switchingGit),
    ).rejects.toThrow("source identity changed during read");
  });
});
