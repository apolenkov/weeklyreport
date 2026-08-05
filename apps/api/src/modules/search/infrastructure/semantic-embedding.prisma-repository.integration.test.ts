import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper.js";
import { SemanticEmbeddingPrismaRepository } from "./semantic-embedding.prisma-repository.js";

const prisma = createTestPrisma();
const HASH = "hash-a";
const PROVIDER = "mistral";
const MODEL = "mistral-embed";
const INPUT_VERSION = "1";
const repository = new SemanticEmbeddingPrismaRepository(
  prisma as unknown as PrismaService,
);

type EmbeddingInput = Readonly<{
  contentHash: string;
  provider: string;
  model: string;
  inputVersion: string;
  dimensions: number;
  vector: string;
}>;

const insertEmbedding = async (input: EmbeddingInput): Promise<void> => {
  await prisma.$executeRaw`
    INSERT INTO "SemanticEmbedding"
      ("contentHash", "provider", "model", "inputVersion", "dimensions", "vector", "updatedAt")
    VALUES
      (${input.contentHash}, ${input.provider}, ${input.model}, ${input.inputVersion},
       ${input.dimensions}, ${input.vector}::vector, CURRENT_TIMESTAMP)
  `;
};

const upsertEmbedding = async (input: EmbeddingInput): Promise<void> => {
  await prisma.$executeRaw`
    INSERT INTO "SemanticEmbedding"
      ("contentHash", "provider", "model", "inputVersion", "dimensions", "vector", "updatedAt")
    VALUES
      (${input.contentHash}, ${input.provider}, ${input.model}, ${input.inputVersion},
       ${input.dimensions}, ${input.vector}::vector, CURRENT_TIMESTAMP)
    ON CONFLICT ("contentHash", "provider", "model", "inputVersion")
    DO UPDATE SET
      "dimensions" = EXCLUDED."dimensions",
      "vector" = EXCLUDED."vector",
      "updatedAt" = CURRENT_TIMESTAMP
  `;
};

const embedding = (
  overrides: Partial<EmbeddingInput> = {},
): EmbeddingInput => ({
  contentHash: HASH,
  provider: PROVIDER,
  model: MODEL,
  inputVersion: INPUT_VERSION,
  dimensions: 3,
  vector: "[1,2,3]",
  ...overrides,
});

describe("SemanticEmbedding migration contract", () => {
  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("installs the vector extension before the cache is used", async () => {
    const rows = await prisma.$queryRaw<{ extversion: string }[]>`
      SELECT extversion
      FROM pg_extension
      WHERE extname = 'vector'
    `;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.extversion).toMatch(/^0\./u);
  });

  it("round-trips a vector and its declared dimensions", async () => {
    await insertEmbedding(embedding());

    const rows = await prisma.$queryRaw<
      { contentHash: string; dimensions: number; vector: string }[]
    >`
      SELECT "contentHash", "dimensions", "vector"::text AS "vector"
      FROM "SemanticEmbedding"
    `;

    expect(rows).toEqual([
      { contentHash: HASH, dimensions: 3, vector: "[1,2,3]" },
    ]);
  });

  it("rejects a vector whose length differs from dimensions", async () => {
    await expect(
      insertEmbedding(embedding({ dimensions: 2 })),
    ).rejects.toThrow();

    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM "SemanticEmbedding"
    `;
    expect(rows[0]?.count).toBe(0n);
  });

  it("keeps model and semantic-input versions isolated", async () => {
    await insertEmbedding(embedding());
    await insertEmbedding(embedding({ model: "other-model" }));
    await insertEmbedding(embedding({ inputVersion: "2" }));

    const rows = await prisma.$queryRaw<
      { model: string; inputVersion: string; vector: string }[]
    >`
      SELECT "model", "inputVersion", "vector"::text AS "vector"
      FROM "SemanticEmbedding"
      WHERE "contentHash" = ${HASH}
        AND "provider" = ${PROVIDER}
        AND "model" = ${MODEL}
        AND "inputVersion" = ${INPUT_VERSION}
    `;

    expect(rows).toEqual([
      { model: MODEL, inputVersion: INPUT_VERSION, vector: "[1,2,3]" },
    ]);
  });

  it("upserts one row for a repeated content key", async () => {
    await upsertEmbedding(embedding());
    await upsertEmbedding(embedding({ vector: "[3,2,1]" }));

    const rows = await prisma.$queryRaw<{ count: bigint; vector: string }[]>`
      SELECT COUNT(*) AS count, MIN("vector"::text) AS vector
      FROM "SemanticEmbedding"
      WHERE "contentHash" = ${HASH}
        AND "provider" = ${PROVIDER}
        AND "model" = ${MODEL}
        AND "inputVersion" = ${INPUT_VERSION}
    `;

    expect(rows).toEqual([{ count: 1n, vector: "[3,2,1]" }]);
  });

  it("ranks the complete allowed hash set within the active model scope", async () => {
    await repository.upsert({
      contentHash: "hash-a",
      provider: PROVIDER,
      model: MODEL,
      inputVersion: INPUT_VERSION,
      dimensions: 3,
      vector: [1, 0, 0],
    });
    await repository.upsert({
      contentHash: "hash-b",
      provider: PROVIDER,
      model: MODEL,
      inputVersion: INPUT_VERSION,
      dimensions: 3,
      vector: [0, 1, 0],
    });
    await repository.upsert({
      contentHash: "hash-outside-set",
      provider: PROVIDER,
      model: MODEL,
      inputVersion: INPUT_VERSION,
      dimensions: 3,
      vector: [1, 0, 0],
    });
    await repository.upsert({
      contentHash: "hash-other-model",
      provider: PROVIDER,
      model: "other-model",
      inputVersion: INPUT_VERSION,
      dimensions: 3,
      vector: [1, 0, 0],
    });

    const matches = await repository.rank({
      provider: PROVIDER,
      model: MODEL,
      inputVersion: INPUT_VERSION,
      dimensions: 3,
      queryVector: [1, 0, 0],
      allowedContentHashes: ["hash-a", "hash-b"],
      similarityThreshold: 0.5,
      limit: 10,
    });

    expect(matches.map(({ contentHash }) => contentHash)).toEqual(["hash-a"]);
    expect(matches[0]?.similarity).toBeCloseTo(1);
  });
});
