# Proposal

## Why

Report read models reuse the author write validators. `reject-invisible-only-safe-text`
(TASK-503.104) tightens `safeText`, so text that an earlier rule accepted and
the database already holds (for example a lone U+2060) now fails every read
that parses it: the lead form, the weekly report, publication snapshots,
carry-over and the PDF render. One such row breaks the whole page or job and
hides its neighbours. Production data is not reachable, so the read side must
not depend on every stored value meeting the newest write rule.

Backlog: TASK-503.108 (follows TASK-503.104; TASK-503.107 stays separate).

## What Changes

- Read-model text fields (items, risks, decisions, their stage names, review
  comments and verdict reasons, item outcome history and resolution) accept
  persisted strings as stored, in publication snapshots and live reads alike.
  The activity catalogue read (`projectActivitySchema` name and Jira accounts)
  and the section activity title override follow the same rule. They do
  not re-apply visible-content or length rules and do not trim, normalize or
  replace values.
- Author write schemas keep every current rule; nothing on the write side is
  relaxed.
- Server copies of persisted rows (publication snapshot, carry-over merge,
  section merge stamping the stored author name) use the read rule.
- Regressions cover each read model and the merge, weekly (published and live),
  carry-over and PDF render consumers with a stored value the write rule
  rejects, plus a check that every write field still rejects it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `schema-conventions`: reads of persisted text do not re-apply author write
  rules; the invisible-only stage-name rule of `reject-invisible-only-safe-text`
  applies to writes only.

## Impact

Shared schemas in `packages/shared/src/schemas/report-sections/` and
`review/review.schema.ts`, with tests beside them and beside the four consumers.
No database migration, data cleanup or client change.

## Non-goals

- Relaxing any author write rule, or accepting such text in a new write.
- Cleaning or migrating stored values (assessed separately).
- Accepting an empty string or a null byte: no writer admitted either and
  PostgreSQL text cannot hold a null byte, so both still fail closed.
