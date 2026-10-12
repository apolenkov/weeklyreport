## ADDED Requirements

### Requirement: Single revoke retains its existing caller scope in the write

Single revoke MUST carry the existing router-generated scope through its repository and transaction into the same atomic predicate as section identity, submitted status, editable report relation and optional judged version. Scope MUST NOT override those invariants. Unavailable scoped targets MUST return the existing not-found response without disclosing foreign existence. Parent lifecycle locking and the verdict caller's locked entitlement/version gate MUST remain unchanged.

#### Scenario: A scoped author is unavailable at the single-revoke write

- **GIVEN** the initial scoped read succeeded
- **WHEN** the current author no longer matches the head's scope before the atomic revoke write
- **THEN** the mutation changes no status, version or audit stamps
- **AND** scoped unavailability returns the existing not-found error

#### Scenario: An authorized admin or in-group head revokes

- **WHEN** an admitted admin empty scope or in-group head scope reaches the editable submitted write
- **THEN** the same existing transition may apply
- **AND** the verdict path retains its expectedVersion after locked entitlement
