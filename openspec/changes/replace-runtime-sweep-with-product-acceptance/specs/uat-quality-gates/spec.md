## ADDED Requirements

### Requirement: Final Acceptance Gate MUST Pass As A Bounded Product Chain

The repository MUST pass `pnpm typecheck`, `pnpm lint`, `pnpm test`, an explicitly configured production `pnpm build`, focused existing E2E suites, and `pnpm test:acceptance` before WeeklyReport is described as release-ready. Browser acceptance is limited to route health plus one lifecycle smoke.

#### Scenario: The complete final gate is green

- **WHEN** the final commands run at one exact Git SHA
- **THEN** every command exits zero and the acceptance report records successful cleanup

#### Scenario: A final gate command fails

- **WHEN** any required command fails or cleanup is not proven
- **THEN** final acceptance fails

### Requirement: Final acceptance MUST NOT depend on exhaustive runtime campaigns

The final WeeklyReport verdict MUST NOT require an interaction graph, campaign manifest, continuation chunks, custom supervisor, AI-import verdict, or multi-hour canary.

#### Scenario: Bounded acceptance is complete

- **WHEN** deterministic gates and `pnpm test:acceptance` pass at one source SHA
- **THEN** browser acceptance is complete without any retired runtime command

## REMOVED Requirements

### Requirement: Final Acceptance Gate MUST Pass As A Four-Command Chain

**Reason**: The four-command wording omitted focused E2E and bounded browser acceptance ownership.

**Migration**: Use the bounded product chain defined by this change.

### Requirement: Final Playwright Re-Sweep MUST Show Zero Console Errors Per Role

**Reason**: The old re-sweep command and harness were retired.

**Migration**: `pnpm test:uat` runs four-role route health and fails on unclassified console errors.

### Requirement: Visual Acceptance Reviews the Entire Enumerated Frame Set

**Reason**: An exhaustive enumerated browser frame set conflicts with the owner-approved smoke-only contour.

**Migration**: Keep targeted visual regressions in focused tests and reviewed product evidence.
