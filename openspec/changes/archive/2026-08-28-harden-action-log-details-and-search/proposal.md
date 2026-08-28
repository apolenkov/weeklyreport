## Why

The admin Action Log cannot inspect all of the safe audit metadata already
returned by the API or search by the timestamp named in its route contract,
while the generated catalog incorrectly asks for a "raw payload" that the
durable audit model has never stored. The DS24 review in
`~/work/customreport-archive/2026-08-14-desktop-24-2be68407/` and the current
`UserActionLog`/tRPC/UI inventory require one privacy-preserving contract before
the desktop evidence can be accepted.

## What Changes

- Add an accessible row-detail disclosure that exposes and copies only the
  whitelisted durable audit fields: timestamp, actor id/role, procedure,
  target id, status, sanitized reason, duration, correlation id, and the
  explicitly retained IP value.
- Include the displayed timestamp representations in the existing loaded-row
  search while keeping its client-side/page-bounded semantics explicit.
- Keep cursor pagination at 20 rows and add deterministic evidence with more
  than one page.
- Correct `admin-actions-view` so it requires copyable whitelisted event
  details, never raw mutation/request/response content.
- Add negative tests proving that report/section text, review comments, user
  profile values, Telegram content, credentials, tokens, cookies, and arbitrary
  bodies cannot enter the durable row or detail response.

### Non-goals

- No new `UserActionLog` column, raw-input retention, request/response body
  logging, before/after snapshot, or database migration.
- No server-side full-history search, new log transport, retention-policy
  change, role expansion, or non-admin access.
- No redesign of other admin tables or of the exhaustive runtime-sweep
  infrastructure.

## Capabilities

### New Capabilities

- `admin-action-log-details`: define safe Action Log metadata, accessible
  disclosure/copy behavior, timestamp search, pagination, authorization, and
  negative privacy guarantees.

### Modified Capabilities

- `scenario-catalog`: require generated, reviewed intent prose to remain
  grounded in product behavior and existing data/security boundaries rather
  than inventing fields or retention obligations.

## Impact

- `apps/web/src/features/admin/ui/action-log-*` and focused frontend tests.
- `apps/api/src/modules/admin/action-log.*`, mutation-audit privacy tests, and
  shared output validation if needed; Prisma schema remains unchanged.
- `e2e/catalog/admin.yaml`, deterministic seed/evidence coverage, and the DS24
  external review artifacts after implementation.
