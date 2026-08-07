## 1. API Snapshot Finalization and Readiness

- [x] 1.1 Add focused failing tests for an API-owned non-production seed snapshot finalizer: it must freeze populated published sections through the existing publication include/mapper/serializer, preserve deterministic section ordering, reject an unknown or non-published target, and produce no publication/notification/AI side effects.
- [x] 1.2 Implement the small API-owned finalizer and CLI entry point by reusing `reportFullIncludeForSnapshot`, `buildAssembledReportFromPrismaRow`, and `toPublishedSnapshotJson`; keep production files within the exemplary line/function/complexity limits and expose no new HTTP/tRPC surface.
- [x] 1.3 Add a privacy-safe seed-readiness checker over the real report-search repository, authorization, and candidate projector that fails non-zero for a missing caller section, zero candidates, null/empty/invalid advertised snapshots, or duplicate occurrence identities without logging report text.
- [x] 1.4 Add PostgreSQL integration coverage for freshly seeded current retrieval, current selection with a clock advanced into the latest preview period, populated published-snapshot retrieval, and post-snapshot live-row drift; keep planner/answer deterministic and make no Mistral or embedding request.

## 2. Prisma Seed Data

- [x] 2.1 Refactor `prisma/seed.ts`, `prisma/seed-simple.ts`, and `prisma/seed-demo.ts` so relational report/section/record content is complete before snapshot finalization, removing hand-written `sections: []` snapshots and intentional null snapshots from advertised populated published fixtures.
- [x] 2.2 Give every scheduled/future report retained by the applicable demo tiers a deterministic primary-Lead section and minimal valid report content that projects at least one candidate when that period later becomes eligible; allocate collision-free period-scoped IDs and preserve existing tier showcases.
- [x] 2.3 Extend shared seed coverage assertions for canonical primary-Lead ownership, non-empty current/future candidate coverage, populated advertised history, and stable identifiers; keep the canonical status and existing fixture assertions intact.
- [x] 2.4 Add seed-focused unit tests proving same-week idempotence and deterministic IDs/content across repeated canonical, small, middle, and huge fixture construction.

## 3. Supported Seed Orchestration

- [x] 3.1 Introduce one supported orchestration path that runs relational seeding, API-owned snapshot finalization, and assistant-readiness verification in order and exits non-zero when any phase fails.
- [x] 3.2 Route `prisma.config.ts`, root `db:seed:*`/`db:fresh:*` commands, the dev wipe-and-reseed procedure, CI seed jobs, and E2E global setup through that orchestration so no supported path can silently bypass finalization.
- [x] 3.3 Preserve the destructive database guard and explicit environment handling in every orchestration entry point; prove production-looking database URLs are refused and do not add a schema migration or production data rewrite.

## 4. Recovery and Regression Documentation

- [x] 4.1 Update the curated developer/deployment documentation with the corrected supported seed commands, the reason raw seed entry points are internal, and the exact destructive-guarded local/UAT reset-and-reseed recovery for databases created by the defective fixtures; state explicitly that production must not be reset.
- [x] 4.2 Exercise each supported tier on disposable non-production databases and record sanitized evidence that the canonical Lead receives candidates from current live data and each advertised published snapshot while existing head/period-switch demo flows remain non-empty.

## 5. Verification

- [x] 5.1 Run focused seed, publication snapshot, report-search repository, authorized-retrieval, and new readiness tests, including the controlled-clock aging regression and published-live-drift regression.
- [ ] 5.2 Run `pnpm --filter @customreport/api db:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm --filter @customreport/api test:integration`, and `pnpm test:e2e:integration`; record exact results and leave zero warnings or lint exemptions in changed production files.
- [ ] 5.3 Boot API and web from source against a corrected local seed, use the canonical Lead to smoke-test broad exact/count questions over current and published periods, confirm existing save/submit/publish/search/PDF paths remain healthy, and record whether the configured real Mistral provider was used only for this manual smoke.
- [x] 5.4 Run `openspec validate fix-lead-assistant-seed-retrieval --type change --strict --no-interactive`, reconcile implementation against both delta specs, and leave the change ready for review without archiving it.
