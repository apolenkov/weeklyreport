import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import type { EmbeddingVector } from "../application/report-assistant.ports.js";
import type {
  SemanticEmbeddingRankQuery,
  SemanticEmbeddingRecord,
  SemanticEmbeddingRepository,
  SemanticEmbeddingScope,
} from "../application/semantic-embedding.repository.js";
import type { SemanticEmbeddingMatch } from "../application/semantic-embedding.repository.js";

type HashRow = Readonly<{ contentHash: string }>;
type MatchRow = Readonly<{ contentHash: string; similarity: number | string }>;

const validateScope = (scope: SemanticEmbeddingScope): void => {
  const values = [
    scope.provider,
    scope.embeddingScopeIdentity,
    scope.model,
    scope.inputVersion,
  ];
  if (values.some((value) => value.trim().length === 0)) {
    throw new Error("Semantic embedding scope values must be non-empty");
  }
  if (!Number.isInteger(scope.dimensions) || scope.dimensions < 1) {
    throw new Error("Semantic embedding dimensions must be positive");
  }
};

const validateVector = (
  vector: EmbeddingVector,
  dimensions: number,
  label: string,
): void => {
  // A zero vector has no defined cosine distance and can never rank, so the
  // same nonzero admission rule as the provider boundary applies on write
  // and on query. Checking `some(component !== 0)` after finiteness is
  // sufficient — no sum-of-squares needed.
  if (
    vector.length !== dimensions ||
    vector.some((value) => !Number.isFinite(value)) ||
    !vector.some((value) => value !== 0)
  ) {
    throw new Error(
      `${label} must contain ${dimensions} finite values with a nonzero component`,
    );
  }
};

const validateThreshold = (threshold: number): void => {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error("Semantic similarity threshold must be between 0 and 1");
  }
};

const validateLimit = (limit: number): void => {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Semantic embedding limit must be positive");
  }
};

const vectorLiteral = (vector: EmbeddingVector): string =>
  `[${vector.map(String).join(",")}]`;

const mapMatches = (
  rows: readonly MatchRow[],
): readonly SemanticEmbeddingMatch[] =>
  rows.map((row) => {
    const similarity = Number(row.similarity);
    if (!Number.isFinite(similarity)) {
      throw new TypeError(
        "Semantic embedding query returned a non-finite similarity",
      );
    }
    return { contentHash: row.contentHash, similarity };
  });

@Injectable()
export class SemanticEmbeddingPrismaRepository implements SemanticEmbeddingRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findCachedHashes(
    scope: SemanticEmbeddingScope,
    contentHashes: readonly string[],
  ): Promise<readonly string[]> {
    validateScope(scope);
    if (contentHashes.length === 0) return [];
    const rows = await this.prisma.$queryRaw<HashRow[]>`
      SELECT "contentHash"
      FROM "SemanticEmbedding"
      WHERE "provider" = ${scope.provider}
        AND "model" = ${scope.model}
        AND "inputVersion" = ${scope.inputVersion}
        AND "dimensions" = ${scope.dimensions}
        AND "contentHash" = ANY(${contentHashes}::text[])
    `;
    return rows.map(({ contentHash }) => contentHash);
  }

  async upsert(input: SemanticEmbeddingRecord): Promise<void> {
    validateScope(input);
    validateVector(input.vector, input.dimensions, "Embedding vector");
    await this.prisma.$executeRaw`
      INSERT INTO "SemanticEmbedding"
        ("contentHash", "provider", "model", "inputVersion", "dimensions", "vector", "updatedAt")
      VALUES
        (${input.contentHash}, ${input.provider}, ${input.model}, ${input.inputVersion},
         ${input.dimensions}, CAST(${vectorLiteral(input.vector)} AS vector), CURRENT_TIMESTAMP)
      ON CONFLICT ("contentHash", "provider", "model", "inputVersion", "dimensions")
      DO UPDATE SET
        "vector" = EXCLUDED."vector",
        "updatedAt" = CURRENT_TIMESTAMP
    `;
  }

  async rank(
    input: SemanticEmbeddingRankQuery,
  ): Promise<readonly SemanticEmbeddingMatch[]> {
    validateScope(input);
    validateVector(input.queryVector, input.dimensions, "Query vector");
    validateThreshold(input.similarityThreshold);
    validateLimit(input.limit);
    if (input.allowedContentHashes.length === 0) return [];
    const rows = await this.prisma.$queryRaw<MatchRow[]>`
      WITH candidates AS (
        SELECT "contentHash", "vector" <=> CAST(${vectorLiteral(input.queryVector)} AS vector) AS distance
        FROM "SemanticEmbedding"
        WHERE "provider" = ${input.provider}
          AND "model" = ${input.model}
          AND "inputVersion" = ${input.inputVersion}
          AND "dimensions" = ${input.dimensions}
          AND "contentHash" = ANY(${input.allowedContentHashes}::text[])
      )
      SELECT "contentHash", 1 - distance AS similarity
      FROM candidates
      WHERE 1 - distance >= ${input.similarityThreshold}
      ORDER BY distance ASC, "contentHash" ASC
      LIMIT ${input.limit}
    `;
    return mapMatches(rows);
  }
}
