## MODIFIED Requirements

### Requirement: Cursor-paginated queries respect a factory-set `enabled` when the caller supplies none

`use-cursor-pagination` MUST only override the built query options'
`enabled` value with `options.enabled` when the caller explicitly supplies
it; when `options.enabled` is `undefined`, the factory's own `enabled`
value (if any) MUST pass through unmodified.

#### Scenario: A factory-disabled query stays disabled with no caller override

- **WHEN** a consumer calls the hook without an `options.enabled` value, and
  the query-options factory itself sets `enabled: false`
- **THEN** the resulting query is disabled
- **AND** the factory's `enabled: false` is not silently overwritten by
  `undefined`

#### Scenario: An explicit caller override still takes precedence

- **WHEN** a consumer calls the hook WITH an explicit `options.enabled`
  value, and the query-options factory sets a different `enabled` value
- **THEN** the caller-supplied `options.enabled` value wins
