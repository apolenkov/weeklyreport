## Why

TASK-503 finding C3371: archived Fill fixture preparation leaks its PostgreSQL
pool when Prisma construction or disconnect fails. Cleanup failures can also
replace the original fixture failure.

## What Changes

- Protect Prisma construction and independently attempt client and pool cleanup.
- Preserve the original failure; aggregate any cleanup failures with it.
- Verify the existing fixture entrypoint with dependency mocks and no database.

## Capabilities

### New Capabilities

- `test-data-lifecycle`: archived Fill fixture resource cleanup and failure preservation.

### Modified Capabilities

None.

## Impact

Only `e2e/setup/archived-fill.ts` and its colocated Node unit test change.
Fixture contents, destructive guards and preparation callers remain unchanged.
The existing fixture contract is in `behavioral-ui-regression-gate`, requirement
"Lead browser tests prepare independent disposable state".
