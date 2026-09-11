# route-query-normalization Specification

## Purpose

Keep optional route query handling scalar, predictable, and safe for deep links
and repeated-parameter fallbacks.

## Requirements

### Requirement: Optional route query values are consumed only when scalar

WeeklyReport server pages MUST model optional query parameters as
`string | string[] | undefined`. A route MUST consume or preserve a value only
when it is a scalar string. Repeated values represented as arrays MUST be
treated as absent rather than selecting one value or forwarding the array to a
product component.

#### Scenario: Scalar deep link remains addressable

- **WHEN** an admin, report, feedback-focus, or auth-error route receives a
  supported query parameter once
- **THEN** the page applies or preserves that scalar value

#### Scenario: Repeated admin filter is ignored

- **WHEN** the admin products route receives a repeated `filter` parameter
- **THEN** the page does not pass a product filter to the admin panel
- **AND** the products view remains unfiltered

#### Scenario: Repeated report context is ignored

- **WHEN** a head or lead report route receives repeated `mode`, `authorId`, or
  feedback-focus parameters
- **THEN** the page applies its absent-parameter fallback for each repeated
  value
- **AND** it does not preserve repeated focus values in a canonical redirect

#### Scenario: Repeated auth reason is ignored

- **WHEN** the auth-error route receives a repeated `reason` parameter
- **THEN** it renders the generic authentication error message
