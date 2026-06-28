## ADDED Requirements

### Requirement: Inline Script Data Is Encoded Against Breakout

Server-provided data embedded into an inline HTML `<script>` element SHALL be
encoded so that no string value can terminate the script element or inject
markup, regardless of the characters the value contains. This covers the
`<script id="__org_data">` org-identity payload in
`apps/web/src/app/layout.tsx`. The implementation MAY escape the breakout-class
characters (`<`, `>`, `/`, U+2028, U+2029) before injection, MAY use a hardened
serializer, or MAY remove the inline-script path in favour of passing the org
identity as a prop / data attribute — but the rendered HTML MUST NOT allow a
`</script>` (or equivalent) sequence sourced from the data to close the element.

#### Scenario: Org name contains a script-closing breakout payload

- **GIVEN** the organization `fullName` is set to `</script><img src=x onerror=alert(1)>`
- **WHEN** the root layout renders the `<script id="__org_data">` element on the server
- **THEN** the emitted HTML does NOT contain a literal `</script>` sequence inside the element body
- **AND** no injected `<img>` (or other) element appears in the parsed DOM outside the script
- **AND** the encoded payload still parses back to the original string when read by the client

#### Scenario: Benign org name round-trips unchanged

- **GIVEN** the organization `fullName` is a normal value such as `Acme Platforms`
- **WHEN** the root layout renders the inline org-data script
- **THEN** a client reading and parsing the script recovers `shortName` and `fullName` exactly as stored
- **AND** the landing page renders the brand without a placeholder flash

#### Scenario: Line/paragraph separator characters do not break the script

- **GIVEN** an org string contains U+2028 or U+2029
- **WHEN** the inline org-data script is rendered
- **THEN** the encoded payload remains valid for client parsing
- **AND** the characters cannot terminate or corrupt the surrounding script element

### Requirement: Org Identity Strings Are Charset-Validated At The Schema Boundary

The org identity schemas SHALL reject `shortName` and `fullName` values containing HTML-dangerous characters (`<`, `>`) at the write boundary, as defence in depth behind the inline-script encoding. The constraint applies in `packages/shared/src/schemas/organization.ts` and MUST cover `organizationUpdateSchema` (the admin write path); it MUST NOT loosen the existing length bounds (`shortName` 1–16, `fullName` 1–200).

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
