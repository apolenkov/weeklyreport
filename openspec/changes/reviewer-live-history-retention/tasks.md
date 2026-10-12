## 1. Schema and native owner

- [x] 1.1 Change exactly the three review-history user foreign keys to Restrict and add a transactionally applied forward migration.
- [x] 1.2 Add real Prisma/repository integration cases for each reference, deactivation/history preservation and reference-free deletion; do not execute native DB checks in the author scope.

## 2. Scoped author verification

- [x] 2.1 Run existing admin.prisma-repository.test.ts singleton controls, Prisma schema validation and schema-to-schema SQL diff, strict new-test ESLint, scoped actual tsc6, changed-file formatting, strict delta and git diff/reverse-patch checks; record exact commands/exits in the external handoff.
- [x] 2.2 Preserve C0038 original/policy, exact patch and baseline/current source hashes; freeze author checkpoint with native acceptance NE.

## 3. Root native and aggregate acceptance

- [ ] 3.1 Root applies guarded migration/reset/seed and runs admin-reviewer-history.integration.test.ts plus native SQL/reference-race acceptance, then pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build, pnpm spec:check and independent final review.

Backlog execution: TASK-287.03 (Root-owned state).
