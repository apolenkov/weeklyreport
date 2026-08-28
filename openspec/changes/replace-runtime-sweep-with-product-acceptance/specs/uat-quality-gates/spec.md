## MODIFIED Requirements

### Requirement: Final Acceptance Gate MUST Pass As A Bounded Product Chain

The repository MUST pass a single final acceptance gate before WeeklyReport is declared release-ready. The gate consists of `pnpm typecheck`, `pnpm lint`, `pnpm test`, an explicitly configured production `pnpm build`, and `pnpm test:acceptance`; every command MUST exit 0. Pull-request CI MAY run the bounded `pnpm test:acceptance:smoke` subset, but final acceptance MUST run the full product contour.

#### Scenario: The complete final gate is green

- **WHEN** a maintainer runs the documented final acceptance command sequence at one exact Git SHA
- **THEN** typecheck, lint, unit/integration tests, production build, and full product acceptance all exit 0
- **AND** the acceptance report records the same SHA and a successful cleanup result

#### Scenario: A final gate command fails

- **WHEN** any required command exits non-zero or acceptance cleanup is not proven
- **THEN** final acceptance fails
- **AND** WeeklyReport is not described as release-ready

## ADDED Requirements

### Requirement: Final acceptance MUST NOT depend on exhaustive runtime campaigns

The final WeeklyReport verdict MUST be derivable from bounded deterministic gates and the product acceptance report. It MUST NOT require an exhaustive interaction graph, a source-manifest campaign, continuation chunks, a custom supervisor, an AI-import verdict, or a multi-hour canary.

#### Scenario: Bounded acceptance is complete

- **WHEN** all final deterministic gates and `pnpm test:acceptance` pass at one source SHA
- **THEN** the browser acceptance denominator is complete without running any retired `test:runtime-*` command
