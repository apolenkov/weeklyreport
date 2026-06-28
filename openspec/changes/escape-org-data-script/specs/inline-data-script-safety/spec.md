## ADDED Requirements

### Requirement: Inline Script Data Is Encoded Against Breakout

Server-provided data embedded into an inline HTML `<script>` element SHALL be encoded so that no string value can terminate the script element or inject markup, regardless of the characters the value contains. The dead `<script id="__org_data">` org-identity sink in `apps/web/src/app/layout.tsx` — which no production code reads — SHALL be removed rather than hardened, because the landing page already receives org identity through the server-rendered RSC prop path. Any inline script that does embed server-provided data MUST encode the breakout-class characters (`<`, `>`, `/`, U+2028, U+2029) to their `\uXXXX` JSON escapes (or use a hardened serializer), so a `</script>` (or equivalent) sequence sourced from the data can never close the element.

#### Scenario: The dead org-data inline script is removed

- **GIVEN** the root layout previously embedded org identity in `<script id="__org_data">`
- **WHEN** the root layout renders on the server
- **THEN** the emitted HTML contains no inline `__org_data` script carrying org strings
- **AND** no inline script in the layout embeds the raw org `shortName`/`fullName`

#### Scenario: A breakout org name cannot inject markup

- **GIVEN** the organization `fullName` is set to `</script><img src=x onerror=alert(1)>`
- **WHEN** the root layout renders on the server
- **THEN** no injected `<img>` (or other) element appears in the parsed DOM
- **AND** no `</script>` sequence sourced from the org data appears inside the document head

#### Scenario: Brand paints without a placeholder flash

- **GIVEN** the organization `fullName` is a normal value such as `Acme Platforms`
- **WHEN** the landing page renders
- **THEN** the brand `shortName` and `fullName` paint from the server-fetched RSC prop without an "ORG" placeholder flash
- **AND** the brand renders without relying on any inline script

#### Scenario: A future inline script embedding server data encodes against breakout

- **GIVEN** a future inline `<script>` embeds server-provided data containing `</script>` or U+2028/U+2029
- **WHEN** that script is rendered
- **THEN** the breakout-class characters are emitted as `\uXXXX` JSON escapes (or via a hardened serializer)
- **AND** the value cannot terminate or corrupt the surrounding script element

### Requirement: Org Identity Strings Are Charset-Validated At The Schema Boundary

The org identity write schema SHALL reject `shortName` and `fullName` values containing HTML-dangerous characters (`<`, `>`) at the admin write boundary, as defence in depth behind the inline-script removal. The constraint applies in `packages/shared/src/schemas/organization.ts` and MUST cover `organizationUpdateSchema` (the admin write path); it MUST NOT loosen the existing length bounds (`shortName` 1–16, `fullName` 1–200). The read/projection schemas (`organizationSchema`, `organizationPublicSchema`) parse values read from the database and MUST NOT add this constraint, so a legacy stored value can never make a read throw.

#### Scenario: Admin submits an org name containing angle brackets

- **GIVEN** an admin calls the org update path with `fullName` containing `<` or `>`
- **WHEN** the input is parsed by `organizationUpdateSchema`
- **THEN** validation fails with a schema error
- **AND** the dangerous value is never persisted to the Organization row

#### Scenario: Admin submits a valid org name

- **GIVEN** an admin submits `shortName` `Acme` and `fullName` `Acme Platforms Inc.`
- **WHEN** the input is parsed by `organizationUpdateSchema`
- **THEN** validation succeeds
- **AND** the existing length bounds (shortName ≤ 16, fullName ≤ 200) still apply

#### Scenario: A stored org value is read back without re-validating charset

- **GIVEN** the Organization row holds brand strings already persisted in the database
- **WHEN** they are parsed by `organizationSchema` or `organizationPublicSchema` on read
- **THEN** the read succeeds and is not subject to the angle-bracket charset constraint
