## Why

TASK-503.112 (member 503.08, finding C2875). The admin save of a user (`admin.users.saveUser`) validates the free-text fields `name`, `lastName`, `firstName`, `middleName` and `position` with `z.string()` only. Other write schemas in `packages/shared` apply `safeText`, which rejects null bytes and values made only of whitespace or invisible characters. An admin write can therefore store text that every other write path refuses.

Decision (Fable, recorded in the TASK-503.112 card): fix at the admin write boundary; do not sanitize stored values on read.

## What Changes

- Add a write-side input schema `adminUserInputSchema` in `packages/shared` whose five free-text fields use the shared `safeText` primitive (nullable for `middleName` and `position`). Length bounds come from `safeText` defaults.
- `saveUser` and the service upsert validate with the input schema.
- `adminUserSchema` keeps its current shape and validation. It stays the read contract for the admin snapshot and restore parsing, so stored values are not tightened.

### Deliberate boundaries

- Snapshot restore (`adminSnapshotRestoreSchema`) is NOT changed. It re-parses this system's own snapshot; tightening it could break restoring older data. Coordinator decision, TASK-503.112.
- `safeText` adds a 500-character maximum to `name`, `lastName` and `firstName`, which had no bound before. Coordinator accepted this. The admin form and seed data use far shorter values.

## Capabilities

### Modified Capabilities

- `structured-user-name`: the admin save contract validates name parts and position as safe text on write.

## Impact

`packages/shared` (`report-admin.schema.ts`, its tests, `index.ts` export), `apps/api` admin user save (router input and `SnapshotAdminService.upsertUser`). No change to read paths, the database or the public tRPC procedure name.
