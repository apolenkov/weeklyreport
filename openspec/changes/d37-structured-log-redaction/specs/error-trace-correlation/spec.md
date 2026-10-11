# Spec Delta

## MODIFIED Requirements

### Requirement: AppLogger redacts PII-shaped context fields

`AppLogger` MUST redact known PII-shaped context fields (starting with
`recipientEmail`) before an entry reaches any configured sink, so a caller
cannot leak personal data into stdout, the rotating file sink when configured,
or the OTLP/Loki forwarder when configured by passing it as a log context
value. Redaction MUST apply at the single
`emit` call site inside `AppLoggerImpl`, not per call site, so no log call can
bypass it. Known fields MUST also be redacted within context objects and arrays, including inherited child context, using the same fixed marker. Redaction MUST NOT mutate the caller's input or change ordinary values, reserved event-field protection, or existing cyclic/serialization-error behavior.

#### Scenario: A log call with a recipient email is redacted at every configured sink

- **GIVEN** a call to `logger.info` (or `warn`/`error`) with a context object
  containing `recipientEmail`
- **WHEN** the entry is emitted
- **THEN** the value written to each configured stdout/stderr, file, or OTel
  log sink for that key is a fixed redaction marker, not the original email
  address

#### Scenario: A log call without PII-shaped keys is unaffected

- **GIVEN** a call to `logger.info` with a context object containing only
  non-PII fields (for example `ruleId`, `executionId`)
- **WHEN** the entry is emitted
- **THEN** every field's value is unchanged

#### Scenario: Structured child context reaches configured sinks

- **GIVEN** child context and a log call contain nested objects and arrays with known personal-data keys
- **WHEN** an info, warning or error entry is emitted
- **THEN** every configured stdout/stderr, file and OTel sink receives the fixed marker for those fields
- **AND** the caller's input, ordinary organization identity and unrelated values remain unchanged

#### Scenario: Structured context has a cycle or an unsupported JSON value

- **WHEN** a log call contains a cycle or an unsupported JSON value
- **THEN** existing serialization-error envelope behavior remains
- **AND** redaction does not cause an infinite traversal or mutate the input
