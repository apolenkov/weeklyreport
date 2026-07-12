## ADDED Requirements

### Requirement: AppLogger redacts PII-shaped context fields

`AppLogger` MUST redact known PII-shaped context fields (starting with
`recipientEmail`) before an entry reaches any sink, so a caller cannot leak
personal data into stdout, the rotating file sink, or the OTLP/Loki forwarder
by passing it as a log context value. Redaction MUST apply at the single
`emit` call site inside `AppLoggerImpl`, not per call site, so no future log
call can bypass it.

#### Scenario: A log call with a recipient email is redacted at every sink

- **GIVEN** a call to `logger.info` (or `warn`/`error`) with a context object
  containing `recipientEmail`
- **WHEN** the entry is emitted
- **THEN** the value written to stdout/stderr, the file sink, and the OTel
  log forwarder for that key is a fixed redaction marker, not the original
  email address

#### Scenario: A log call without PII-shaped keys is unaffected

- **GIVEN** a call to `logger.info` with a context object containing only
  non-PII fields (for example `ruleId`, `executionId`)
- **WHEN** the entry is emitted
- **THEN** every field's value is unchanged
