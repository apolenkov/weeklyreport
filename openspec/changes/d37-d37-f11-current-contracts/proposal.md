# Proposal

## Why

A snapshot with an invalid reminder URL can throw before returning validation issues, reminder offsets can pass the shared schema despite exceeding their database column, and a short name can begin with an unnecessary space. D37-F11 current source inventory and primary owner tests identify these narrow existing-contract corrections (C3572, C3495, C3518).

## What Changes

- Validate signed reminder offsets with the existing PostgreSQL INTEGER representation.
- Return existing URL validation issues without throwing from recovery cross-reference validation.
- Join present short-name parts without an empty surname separator.
- Derive prompt contents from the registered slots; share role literals while retaining independent DB/session schemas; unify existing progress comparisons and portfolio participation rules without changing their behavior (C3567, C3593, C3600, C3730).

Non-goals:

- New reminder sign, timing, hostname or business limits.
- Changes to stored names, authorization, provider counter policy, snapshot identity or published membership.
- Reimplementation of the already-shipped print deadline, CLS cap or inclusive date message; native acceptance and aggregate gates remain with Root.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `reliable-reminder-delivery`: signed offset admission matches its INTEGER storage range.
- `structured-user-name`: short-name assembly omits a separator for an absent trimmed surname.
- `admin-snapshot-restore`: malformed reminder URLs return validation issues before restore.

## Impact

Only the 27 Root-granted F11 paths and this unique change directory are writable. The absent historical reminder-policy-offset-range change stays absent. Existing primary tests and synthetic fixtures own the regressions; no dependency, runtime, migration, authentication or configuration changes are required. Root retains canonical spec synchronization, publication and native/aggregate acceptance.
