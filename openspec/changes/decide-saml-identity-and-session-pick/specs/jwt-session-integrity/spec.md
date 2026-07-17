## ADDED Requirements

### Requirement: SAML identity matching cross-checks samlId when both sides carry one

When resolving a SAML profile to a stored user, session construction MUST NOT
accept an email match as the same identity if both the profile and the
matched user carry a `samlId` and those `samlId` values differ. When either
the profile or the matched user has no `samlId` (seed/dev-login users), the
existing email-only match remains the accepted path.

#### Scenario: Reused email with a different samlId is not silently inherited

- **GIVEN** a stored user with email `lead1@example.com` and `samlId` `A`
- **WHEN** a SAML profile presents email `lead1@example.com` and `samlId` `B`
- **THEN** the session build does not treat the stored user as the same
  identity on the email match alone

#### Scenario: A samlId-less seed user still resolves by email

- **GIVEN** a stored user with email `lead1@example.com` and no `samlId`
- **WHEN** a SAML profile presents email `lead1@example.com` with any `samlId`
- **THEN** the session build accepts the email match, unchanged from current
  behavior

#### Scenario: Matching samlId confirms the identity

- **GIVEN** a stored user with email `lead1@example.com` and `samlId` `A`
- **WHEN** a SAML profile presents email `lead1@example.com` and `samlId` `A`
- **THEN** the session build accepts the existing user as the same identity
