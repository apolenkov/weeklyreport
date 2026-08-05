## Why

Lead Chat returns “No matching report records” for every question on a freshly intended demo environment because the seeded canonical current report can age past newer section-less `open` rows, while published demo reports contain empty or missing immutable snapshots. The retrieval implementation then correctly fails closed even though older live section rows contain report content.

This was reproduced against the local middle-tier dataset: canonical selection chose Week 32 without a caller section, Week 29 exposed `sections: []`, and forcing the same retrieval pipeline over the populated Week 30 source produced 66 authorized candidates. See `prisma/seed-simple.ts`, `prisma/seed-demo.ts`, `apps/api/src/modules/search/domain/period-source-selection.ts`, and `openspec/changes/add-native-lead-report-assistant/specs/authorized-report-retrieval/spec.md`.

## What Changes

- Make assistant-facing demo seeds produce one populated canonical current live report for the primary Lead and populated immutable snapshots for the supported recent published reports.
- Prevent preview/future seeded periods from silently becoming a newer searchable current report without Lead sections when a local database remains running across calendar weeks.
- Build seeded snapshots through the canonical assembled-report/snapshot path after their section content exists instead of maintaining hand-written empty JSON.
- Add coverage assertions and PostgreSQL integration/smoke tests that exercise the real seed-to-repository-to-authorization-to-candidate path.
- Document reseed expectations and a safe local recovery command for databases created by the defective fixtures.

Non-goals:

- Changing SearchPlan, Mistral prompts/models, semantic ranking, embeddings, or pgvector.
- Falling back to an older report after ACL removes the canonical current report.
- Reading mutable live rows for published reports or weakening Lead authorization.
- Repairing production report data through destructive reset or migration-time content synthesis.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `demo-seed-datasets`: Demo tiers must remain usable by Lead Chat and published-snapshot readers for the lifetime and history they advertise.
- `seed-determinism`: Seed completion must verify assistant-retrieval readiness, including populated canonical current content and canonical immutable snapshots.

## Impact

Primarily affects `prisma/seed.ts`, `prisma/seed-simple.ts`, `prisma/seed-demo.ts`, supported seed command orchestration, shared seed helpers/coverage assertions, and focused API integration tests. The canonical assistant retrieval contracts, tRPC/UI contracts, database schema, migrations, production write paths, and external API configuration remain unchanged. Existing non-production databases require an explicit reseed to receive corrected data; production databases must not be reset.
