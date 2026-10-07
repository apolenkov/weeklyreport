import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "./20261007120000_semantic_embedding_nonzero_vector/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("semantic embedding nonzero-vector migration", () => {
  it("removes only zero-norm cache rows before enforcing the CHECK", () => {
    expect(migration).toContain(
      'DELETE FROM "SemanticEmbedding" WHERE vector_norm("vector") = 0',
    );
    expect(migration.indexOf("DELETE")).toBeLessThan(
      migration.indexOf("ALTER TABLE"),
    );
    expect(migration).not.toMatch(/\b(?:UPDATE|TRUNCATE|DROP)\b/u);
  });

  it("adds one transactional vector_norm CHECK", () => {
    expect(migration).toContain(
      'ADD CONSTRAINT "SemanticEmbedding_vector_nonzero_check"',
    );
    expect(migration).toContain('CHECK (vector_norm("vector") > 0)');
    expect(migration).toMatch(/^BEGIN;[\s\S]*COMMIT;\s*$/u);
  });
});
