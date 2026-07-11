## MODIFIED Requirements

### Requirement: Status literal-union re-declarations are gated

The repository MUST run a scanner (`scripts/find-status-literal-unions.mjs`)
that fails when a TypeScript union type or zod literal list outside the
allowlisted files re-declares any of four vocabularies: a literal set
containing all three of `"green"`, `"yellow"`, `"red"` (extras allowed —
the three colors only ever come from `TrafficLightStatus`), a status-literal
set equal to exactly `{"draft", "published"}` (supersets are distinct
vocabularies by traced evidence and stay a review judgment), a literal set
containing all four of `"blocked"`, `"at-risk"`, `"on-track"`, `"empty"`
(extras allowed — the canonical presentation vocabulary is declared once as
`CanonicalStatus`; subsets like `riskSeveritySchema`'s `at-risk`/`blocked`
stay legal), or a literal set containing all four of `"lead"`, `"head"`,
`"admin"`, `"viewer"` (extras allowed — the role vocabulary is declared once
per axis as `Role`/`DbRole`, per the `role-type` spec's own exemptions:
runtime validators/presentation-ordered lists enumerating VALUES while
typing from shared, the Prisma seed toolchain's one commented literal
mirror, the e2e tree, and catalog YAML). The scanner MUST cover test files.
The only exemptions are the SSOT files themselves
(`packages/shared/src/schemas/report-primitives.schema.ts`,
`apps/web/src/lib/status-presentation.ts`, `packages/shared/src/schemas/auth.ts`),
the documented literal mirror `prisma/seed-constants.ts`, and the e2e tree's
self-contained role mirrors (`e2e/integration/fixtures.ts`,
`e2e/sweep/catalog-sweep.spec.ts`, `e2e/sweep/helpers/dev-auth.ts` — the
`role-type` spec's e2e exemption), all hardcoded centrally in the scanner;
there is no inline annotation escape.

#### Scenario: a full traffic-light union is re-declared

- **WHEN** a staged source or test file declares a union or zod literal list
  containing `"green"`, `"yellow"`, and `"red"` outside the SSOT file
- **THEN** the scanner exits non-zero naming the file and line
- **AND** the commit is blocked by lint-staged

#### Scenario: an exact report-status union is re-declared

- **WHEN** a staged file declares a union whose status-literal set is exactly
  `{"draft", "published"}` outside the SSOT file and `prisma/seed-constants.ts`
- **THEN** the scanner exits non-zero naming the file and line

#### Scenario: the canonical presentation vocabulary is re-declared

- **WHEN** a staged file declares a union or zod literal list containing
  `"blocked"`, `"at-risk"`, `"on-track"`, and `"empty"` outside
  `apps/web/src/lib/status-presentation.ts`
- **THEN** the scanner exits non-zero naming the file and line

#### Scenario: the role vocabulary is re-declared

- **WHEN** a staged file declares a union or zod literal list containing
  `"lead"`, `"head"`, `"admin"`, and `"viewer"` outside
  `packages/shared/src/schemas/auth.ts` or the `role-type` spec's other
  named exemptions
- **THEN** the scanner exits non-zero naming the file and line

#### Scenario: legal compositions pass

- **WHEN** a file composes from the shared types (`TrafficLightStatus |
"empty"`, an alias of `CanonicalStatus`, `Role | null`), declares a subset
  (`"yellow" | "red"`, `"at-risk" | "blocked"`), or declares a distinct
  vocabulary that merely includes `"draft"` and `"published"` among other
  lifecycle literals
- **THEN** the scanner reports nothing
