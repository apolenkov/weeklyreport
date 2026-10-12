## ADDED Requirements

### Requirement: Credential encryption domains are a stable contract

The authenticated-encryption additional data and the credential fingerprint domain MUST be named, documented constants that do not follow the product name. Their string values MUST NOT change unless every stored credential is re-encrypted by a migration in the same release. Renaming the product MUST NOT change them.

#### Scenario: A credential encrypted before the product rename is read

- **GIVEN** a stored credential encrypted under the original domain strings
- **WHEN** the credential codec decrypts it after the product rename
- **THEN** decryption succeeds and returns the original credential
- **AND** the fingerprint of the same credential equals the previously stored fingerprint
