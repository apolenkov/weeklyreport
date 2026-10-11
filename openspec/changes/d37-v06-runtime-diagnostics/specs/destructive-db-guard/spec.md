## ADDED Requirements

### Requirement: Development reseed responses contain safe status

The development tRPC `wipeAndReseed` procedure MUST retain its guarded execution and existing success result shape while returning only a fixed safe completion summary in `output`. Child-process failures MUST produce a generic INTERNAL_SERVER_ERROR message through the existing request-id formatter. The response MUST NOT include raw child stdout, stderr, internal paths or child error causes, and the procedure MUST NOT copy those diagnostics into an unredacted application log.

#### Scenario: A seed child fails with internal diagnostics

- **GIVEN** an authenticated development reseed invocation passes the existing destructive guard
- **WHEN** its seed child fails with an error message and stderr containing an internal source path
- **THEN** the serialized response contains the generic failure message and failure code with the existing request id
- **AND** the child message, stderr, internal path and cause are absent from the response

#### Scenario: Reseed children succeed with diagnostic output

- **WHEN** reset and seed children succeed and emit stdout diagnostics
- **THEN** the response preserves `ok: true`, the requested variant and a string `output` containing a fixed safe completion summary
- **AND** child stdout diagnostics are absent from the response
