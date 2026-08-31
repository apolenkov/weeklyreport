import { describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { SemanticEmbeddingPrismaRepository } from "./semantic-embedding.prisma-repository.js";

const scope = {
  provider: "mistral",
  embeddingScopeIdentity: "embedding-identity",
  model: "mistral-embed",
  inputVersion: "report-assistant/v1",
  dimensions: 3,
} as const;

const prismaHarness = (rows: readonly unknown[] = []) => {
  const queryRaw = vi.fn().mockResolvedValue(rows);
  const executeRaw = vi.fn().mockResolvedValue(1);
  return {
    queryRaw,
    executeRaw,
    repository: new SemanticEmbeddingPrismaRepository({
      $queryRaw: queryRaw,
      $executeRaw: executeRaw,
    } as unknown as PrismaService),
  };
};

const templateParts = (call: readonly unknown[]): string => {
  const [template] = call as [TemplateStringsArray];
  return template.join("");
};

describe("SemanticEmbeddingPrismaRepository", () => {
  it("parameterizes the active cache scope and allowed hash set", async () => {
    const harness = prismaHarness([{ contentHash: "hash-a" }]);

    await expect(
      harness.repository.findCachedHashes(scope, ["hash-a", "hash-b"]),
    ).resolves.toEqual(["hash-a"]);

    const [call] = harness.queryRaw.mock.calls;
    expect(templateParts(call ?? [])).not.toContain("hash-a");
    expect(call).toContain("mistral");
    expect(call).toContainEqual(["hash-a", "hash-b"]);
  });

  it("ranks only the allowed hashes with a stable cosine tie-breaker", async () => {
    const harness = prismaHarness([
      { contentHash: "hash-b", similarity: "0.8" },
      { contentHash: "hash-a", similarity: 0.8 },
    ]);

    await expect(
      harness.repository.rank({
        ...scope,
        queryVector: [1, 0, 0],
        allowedContentHashes: ["hash-a", "hash-b"],
        similarityThreshold: 0.55,
        limit: 10,
      }),
    ).resolves.toEqual([
      { contentHash: "hash-b", similarity: 0.8 },
      { contentHash: "hash-a", similarity: 0.8 },
    ]);

    const [call] = harness.queryRaw.mock.calls;
    expect(templateParts(call ?? [])).toContain(
      'ORDER BY distance ASC, "contentHash" ASC',
    );
    expect(call).toContain("[1,0,0]");
    expect(call).toContainEqual(["hash-a", "hash-b"]);
  });

  it("rejects non-finite or dimension-mismatched query vectors before SQL", async () => {
    const harness = prismaHarness();

    await expect(
      harness.repository.rank({
        ...scope,
        queryVector: [1, Number.NaN, 0],
        allowedContentHashes: ["hash-a"],
        similarityThreshold: 0.55,
        limit: 10,
      }),
    ).rejects.toThrow("finite");
    await expect(
      harness.repository.rank({
        ...scope,
        queryVector: [1, 0],
        allowedContentHashes: ["hash-a"],
        similarityThreshold: 0.55,
        limit: 10,
      }),
    ).rejects.toThrow("finite");
    expect(harness.queryRaw).not.toHaveBeenCalled();
  });

  it("parameterizes vector upserts and keeps the cache key explicit", async () => {
    const harness = prismaHarness();

    await harness.repository.upsert({
      ...scope,
      contentHash: "hash-a",
      vector: [1, 0, 0],
    });

    const [call] = harness.executeRaw.mock.calls;
    expect(templateParts(call ?? [])).not.toContain("[1,0,0]");
    expect(call).toContain("hash-a");
    expect(call).toContain("[1,0,0]");
  });
});
