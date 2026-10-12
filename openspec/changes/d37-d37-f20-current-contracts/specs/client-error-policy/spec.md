## MODIFIED Requirements

### Requirement: Load-failure toasts use formatClientErrorMessage

Every user-facing load-failure toast MUST be produced by
`formatClientErrorMessage` (prefix + "Reference: \<requestId\>." suffix,
internal-error message suppression). Raw `error.message` MUST NOT appear in
load-failure toast copy.

This explicitly covers **client-input validation failures** (a tRPC
`BAD_REQUEST` whose `error.message` is a serialized Zod issues array) and
**not-found failures** (`NOT_FOUND`): these are non-internal errors, but their
`error.message` MUST NOT be echoed into toast copy either. The formatter MUST
map such errors to a clean human message (e.g. an invalid-link / not-found
message), never the raw issues array or its regex `pattern`.

The formatter MUST map malformed identifiers to the safe client-facing error
message for both `leadForm.byPeriod` and `weeklyReport.get`; raw Zod issue
details MUST remain internal.

#### Scenario: an internal server error with a requestId

- **WHEN** a toasting query site fails with an internal tRPC error
  carrying `requestId: "req-X"`
- **THEN** the toast reads "\<prefix\>. Reference: req-X." and does
  not echo the internal error message

#### Scenario: a silent surface fails

- **WHEN** a query on a log-only surface (slides clients, which pass
  no `toastPrefix`) fails
- **THEN** the failure is logged but no toast is shown; the surface's
  own empty state is the user signal

#### Scenario: a client-input validation failure (Zod / BAD_REQUEST)

- **WHEN** a toasting query site fails with a tRPC `BAD_REQUEST` whose
  `error.message` is a serialized Zod issues array (e.g. a malformed
  `reportId` that fails the UUID check)
- **THEN** the toast shows a clean human message (invalid link / not found)
- **AND** the raw issues array, its `pattern` regex, and any internal Zod
  field MUST NOT appear in the toast copy

#### Scenario: A non-internal error carries a Reference

- **WHEN** a non-internal, non-invalid-link load error carries a requestId
- **THEN** the displayed message ends with sentence punctuation before its Reference suffix
- **AND** a message already ending with sentence punctuation does not receive another period

#### Scenario: A message-free error carries a Reference

- **WHEN** a message-free load error carries a requestId
- **THEN** the prefix ends with a period before its Reference suffix
- **AND** existing internal-error suppression, invalid-link copy and no-reference copy remain unchanged
