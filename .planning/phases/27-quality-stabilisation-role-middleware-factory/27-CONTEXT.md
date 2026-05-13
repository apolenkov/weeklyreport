# Phase 27: Quality Stabilisation & Role Middleware Factory - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning
**Mode:** Auto-generated (smart-discuss infrastructure short-circuit — pure tech-debt + refactor + config phase)

<domain>
## Phase Boundary

Wave 1 of v6.0: stabilise the integration suite as a true CI gate (close v5.0 tech-debt residuals from quick task `260426-vxp`) AND ship the `requireRole` tRPC middleware factory that all subsequent v6.0 phases consume.

**In scope (5 REQ-IDs):**

- QA-01: root-cause + fix of 5 Playwright integration test timeouts
- QA-02: `prisma generate` postinstall hook
- QA-03: delete dead `apps/web/src/proxy.ts`
- QA-04: doc-sync (`_userId` rename + Phase 22 VERIFICATION status flip)
- AUTH-03: `requireRole(allowed)` tRPC middleware factory + default-deny coverage test

**Out of scope (deferred to subsequent phases):**

- Real Keycloak SAML (Phase 29)
- Service-layer role filtering consumers of the new factory (Phase 28)
- PDF cookie injection (Phase 28)
- Frontend role-aware navigation (Phase 29)
- Email reminders, mobile, analytics, AI features

</domain>

<decisions>
## Implementation Decisions

### QA-01 — Investigation Pattern

- **TDD reproduction first:** run ONE failing test in headed mode (`playwright test status-risk-sync --headed --workers 1`) to observe the actual tRPC POST sequence and waitForResponse mismatch BEFORE proposing a fix.
- **Single root cause:** all 5 failures share the same symptom (`TimeoutError: page.waitForResponse 15000ms` on tRPC POST). Treat as one bug, fix once, all 5 should resolve.
- **Working hypotheses (research-derived):** (a) autosave debounce racing the explicit-mutation `waitForResponse` regex; (b) `r.url().includes('/trpc/')` filter matches a parallel mutation, not the expected one; (c) React Compiler changes tRPC URL pattern.
- **Anti-pattern:** Do NOT bandage 5 tests independently. Do NOT "increase timeout to 30s" — that hides the root cause.

### QA-02 — Postinstall Location

- **`apps/api/package.json` (NOT root)** — postinstall scoped to the package that consumes Prisma client. Keeps root install fast for users not touching api.
- Add `prisma generate` as `build` predecessor in `turbo.json` for CI runs that skip postinstall.
- Idempotent — re-running on existing client is a no-op.

### QA-03 — Dead File Deletion

- Path: `apps/web/src/proxy.ts` (verified unused via `grep -rn "from.*src/proxy" apps/web/` → empty).
- Active proxy: `apps/web/proxy.ts` (root of `apps/web`, where Next.js 16 expects).
- **Guard comment in active file:** add `// Next.js 16 proxy.ts must live here, NOT under src/. Phase 27 deleted the dead duplicate at apps/web/src/proxy.ts.` near the top of `apps/web/proxy.ts`.
- **CC-6 mitigation:** explicit path naming in commit message + comment in active file prevents future re-creation under `src/` that would silently kill auth.

### QA-04 — Doc-Sync

- `apps/api/src/modules/period/period.contract.test.ts:65` — rename `userId` → `_userId` (TS6133 unused-param convention, deferred 4× through v5.0).
- `.planning/phases/22-*/22-VERIFICATION.md` frontmatter — flip `status: gaps_found` → `status: passed` (commit `69f6527` already closed the gaps; doc lag).

### AUTH-03 — Middleware Factory Location

- **`packages/shared/src/trpc/middleware/role.ts`** (NOT in `apps/api`) — the factory is a pure tRPC middleware over the existing `t` instance and shares types with the shared schema layer; placement in `packages/shared/` keeps tRPC procedure definitions co-located with their input schemas.
- **Exports:** `requireRole(allowed: Role[])` factory, plus `leadProcedure` / `headProcedure` / `adminProcedure` / `viewerProcedure` named procedures derived from it.
- **`adminProcedure === headProcedure`** for v6.0 (admin/head not yet split — research recommendation; reserve the keyword).
- **Refactor target:** the inline `isHead` check at `apps/api/src/infrastructure/trpc/trpc.middleware.ts:71-81` becomes `export const headProcedure = requireRole(['head'])` re-export.
- **Default-deny coverage test:** new test file `apps/api/src/infrastructure/trpc/__tests__/role-coverage.test.ts` — iterates the AppRouter and asserts every leaf procedure has either `publicProcedure` or one of the role-bound `*Procedure` exports as its base. Fails CI if any procedure is built directly on `t.procedure` without role declaration.
- **Backward compatibility:** existing callers of `headProcedure` keep working — only the implementation changes, not the export name. No breaking diff to consumers.

### Phase Sequencing (Internal Ordering)

- QA-04 (doc-sync, 5 lines total) — first, lowest blast radius, atomic commit.
- QA-03 (delete dead file + add guard comment) — second, atomic commit.
- QA-02 (postinstall + turbo predecessor) — third, atomic commit.
- AUTH-03 (factory + coverage test) — fourth, atomic commit. Verify all existing tests still pass.
- QA-01 (root-cause investigation + fix of 5 integration tests) — last, because it requires the integration suite to run multiple times and may take longest. Atomic commit per fix.
- All 5 work units are committed separately to keep blast radius isolated. If any one breaks, the others stand.

### Claude's Discretion

- Specific commit message format (within conventional-commits convention).
- Internal naming of helper variables.
- Whether `requireRole` accepts `Role[]` or `Role | Role[]` — pick the cleaner ergonomic.
- Test framework patterns (Vitest convention from existing tests).

</decisions>

<code_context>

## Existing Code Insights

### Reusable Assets

- `apps/api/src/infrastructure/trpc/trpc.middleware.ts:71-81` — existing `isHead` middleware to refactor into the factory.
- `apps/api/src/infrastructure/trpc/trpc.middleware.ts:59,69,83` — `publicProcedure`, `protectedProcedure`, `headProcedure` chain pattern to mirror.
- `packages/shared/src/schemas/auth.ts:5-12` — `userSessionSchema` with `role: 'lead'|'head'|'viewer'` already defined; AUTH-03 must accept `'admin'` too (v6.0 schema extension flagged for Phase 28-29).
- `apps/api/src/infrastructure/trpc/trpc.context.ts:18-21` — context shape `{ session: UserSession | null, logger }` is the input the factory checks.

### Established Patterns

- tRPC middleware via `t.middleware(({ ctx, next }) => { ... })` — existing v5.0 pattern.
- Vitest test file naming: `*.test.ts` co-located, or `__tests__/` directory.
- `headProcedure` chaining: `t.procedure.use(loggingMiddleware).use(isHead)`.
- ESLint + TypeScript strict mode — must compile cleanly.

### Integration Points

- The factory will be consumed in Phase 28 (`AUTH-04` service-layer filtering) — the export contract from this phase is locked once committed.
- `period.contract.test.ts` is one of the only files touching Phase 22 verification doc-lag — minimal blast radius.
- `apps/web/src/proxy.ts` deletion does NOT affect runtime (proven dead). The active `apps/web/proxy.ts` is the Phase 24 implementation patched in commit `cc1a0ec` with the allowlist matcher + body guard.

</code_context>

<specifics>
## Specific Ideas

- The 5 failing integration tests share one symptom — **first action is one headed run** to observe, then propose a fix. No spec edits before observation.
- The `requireRole` factory exports MUST be importable from BOTH `packages/shared` (for type-only use) and `apps/api` (for runtime). Use `@customreport/shared/trpc` subpath export.
- AUTH-03 default-deny coverage test is **the** value of this REQ-ID — without it the factory exists but enforcement is silently skipped on new procedures. Treat as a hard CI gate.
- QA-04 doc-sync should NOT be bundled into a single commit with code changes — separate commit makes the doc fixup auditable.

</specifics>

<deferred>
## Deferred Ideas

- Splitting `admin` from `head` role (currently aliased) — Phase 29 or v7.0.
- Adding `audit` role for read-only auditors — out of scope for v6.0 (research anti-feature).
- Migrating `headProcedure` callers en masse to a more granular `requireRole(['head', 'auditor'])` — defer until `audit` role exists.
- Pre-Phase-28 sanity check: confirming `jwt.sign({...}, secret, { expiresIn: '5m' })` overload exists for AUTH-05 PDF cookie scoping — flagged for Phase 28 plan.

</deferred>
