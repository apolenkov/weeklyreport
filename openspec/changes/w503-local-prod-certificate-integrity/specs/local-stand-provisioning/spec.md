# Spec Delta

## ADDED Requirements

### Requirement: Local stand bootstrap admits a matching IdP signing identity

`deploy/local-prod/setup.sh` MUST validate that `idp.crt` and `idp.key` are parseable and share a public key before invoking Kubernetes. It MUST preserve a valid existing pair unchanged and MUST NOT replace an incomplete, malformed, or mismatched existing pair automatically.

#### Scenario: Existing valid identity is reused

- **WHEN** setup runs with a valid matching certificate and private key
- **THEN** both files remain byte-for-byte unchanged
- **AND** setup can continue to Kubernetes

#### Scenario: Invalid or incomplete identity is rejected

- **WHEN** either signing file is missing, malformed, or belongs to a different pair
- **THEN** setup exits nonzero before invoking Kubernetes
- **AND** existing signing files remain unchanged
- **AND** stderr identifies the invalid state without exposing private key bytes or secret values

### Requirement: Local stand bootstrap propagates identity preparation errors

`deploy/local-prod/setup.sh` MUST generate an IdP pair only when both files are absent. A generation or certificate/key conversion failure MUST return a nonzero exit status, expose its diagnostic on stderr, and prevent Kubernetes operations.

#### Scenario: Fresh identity is generated

- **WHEN** neither signing file exists and identity generation succeeds
- **THEN** setup creates a parseable matching pair
- **AND** setup can continue to Kubernetes

#### Scenario: Identity preparation fails

- **WHEN** generation or either conversion fails
- **THEN** setup exits nonzero before invoking Kubernetes
- **AND** the preparation error remains visible on stderr
