BEGIN;

-- Invalidate cached zero-norm embeddings: cosine distance is undefined for a
-- zero vector, so these rows can never produce a valid ranking. The affected
-- content hashes are rebuilt through the existing read-through/preparation
-- path; no other cache row is touched.
DELETE FROM "SemanticEmbedding" WHERE vector_norm("vector") = 0;

-- Database mirror of the application admission rule: a cosine vector must
-- have at least one nonzero component, so a poisoned row can never persist.
ALTER TABLE "SemanticEmbedding"
  ADD CONSTRAINT "SemanticEmbedding_vector_nonzero_check"
  CHECK (vector_norm("vector") > 0);

COMMIT;
