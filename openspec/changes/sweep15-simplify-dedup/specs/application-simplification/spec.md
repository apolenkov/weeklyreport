## ADDED Requirements

### Requirement: Admin consumers depend on focused services

API routers, schedulers, processors, bootstrap code, and other module consumers MUST inject the focused admin sub-service that owns each operation and MUST NOT route calls through an `AdminService` pass-through facade.

#### Scenario: Admin procedures are composed

- **WHEN** the admin tRPC router builds catalog, settings, periods, reminder-policy, user, and reopen procedures
- **THEN** each procedure group receives only its owning focused service dependencies
- **AND** authorization, inputs, outputs, audit effects, and error mapping remain unchanged

#### Scenario: The facade is removed

- **WHEN** production and tests compile
- **THEN** no `AdminService` class, provider, import, or facade-only delegation test remains

### Requirement: Admin repository capabilities are mandatory

Every production `AdminRepository` method MUST be required, and application services MUST call the contract directly without optional chaining, not-implemented branches, or silent empty/no-op fallbacks.

#### Scenario: A test fake does not exercise a repository surface

- **WHEN** a unit test constructs an `AdminRepository` fake
- **THEN** it spreads `unusedAdminRepositoryStubs()` for unused required methods
- **AND** overrides the methods under test explicitly

#### Scenario: A production repository is incomplete

- **WHEN** an implementation omits a required admin capability
- **THEN** TypeScript rejects the implementation at compile time

### Requirement: Residual traffic ranking uses one canonical helper

Web presentation consumers not owned by `sweep15-status-derivation-ssot` MUST use one `worstTrafficStatus` helper rather than declaring local traffic-rank maps or worst-of folds.

#### Scenario: Residual slide and weekly rank copies are searched

- **WHEN** the status-derivation SSOT change has landed and residual consumers are inventoried
- **THEN** slide-grid/slide-merge and weekly presentation consumers import the canonical helper
- **AND** no migrated consumer retains a private rank table

#### Scenario: Empty and mixed status values are folded

- **WHEN** the helper receives empty/null, green, yellow, and red values in any order
- **THEN** it returns the documented worst traffic status deterministically

### Requirement: Date call sites use canonical absolute and relative formatters

Web call sites MUST import absolute period/date functions directly from `lib/format-date`, and past-relative labels MUST use `formatRelativePast(date, now, variant?)` with explicit variants for preserved surface vocabulary.

#### Scenario: A pass-through wrapper is searched

- **WHEN** lead form/history, trends, periods, and report call sites are migrated
- **THEN** wrappers that only call a `lib/format-date` function are absent
- **AND** tests import the canonical formatter or test the consuming model

#### Scenario: Existing past-relative fixtures are formatted

- **WHEN** compact, long, and activity variants format boundary values from seconds through older dates
- **THEN** each surface's existing English wording and UTC short-date fallback are preserved
- **AND** tests pass an explicit `now`

### Requirement: Fill-from and period delete use the shared confirmation dialog

Fill-from overwrite confirmation and period deletion MUST render through `ConfirmationDialog` and MUST preserve action-specific copy, destructive treatment, pending disable, Escape/backdrop behavior, focus trap, and focus restoration.

#### Scenario: A lead confirms fill from

- **WHEN** the fill-from action requires confirmation
- **THEN** the shared dialog renders the selected-period context and invokes the existing fill mutation once on confirm

#### Scenario: An admin confirms period deletion

- **WHEN** a deletable period's Delete action is activated
- **THEN** the shared dialog renders a destructive confirm action
- **AND** focus returns to the trigger after cancel/close
