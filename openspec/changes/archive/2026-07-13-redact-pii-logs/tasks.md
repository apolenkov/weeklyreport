## 1. Logger redaction helper

- [ ] 1.1 `apps/api/src/lib/logger.ts`: add a `PII_CONTEXT_KEYS` set (starting
      with `recipientEmail`) and a `redactPiiContext` helper that replaces
      the value at each matching key with `"[redacted]"` in a shallow-copied
      context object
- [ ] 1.2 Apply `redactPiiContext` to the merged context inside
      `AppLoggerImpl.emit` before building `entry`, so the redaction covers
      stdout/stderr, the file sink, and the OTel log forwarder from one call
      site
- [ ] 1.3 Unit test: a log call with `{ recipientEmail: "x@y.com" }` produces
      an entry where that field reads `"[redacted]"`, and a log call without
      a PII-shaped key is unchanged

## 2. Call-site cleanup

- [ ] 2.1 `reminders.service.ts`: drop `recipientEmail` from the
      `"creating reminder execution"` and `"enqueued email reminder job"`
      log calls (keep `ruleId`/`executionId`)
- [ ] 2.2 `email-reminder.processor.ts`: drop `recipientEmail` from the
      `"email-reminder job failed"` log call
- [ ] 2.3 Confirm no other call site in these two files logs `recipientEmail`
      or another obviously PII-shaped field

## 3. Spec delta

- [ ] 3.1 `error-trace-correlation`: ADD a requirement that `AppLogger`
      redacts PII-shaped context fields before any sink receives them

## 4. Gates and verification

- [ ] 4.1 `pnpm --filter @customreport/api db:generate`
- [ ] 4.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 4.3 Live-check: trigger a reminder execution locally and confirm the
      stdout/file log entries carry `ruleId`/`executionId` but no email
      address
- [ ] 4.4 `openspec validate redact-pii-logs --strict`
