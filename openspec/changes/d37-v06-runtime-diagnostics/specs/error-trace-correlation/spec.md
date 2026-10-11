## ADDED Requirements

### Requirement: Nest Error logs retain name and stack

`NestAppLoggerAdapter.error` MUST preserve an actual Error's name and stack in the existing AppLogger context. An explicit caller stack and Nest context MUST take precedence over Error defaults. A two-argument string context MUST keep its existing meaning. The adapter MUST NOT traverse Error causes, extra properties or arbitrary objects to implement this contract.

#### Scenario: Nest reports an actual exception

- **WHEN** Nest ExceptionHandler reports an Error through NestAppLoggerAdapter
- **THEN** the existing AppLogger sink receives the Error message, name, stack and Nest context
- **AND** the cause and arbitrary extra properties are absent

#### Scenario: Caller supplies a stack and context

- **WHEN** an Error is logged with an explicit stack and Nest context
- **THEN** AppLogger receives the explicit stack and context together with the Error name

#### Scenario: Caller supplies only a string context

- **WHEN** a string error message is logged with a second string argument and no third argument
- **THEN** AppLogger retains that string as Nest context without inventing an Error stack
