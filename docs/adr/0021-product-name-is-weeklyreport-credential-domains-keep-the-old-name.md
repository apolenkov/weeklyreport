# The product name is WeeklyReport; credential crypto domains keep the old name

**Status:** accepted
**Date:** 2026-10-13
**Superseded-by:** None

## Context

Code, runtime namespaces and text still said CustomReport after the product was
renamed. No production data exists, so runtime namespaces can change without
migration. The AI provider credential codec binds stored ciphertexts to the
strings `customreport:ai-provider:v2:key` (AES-GCM AAD) and
`customreport:ai-provider:credential-fingerprint:v1` (HMAC domain).

## Decision

Workspace scope, session cookie (`weeklyreport_session`), Redis and browser key
namespaces (`weeklyreport:`), test identities and visible text use WeeklyReport,
with no compatibility aliases. The two credential domain strings are named,
documented constants in `credential-codec.ts` and keep their original value; a
fixture produced under the original domains pins this. They change only together
with a migration that re-encrypts every stored credential. ADR 0020 and the SAML
test certificates (CN `customreport-test-*`) are not rewritten.

## Alternatives

- Rename the domains too: rejected, saved provider keys would stop decrypting.
- Read both cookie and key namespaces during a transition: rejected, no production
  sessions or caches exist and aliases are a compatibility layer.

## Consequences

All users sign in once; the revocation list starts empty (a token revoked before the rename stays valid for at most its one-hour lifetime; owner decision 2026-10-13: MVP, nothing is migrated); analytics, telemetry and assistant caches start cold.
Database names, environment variables and CI (TASK-369.03) and metric names,
tracing and deployment (TASK-369.04) follow in their own changes. The final
`git grep -i customreport` may match only the credential domains, ADR 0020, the
SAML fixtures and documented negative tests.
