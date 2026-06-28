## ADDED Requirements

### Requirement: Cross-Author Section Read Is Scoped to Shared Products

The system MUST restrict the cross-author section read in `getByPeriod`
(`apps/api/src/modules/report-sections/lead-form.service.ts`) so a `lead`
viewing another author's section receives only the records on products both
leads share; records on products the viewing lead does not co-own MUST NOT
appear in the returned section.

The shared-product set is the products on which both the viewing lead and the
section's author hold a lead role on a NON-ARCHIVED product (the same
co-ownership relation used by `getCrossAuthorContent`, which excludes archived
products). The filter MUST apply to EVERY product-scoped collection the read
model exposes: `items` (current and next week), `risks`, `decisions`,
per-stage statuses, the `projects` array (including each entry's `projectName`,
`trafficLight`, `ownedStages`, and `stageSet`), and `referencedProjects`. A
single shared product MUST NOT widen access to the author's unshared products.

`referencedProjects` MUST be recomputed from the filtered row set (or filtered
to the shared-product ids), not carried over from the unfiltered section, so a
removed unshared row cannot re-leak its product name.

#### Scenario: Co-lead view excludes records on unshared products

- **GIVEN** lead A and lead B both lead product P, and lead B additionally leads product Q alone
- **AND** lead B's section for the period has items, risks, and decisions on both P and Q
- **WHEN** lead A reads lead B's section via `getByPeriod` with B as the requested author
- **THEN** the returned section contains B's records on P
- **AND** the returned section contains no item, risk, or decision on Q

#### Scenario: Co-lead view excludes the project card and stage data of an unshared product

- **GIVEN** lead A and lead B co-lead product P, and lead B additionally leads product Q alone
- **WHEN** lead A reads lead B's section via `getByPeriod` with B as the requested author
- **THEN** the returned section's `projects` array contains no entry for Q (no `projectName`, `trafficLight`, `ownedStages`, or `stageSet` for Q)
- **AND** the returned section's `referencedProjects` contains no entry for Q

#### Scenario: Shared-product records remain visible

- **GIVEN** lead A and lead B co-lead product P, and B authored a risk and a decision on P
- **WHEN** lead A reads lead B's section via `getByPeriod`
- **THEN** B's risk and decision on P are present in the returned section

### Requirement: The Cross-Author Gate Uses the Non-Archived Shared Set

The `lead` cross-author authorization gate in `getByPeriod` MUST grant access
only when the viewing lead and the requested author co-own at least one
NON-ARCHIVED product — the SAME shared-product set used for filtering — and MUST
fall back to the viewing lead's own section when that set is empty. The gate MUST
NOT rely on a co-ownership signal (such as the current `hasSharedProduct`) that
counts archived products, because that would admit a reader who can be shown
nothing yet still observe the foreign section's status and metadata.

The gate decision and the content filter MUST derive from one computation of the
shared non-archived set so there is no window in which the gate admits a reader
the filter then empties.

#### Scenario: Sharing only an archived product does not open the foreign section

- **GIVEN** lead A and lead B once co-led product P, but P is now archived, and B leads a separate non-archived product Q alone
- **AND** A and B share no non-archived product
- **WHEN** lead A reads via `getByPeriod` requesting B as the author
- **THEN** the cross-author gate does not grant access
- **AND** the call falls back to lead A's own section rather than returning B's section status or metadata

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
the author's section as the co-lead through the service, and assert that ALL
unshared-product data is excluded while shared-product data remains. The
assertions MUST cover not only `items`, `risks`, and `decisions` but also the
`projects` array (no unshared `projectId`/`projectName`/`trafficLight`), its
per-stage data (`ownedStages` and `stageSet`), and `referencedProjects`, so a
stage- or project-level leak cannot pass the suite.

#### Scenario: Test fails if the foreign section leaks unshared records

- **WHEN** the cross-author read is exercised with a shared and an unshared product present
- **THEN** the test asserts the returned section omits all unshared-product items, risks, and decisions
- **AND** the test asserts the returned `projects` array has no entry for the unshared product (no `projectName`, `trafficLight`, `ownedStages`, or `stageSet`)
- **AND** the test asserts `referencedProjects` has no unshared-product entry
- **AND** the test asserts the shared-product records and project card are still present
