## MODIFIED Requirements

### Requirement: External Compose images are immutable and identifiable

Every external `image:` reference in current Compose and CI service definitions
MUST use an explicit release tag and an immutable `@sha256:` digest. Floating
tags such as `latest` MUST NOT identify a reviewed runtime. Locally built
application images MAY use the release version supplied by the operator.

#### Scenario: An external image is inspected

- **WHEN** a current Compose or CI service uses an external image
- **THEN** its reference includes an explicit release tag and full SHA-256 digest
- **AND** the tag identifies the release whose runtime contract was reviewed

#### Scenario: A floating tag is introduced

- **WHEN** an external service image uses `latest` or another moving tag
- **THEN** the repository configuration gate rejects the reference
