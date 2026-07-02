## ADDED Requirements

### Requirement: Every emitted audit event must be a declared AuditEvent union member

Every call site that emits an audit event MUST pass an event string that is a
declared member of the `AuditEvent` TypeScript string-literal union in
`apps/api/src/lib/audit-logger-types.ts`. This is the parity converse of the
existing "declared enum value must have a writer" rule: just as a declared-but-never-
written value must be removed, an emitted-but-undeclared event string must be
added to the union. The union is the canonical list for SIEM consumer filtering;
an event absent from it is silently missed by any exhaustive switch or rule set
keyed on that type.

Note: `AuditEvent` is a TypeScript string-literal union (`type AuditEvent = 'a' | 'b' | ...`),
not a Prisma enum or Zod enum. The enforcement mechanism is static type-checking —
the emit call site MUST be typed as `AuditEvent` so the TypeScript compiler rejects
undeclared strings.

Consumer surfaces:

- `apps/api/src/lib/audit-logger-types.ts` — `AuditEvent` union (declaration)
- `apps/api/src/lib/audit-logger.ts` — emit call sites (usage)
- All `*.service.ts` and `*.router.ts` files that call `ctx.auditLogger.log()`
  or equivalent.

#### Scenario: period.manual-edit is added to the AuditEvent union

- **GIVEN** `audit-logger.ts` emits `event: 'period.manual-edit'` in the period
  manual-edit path
- **WHEN** `AuditEvent` is updated to include `'period.manual-edit'`
- **THEN** TypeScript compiles without error at the emit call site and a SIEM
  consumer switch on `AuditEvent` handles the event at compile time

#### Scenario: Emitting an undeclared audit event string is a compile error

- **GIVEN** a call site attempts to emit an event string not present in `AuditEvent`
- **WHEN** `pnpm typecheck` runs
- **THEN** TypeScript reports a type error at the call site

#### Scenario: Exhaustive switch over AuditEvent handles period.manual-edit

- **GIVEN** a consumer that switches exhaustively over `AuditEvent`
- **WHEN** `'period.manual-edit'` is a declared union member
- **THEN** the switch case for `'period.manual-edit'` is reachable and the
  `default` branch (if present) does not silently catch it
