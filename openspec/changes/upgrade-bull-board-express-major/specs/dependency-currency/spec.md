# Dependency Currency: Bull-Board

## ADDED Requirements

### Requirement: Bull-Board Packages MUST Move In Lockstep On The Same Major

The repository MUST keep `@bull-board/api` and `@bull-board/express` in
`apps/api/package.json` resolved to the same major version, because they share
the server-adapter contract and a cross-major pairing is a runtime mismatch.

#### Scenario: Both Bull-Board packages bumped together

- **WHEN** `@bull-board/express` is upgraded to the 7.x line
- **THEN** `@bull-board/api` is upgraded to the same 7.x line in the same change
- **AND** `pnpm install` resolves both to a single matching major in the lockfile
- **AND** no peer-dependency warning is emitted for the Bull-Board pair

#### Scenario: Lockstep violation is rejected

- **WHEN** only one of the two Bull-Board packages is bumped across a major
- **THEN** the change is treated as incorrect and the second package is bumped
  to match before merge

### Requirement: Bull-Board Route MUST Stay Mounted And Guarded After Upgrade

After the v7 upgrade, the Bull-Board UI MUST remain mounted at `/admin/queues`
behind the `requireHead` JWT guard and serve the `pdf-export` and
`email-reminder` queues, with static assets resolving under the base path.

#### Scenario: Unauthenticated access is rejected

- **WHEN** a request hits `/admin/queues` with no valid session cookie
- **THEN** the response is `401`

#### Scenario: Non-head role is rejected

- **WHEN** an authenticated non-`head` user requests `/admin/queues`
- **THEN** the response is `403`

#### Scenario: Head role sees the queues

- **WHEN** an authenticated `head` user requests `/admin/queues`
- **THEN** the Bull-Board UI loads
- **AND** both the `pdf-export` and `email-reminder` queues are listed
- **AND** the UI static assets resolve under the `/admin/queues` base path

### Requirement: Bull-Board Upgrade MUST Pass The Full Gate Before Merge

The upgrade MUST keep the standard gates green before the user makes the merge
decision for this isolated change.

#### Scenario: Gate run after the upgrade

- **WHEN** the upgrade is applied and `pnpm typecheck && pnpm lint && pnpm test`
  is run
- **THEN** all three commands exit 0 with no new warnings
- **AND** `pnpm build` for `apps/api` succeeds
