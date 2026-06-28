## ADDED Requirements

### Requirement: Cross-Author Section Read Is Scoped to Shared Products

The system MUST restrict the cross-author section read in `getByPeriod`
(`apps/api/src/modules/report-sections/lead-form.service.ts`) so a `lead`
viewing another author's section receives only the records on products both
leads share; records on products the viewing lead does not co-own MUST NOT
appear in the returned section.

The shared-product set is the products on which both the viewing lead and the
section's author hold a lead role (the same co-ownership relation used by
`getCrossAuthorContent`). The filter MUST apply to the section's `items`
(current and next week), `risks`, `decisions`, and per-stage statuses. A single
shared product MUST NOT widen access to the author's unshared products.

#### Scenario: Co-lead view excludes records on unshared products

- **GIVEN** lead A and lead B both lead product P, and lead B additionally leads product Q alone
- **AND** lead B's section for the period has items, risks, and decisions on both P and Q
- **WHEN** lead A reads lead B's section via `getByPeriod` with B as the requested author
- **THEN** the returned section contains B's records on P
- **AND** the returned section contains no item, risk, or decision on Q

#### Scenario: Shared-product records remain visible

- **GIVEN** lead A and lead B co-lead product P, and B authored a risk and a decision on P
- **WHEN** lead A reads lead B's section via `getByPeriod`
- **THEN** B's risk and decision on P are present in the returned section

### Requirement: Own Section and Head/Admin Reads Are Not Narrowed

The shared-product filter MUST apply ONLY to the `lead` cross-author branch of
`getByPeriod`. A lead reading their OWN section MUST receive the full section
with no product filter. A `head` or `admin` reading any author's section MUST
receive the full section; their authorization is group-scoped and enforced
separately, not by product co-ownership.

#### Scenario: Lead reads own section in full

- **GIVEN** lead B has items, risks, and decisions across several products
- **WHEN** lead B reads their own section via `getByPeriod` (no other author requested, or requesting self)
- **THEN** every one of B's records is returned, unfiltered

#### Scenario: Head reads a foreign section in full

- **GIVEN** lead B has records on products the head does not lead
- **WHEN** a head reads lead B's section via `getByPeriod` with B as the requested author
- **THEN** the full section is returned, unaffected by the shared-product filter

### Requirement: A Contract Test Asserts the Unshared-Product Exclusion

A contract test in the report-sections test suite MUST construct a co-lead pair
that shares one product while the author holds a second, unshared product, read
the author's section as the co-lead through the service, and assert that
unshared-product records are excluded while shared-product records remain.

#### Scenario: Test fails if the foreign section leaks unshared records

- **WHEN** the cross-author read is exercised with a shared and an unshared product present
- **THEN** the test asserts the returned section omits all unshared-product records
- **AND** the test asserts the shared-product records are still present
