## Why

Two concurrent PDF workers can currently write the shared `${jobId}.pdf` path
before either terminal-state CAS completes. A losing worker can then delete or
overwrite bytes that belong to the winning completion, while malformed calls
can still write terminal metadata. This is a correctness gap in the existing
PDF lifecycle contract, now that repository terminal transitions are guarded.

## What Changes

- Fail closed before any completion write unless the domain job is `completed`
  with non-null, valid artifact URL and checksum metadata.
- Keep terminal transitions atomic: missing-job failure is an error; losing
  completed/failed races are idempotent no-ops; identical completion is safe.
- Give each PDF attempt a unique same-directory temporary path, publish the
  canonical `${jobId}.pdf` path without replacement, verify canonical bytes,
  and persist the checksum of those immutable bytes.
- Clean up only attempt-owned temporary files; never remove a canonical file
  after a terminal conflict or idempotent retry.
- Add deterministic repository/processor tests for byte interleavings,
  publish-before-CAS retry adoption, failure-after-publish, EEXIST/symlink
  rejection, missing rows, and winner preservation.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `pdf-export-integrity`: terminal PDF artifact publication and persistence
  must remain immutable and coherent under concurrent workers and retries.

## Impact

- `apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts` and its
  tests gain fail-closed terminal persistence and explicit missing/idempotent
  race semantics.
- `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts` and focused
  tests gain same-directory attempt publication, durable verification, and
  ownership-safe cleanup.
- No Prisma schema, database migration, Redis, API contract, or product URL
  change is required.

## Non-goals

- No content-addressed URL redesign or public artifact URL change.
- No database schema rewrite, reset, migration, Redis change, UI change, or
  queue policy change.
- No broad PDF renderer refactor beyond the smallest injectable filesystem
  seam needed to test the race protocol.
