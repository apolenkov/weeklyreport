# Tasks — Add scope-accessed audit event

Decisions D1-D4: `design.md`. Evidence anchors: `proposal.md`.
NOT STARTED — captured 2026-06-10 (closes the `TODO(scopeAccessed-audit)`
at `apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts:79`;
implement on go-ahead).

## 1. Audit logger event (D4)

- [ ] 1.1 `apps/api/src/lib/audit-logger-types.ts`: add
      `"scope-accessed"` to the `AuditEvent` union; add
      `ScopeAccessedInput = Omit<AuditEnvelope, "event" |
  "attemptedRole"> & { accessedScope: string; productIds: readonly
  string[]; groupIds: readonly string[]; resourceId: string }`; add
      `scopeAccessed(input): void` to the `AuditLogger` interface.
- [ ] 1.2 `apps/api/src/lib/audit-logger.ts`: implement `scopeAccessed`
      in the real logger at `logger.info` with `event: "scope-accessed"`
      and the typed fields; add the silent no-op in `createNullAuditLogger`.
- [ ] 1.3 Unit test in `apps/api/src/lib/audit-logger.test.ts`: real
      logger emits one `info` line with the whitelisted payload and no
      extra fields; no-op logger writes nothing.

## 2. Cross-group signal from the read (D1)

- [ ] 2.1 `apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts`:
      add `lead: { select: { reportingGroupId: true } }` to the
      `project.findMany` include (currently `stageAssignments` only,
      `:105`-`:110`); compute the set of surfaced products whose owner
      group is not in the caller's allowed group ids.
- [ ] 2.2 Surface a `crossGroupProductIds: string[]` (and the distinct
      `crossGroupGroupIds`) signal up through the read model / service
      response so the router can emit; do NOT inject `AuditLogger` into
      the repository (constructor stays `prisma`-only).
- [ ] 2.3 Remove the `TODO(scopeAccessed-audit)` comment block at
      `weekly-report.prisma-repository.ts:79`-`:81`.

## 3. Emit at the router (D2, D3)

- [ ] 3.1 `apps/api/src/infrastructure/trpc/trpc.router.ts`: in the
      `weeklyReport.get` query (`:1842`-`1869`), after a successful load,
      emit `ctx.auditLogger.scopeAccessed({...})` once when the role is
      not admin and the cross-group signal is non-empty — using
      `ctx.session.userId`, `ctx.session.role`, `ctx.ip`, the resolved
      report id, `accessedScope: "weeklyReport.project"`, and the
      surfaced `productIds`/`groupIds`.
- [ ] 3.2 Confirm per-request dedupe (D3): one event per read regardless
      of cross-group product count; no per-row emission.

## 4. Behavioral tests

- [ ] 4.1 Weekly-report read test: non-admin surfacing a cross-group
      product emits exactly one `scopeAccessed` with the right
      `productIds`/`resourceId`; two cross-group products still emit one.
- [ ] 4.2 Negative tests: own-group-only read emits nothing; admin read
      emits nothing; a product the caller's group owns but also joined
      elsewhere does not count as cross-group.
- [ ] 4.3 Invariance test: read model is identical with the real logger
      vs the no-op logger (event is observability only).

## 5. Verification

- [ ] 5.1 Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm
  build` — record results here.
- [ ] 5.2 Log check: drive a non-admin cross-group weekly-report read on
      dev; confirm one `audit` line with `event: "scope-accessed"` at
      `info` and the whitelisted payload (no row contents); confirm a
      same-group read produces none. Record the observed lines.
- [ ] 5.3 User acceptance: confirm the audit asymmetry is closed (grant
      path now logged) and the event volume is acceptable before
      archiving.
