## ADDED Requirements

### Requirement: The Web jsdom Test Environment MUST Track a Maintained Major

The `apps/web` workspace MUST pin `jsdom` to the current maintained major
(`^29.1.1` at this change), and the full `apps/web` Vitest suite MUST pass on
that major with no skipped or quarantined tests. The bump is test-only and MUST
NOT alter production runtime behavior.

#### Scenario: Web test suite passes on the upgraded jsdom

- **WHEN** `pnpm --filter @customreport/web test` runs with `jsdom@29.1.1`
  resolved in the lockfile
- **THEN** every `apps/web` test passes
- **AND** no test is skipped, quarantined, or deleted to achieve the green run

#### Scenario: DOM-behavior breaking changes are migrated, not masked

- **WHEN** a jsdom major changes DOM-API behavior used by the web tests
  (selection/`Range`, `URL`, `fetch`, or `structuredClone` semantics)
- **THEN** the affected test setup or assertions are updated to the new behavior
- **AND** the fix addresses the cause rather than pinning a shim that hides the
  changed semantics

#### Scenario: Node baseline is honored

- **WHEN** the chosen jsdom major declares a minimum Node version
- **THEN** that minimum is satisfied by the repo `engines` constraint
  (`node >=24`) and the CI/local Node in use
- **AND** if it is not, the bump is blocked and reported instead of forced

### Requirement: The jsdom Upgrade MUST Remain Isolated

The jsdom bump MUST change only the `jsdom` dependency and the files needed to
make its test environment pass; it MUST NOT bundle other dependency upgrades, so
a failed validation can be rejected without affecting unrelated work. The merge
decision is the user's.

#### Scenario: No unrelated dependency moves with the bump

- **WHEN** the change is prepared for review
- **THEN** the diff touches only `apps/web/package.json` (the `jsdom` entry), the
  lockfile, and any `apps/web` Vitest config/setup needed for the new major
- **AND** no other major or minor dependency version is changed in the same change

#### Scenario: All repo gates pass before handing off the merge decision

- **WHEN** the upgrade is complete
- **THEN** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and
  `pnpm lint:md` all exit 0
- **AND** the resolved jsdom version, breaking changes encountered, and files
  touched are reported to the user for the merge decision
