## ADDED Requirements

### Requirement: SAML signature verification is exercised as an integration boundary

The canonical API test suite MUST execute SAML response parsing with the pinned samlify dependency and checked-in test-only certificates. It MUST prove acceptance of a valid signed assertion and rejection of mutated signatures, an untrusted certificate, and replay.

#### Scenario: Valid test assertion is signed

- **WHEN** the integration harness signs a complete assertion with the trusted test IdP key
- **THEN** the production SAML parser validates it and returns the expected corporate identity

#### Scenario: Signature bytes are mutated

- **WHEN** any signed assertion byte covered by the signature is changed after signing
- **THEN** parsing fails before provisioning and the rejected assertion is audited and metered

#### Scenario: Assertion uses an untrusted certificate

- **WHEN** a structurally valid assertion is signed by a different test certificate
- **THEN** parsing fails before provisioning

#### Scenario: Signed assertion is replayed

- **WHEN** the same accepted assertion identifier is submitted again within its validity window
- **THEN** the second request is rejected and recorded as a replay failure
