## ADDED Requirements

### Requirement: Four-role UAT MUST contain zero axe violations

The React routes reachable by `admin`, `head`, `lead`, and `viewer` in the
`e2e/catalog` inventory MUST produce zero `@axe-core/playwright` violations
during `pnpm test:uat`. The gate MUST scan the rendered DOM after hydration and
MUST NOT disable an axe rule, exclude an offending selector, or convert a
violation into a passing allowlist entry.

#### Scenario: All role routes are accessible

- **WHEN** `pnpm test:uat` visits every catalog route for all four roles
- **THEN** every role report records zero axe violations
- **AND** the command exits zero

#### Scenario: A route contains an accessibility violation

- **WHEN** axe reports any violation on a rendered role route
- **THEN** the report identifies the role, route, rule, and offending target
- **AND** the command exits non-zero

### Requirement: The axe gate MUST prove that it examines a real defect

The UAT test surface MUST contain a planted browser probe that renders a known
accessibility defect and asserts that the installed axe scanner detects its
specific rule. The probe MUST fail if the scanner returns an empty result or if
the required rule is disabled.

#### Scenario: Planted low contrast is detected

- **WHEN** the proof page renders text whose foreground and background do not
  meet the minimum contrast ratio
- **THEN** the installed axe scanner reports `color-contrast`
- **AND** the proof test passes only because the violation was detected
