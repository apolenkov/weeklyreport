# Decide and clean up dead enum states

## Problem

Three enum values are declared in the schema/mappers but no production code path
ever writes them (confirmed this session by reading the writers). Dead states are
a quiet liability: readers, indexes, and tests anticipate behavior that does not
exist, and reviewers cannot tell "deliberately deferred" from "forgotten".

- **`CarryOverStatus.failed`** — enum is `pending | completed | failed`, but
  `carry-over.service.ts` sets status to `"completed"` only (lines ~69,99,204);
  `saveCarryOver` persists that. No path writes `failed` or `pending`. No test
  asserts `failed`.
- **`ReminderRuleStatus.paused`** — enum is `active | paused`; `ReminderRule.status`
  defaults to `active`. `reminderRule.create` / `update` in
  `admin.prisma-repository.ts` never pass an explicit `status`, so nothing
  transitions a rule to `paused`. A reader exists (the scheduler rejects a paused
  rule) and the schema even carries an anticipatory `@@index([status, fireAt])` —
  the pause transition was designed but never implemented.
- **`PdfExportStatus.processing`** — the domain↔db mapper declares it, but the
  service writes only `queued` / `completed` and the processor calls only
  `markExportFailed` / `markExportCompleted`. `processing` is never written.

(Note: `WorkingDays.{MON_SAT,MON_SUN}` were checked and are NOT dead — they are
live and genuinely change `computeDeadline`; excluded from this change.)

## Solution

Per value, make an explicit decision and apply it:

- `CarryOverStatus.failed` / `.pending` — either implement the carry-over
  error/queued path that writes them, or remove the unused values from the enum +
  Zod schema + mapper.
- `ReminderRuleStatus.paused` — either implement the pause transition (writer +
  admin control; reader/index already exist), or remove the value.
- `PdfExportStatus.processing` — likely remove (redundant between `queued` and
  `completed`), unless a real in-flight state is wanted.

Record the chosen disposition per value so the next reviewer sees intent.

## Non-goals

- No change to live enum values or their writers.
- No change to the deferred Telegram (`TelegramBinding`) scaffolding, which is a
  documented deferred-feature, not a dead state.
