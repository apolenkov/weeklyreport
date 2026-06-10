# Consolidate tRPC Infrastructure Duplication

## Why

Two load-bearing contracts in `apps/api/src/infrastructure/trpc/` exist
only as copy-paste, so every change there means editing the same lines
in many places — and missing one is silent. First: 7 of the 8 canonical
procedure builders repeat the verbatim 5-middleware chain
(`trpc.middleware.ts:412-417` for `protectedProcedure`, lines 485-525
for the 6 role builders); friction commits 2626c548, 82dd47a8, and
53f6c983 each had to touch every chain. Second: the 4-step session
hydration chain (`resolveSectionId` → `hydrateViewerGroupAccess` →
`hydrateReportingGroupName` → `hydrateOrganization`) is duplicated at
the regular-session path (`trpc.context.ts:159-162`) and the
dev-session path (lines 219-222) — the exact regular-vs-dev drift
channel behind the D-32 bug noted at lines 15-17.

Three adjacent hygiene drifts, verified at HEAD 3f5be66f: the CI
role-coverage gate (`__tests__/role-coverage.test.ts:76`) lists only 7
builders in `ALLOWED_CHAINS` — `leadershipProcedure` is missing;
`openspec/config.yaml` still says "7 canonical middleware-chain
builders" while spec and code say 8; and the module-level `orgCache`
(`trpc.context.ts:38-46`, 5s TTL) is never reset between vitest cases
in `trpc.context.test.ts`, making future org assertions
order-dependent.

## What Changes

1. Local factory `buildProtectedProcedure(authMiddleware)` in
   `trpc.middleware.ts` defines the 5-middleware chain once; all 8
   export names and middleware identities preserved (see `design.md`).
2. File-local private `hydrateSession(session, prisma)` in
   `trpc.context.ts` composes the 4 existing helpers unchanged; both
   call sites (regular + dev) use it.
3. Gate alignment: `leadershipProcedure` added to `ALLOWED_CHAINS`.
4. Test hygiene: `clearOrgCache()` in `trpc.context.test.ts`
   `beforeEach` (2 lines).
5. Doc-drift fix: `openspec/config.yaml` builder count 7 → 8.

## Non-goals

- `requireRole` deletion in `packages/shared` — captured in the
  `remove-dead-modules` change (zero file overlap with this one).
- Rewriting the gate's prefix-matching semantics — recorded as a
  follow-up candidate, not done here.
- No export, no `HydrationStep` enum, no mocking seam for
  `hydrateSession`; the PDF path and the 4 helpers stay untouched.
- No middleware reordering of any kind.

## Sequencing

Wave 1 — runs after `refactor-test-db-cleanup` lands (integration
suites act as the safety net). Both touched production files live in
`apps/api/src/infrastructure/trpc/` — tasks are strictly sequential,
never run in parallel with each other or with anything else editing
that directory.

## Capabilities

None added or modified — `role-coverage-gate` is a constraint this
change preserves (and the gate test gains the missing 8th builder); no
spec delta required.

## Impact

- `apps/api/src/infrastructure/trpc/trpc.middleware.ts`
- `apps/api/src/infrastructure/trpc/trpc.middleware.test.ts`
- `apps/api/src/infrastructure/trpc/__tests__/role-coverage.test.ts`
- `apps/api/src/infrastructure/trpc/trpc.context.ts`
- `apps/api/src/infrastructure/trpc/trpc.context.test.ts`
- `apps/api/src/infrastructure/trpc/trpc.context.pdf-export.test.ts`
- `openspec/config.yaml` (one line)
- Web client's inferred tRPC types must not shift — workspace
  `pnpm typecheck` is the proof.
