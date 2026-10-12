# Design

## Decisions

1. **Mechanical rename only where nothing persists.** Cookie, Redis keys and browser keys are runtime namespaces without durable data. They are renamed in one step with their tests; no alias is read (decision-161). Effects: one forced re-login, cold caches, dropped revocation entries.
2. **E1 is a contract, not a name.** `credential-codec.ts` builds the AES-GCM AAD (`customreport:ai-provider:v2:key:<version>:revision:<id>:role:<role>`) and the HMAC fingerprint domain (`customreport:ai-provider:credential-fingerprint:v1\0`). Both are inputs to cryptographic operations over data stored in PostgreSQL. They move into exported constants with a comment stating that changing them requires a re-encryption migration. A round-trip test decrypts a fixture produced under the old strings and compares a known fingerprint, so an accidental rename fails the test.
3. **AI system prompt text.** The search-planner prompt names the product; it changes to WeeklyReport. Catalog hash/golden tests are updated deliberately after checking what they pin.
4. **Documents.** ADR 0020 stays as history; a new ADR records the rename, the E1 exception and the rule that the final `customreport` search may only match E1, ADR 0020 and documented negative-test exceptions.
5. **Layer split.** This change owns apps/web, apps/api (except metrics/otel/prisma-guards/env schema), packages, eslint-config, openspec prose, docs and root documents. TASK-369.03 and .04 own the remaining files; files are not shared.

## Risks

- Tests that reference the old domains in fixtures: rename with the fixture, never a global sed over secrets or certificates (SAML keys are not regenerated; only text such as CN changes).
- A stale `customreport` literal in a gate or knip rule would fail late; the layer ends with `git grep -i customreport` over owned files.
