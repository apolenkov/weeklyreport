# Design

## Context

See proposal.md for the reproduced C0052/C0053 failures. The operator entry point and realm template already consume OpenSSL's certificate and PKCS8 encodings. Existing secret-preflight coverage mocks OpenSSL and cannot detect invalid signing material.

## Goals / Non-Goals

Preserve the local IdP identity across valid reruns and stop before Kubernetes when identity preparation fails. This package does not rotate existing identity or alter cluster selection, dependencies, secrets policy, database state, period dual-state, role coverage, or destructive guards.

## Decisions

Use existing OpenSSL to parse the certificate and private key and compare their PEM public keys. Validate before secret preparation; Kubernetes remains after all preparation. Reject partial or corrupt state with a diagnostic asking the operator to restore a matching pair. Regeneration of existing state is rejected because it would silently rotate the IdP signing identity.

Keep generation stderr visible. Assign encoded values separately from `export`, so `set -euo pipefail` observes conversion failures rather than the successful export builtin.

Run the complete setup script with real OpenSSL and stub only external kubectl/envsubst operations. Error injection wraps the resolved real OpenSSL executable and fails only the selected operation; positive cases parse actual cryptographic artifacts. Temporary fixtures are removed in test cleanup.

## Risks / Trade-offs

An invalid pre-existing pair now blocks bootstrap; the operator must restore or deliberately remove both files to generate a new identity. Certificate expiration and renewal remain outside this contract. No schema migration or app rollout order changes are required.
