## ADDED Requirements

### Requirement: Manual Report period dates follow the stored date contract

Manual period create/update tRPC inputs MUST use the same Report date admission as persisted/result period dates: UTC year 2000 or later. Optional date omission and update deadline null MUST retain their existing meaning; invalid dates MUST be rejected before persistence.

#### Scenario: Manual request uses a pre-2000 date

- **WHEN** create or update supplies a period start, end or deadline whose UTC year is before 2000
- **THEN** input validation rejects that field before a write

#### Scenario: Existing valid and nullable inputs remain valid

- **WHEN** manual input supplies 2000-01-01 or later, omits optional fields, or clears update deadline with null
- **THEN** its existing date/coercion and omission/null semantics remain valid
