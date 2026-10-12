## ADDED Requirements

### Requirement: Query error episodes preserve reporting and suppress repeated toasts

The query policy seam MUST log each new error transition with the existing safe event/component/procedure context. A load-failure toast MUST appear at most once before the next successful query result. Pending retry states MUST NOT end an error episode. Head active-period and development user-list failures MUST use the existing log-only seam.

#### Scenario: Retries fail before recovery

- **WHEN** an empty query fails, retries through pending and fails with a new error
- **THEN** both failures are logged and exactly one toast is shown
- **AND** after a successful query the next failure may show a new toast

#### Scenario: Silent query owners fail

- **WHEN** Head active-period or dev.listUsers fails
- **THEN** the owner emits the contextual policy log without adding a toast
- **AND** a same-error rerender emits no duplicate
