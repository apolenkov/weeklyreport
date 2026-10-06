# Spec Delta

## ADDED Requirements

### Requirement: SAML email resolution is case-insensitive

The account lookup by corporate email MUST compare case-insensitively
(folding both sides), so a stored mixed-case account remains reachable and a
case-variant assertion can never bypass the email match to mint a second
account. Provisioning MUST store the normalized email on create. The
`samlId` lookup and the stored `samlId` MUST remain exact and verbatim, and
an email hit whose stored `samlId` differs from the asserted identity MUST
still be refused, never re-linked or adopted.

#### Scenario: Case-variant assertion resolves the same account

- **GIVEN** a stored user with email `admin@example.test` and matching
  `samlId`
- **WHEN** a SAML assertion presents `Admin@Example.test` with the same
  `samlId`
- **THEN** the existing account is resolved and no new user is created

#### Scenario: Case-variant email with a foreign samlId is refused

- **GIVEN** a stored user with email `admin@example.test`
- **WHEN** a SAML assertion presents `Admin@Example.test` under a different
  `samlId`
- **THEN** the login is refused as an identity mismatch
- **AND** no user is created or updated
