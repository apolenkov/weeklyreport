## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

`reminders.service.ts` and `email-reminder.processor.ts` log the raw
`recipientEmail` field (`"creating reminder execution"`, `"enqueued email
reminder job"`, `"email-reminder job failed"`). Those entries reach stdout,
the rotating log files, and OTLP/Loki, so a personal email address is
sitting in every log sink and search index. This contradicts the codebase's
existing userId-not-email policy elsewhere: the tRPC middleware layer uses
`describeShape` specifically to keep email out of logged request shapes, and
the audit logger records `userId`, never email. `AppLogger` itself
(`apps/api/src/lib/logger.ts`) has no redaction layer, so nothing stops the
next log call from doing the same thing.

`executionId` and `ruleId` already identify the reminder record uniquely in
these log calls, so the email adds no debugging value that isn't already
available by looking up the execution.

## What Changes

- Add a `redactPii` helper to `apps/api/src/lib/logger.ts` that masks known
  PII-shaped context keys (starting with `recipientEmail`, extensible to
  future fields by key name) before an entry is serialized, applied inside
  `AppLoggerImpl.emit` so no call site can bypass it.
- Update `reminders.service.ts`'s three log calls (`creating reminder
execution`, `enqueued email reminder job`, plus the execution-creation
  path) to stop passing `recipientEmail` as a bare context field; keep
  `ruleId`/`executionId` as the record identifier.
- Update `email-reminder.processor.ts`'s `"email-reminder job failed"` log
  call the same way.
- No behavior change to email delivery, dedupe keys, or queue payloads —
  only to what is written to log sinks.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `error-trace-correlation`: adds a requirement that `AppLogger` redacts
  PII-shaped context fields before any sink receives them.

## Impact

- `apps/api/src/lib/logger.ts`
- `apps/api/src/modules/reminders/reminders.service.ts`
- `apps/api/src/infrastructure/bullmq/email-reminder.processor.ts`

Sequencing note: this change touches the same reminder log call sites as
`reliable-reminder-delivery` and lands after it to avoid a merge collision;
it does not depend on that change's behavior.

Non-goals: no change to the email dedupe key format (which already embeds
`recipientEmail` for uniqueness, not for logging); no change to what
`emailQueue.add`'s job payload carries (BullMQ job data is not a log sink);
no redaction of email addresses inside rendered email bodies or the
`EmailPort` implementation itself.
