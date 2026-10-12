# Proposal

## Why

The product is named WeeklyReport, but runtime names, test identities and visible text in the code and documentation still say CustomReport. TASK-369.02 removes them in code and docs; the workspace scope (`@weeklyreport/*`) already landed in main. The MVP has no production data, so decision-161 applies: rename without compatibility aliases.

## What Changes

- Session cookie `customreport_session` becomes `weeklyreport_session` (existing sessions end; no alias is read).
- Redis key namespaces `customreport:` (analytics, telemetry, assistant resource guard, session revocation, AI runtime failure) and the browser keys (`lastRole`, client-logger flag) move to `weeklyreport:`; caches start cold.
- Synthetic identities and domains in tests and fixtures (`*@customreport.local`, `customreport.test`, `customreport.example.com`, SAML test CN text) become `weeklyreport.*`.
- Visible and prompt text `CustomReport` becomes `WeeklyReport` (Head fallback department label, document title suffix, AI search-planner system prompt, DESIGN.md, READMEs, spec prose).
- **Exception E1**: the AES-GCM additional-authenticated-data prefix and the HMAC fingerprint domain of AI provider credentials keep the string `customreport:ai-provider:...`. They are cryptographic contracts of stored data; renaming them silently breaks decryption of saved provider keys. They become named, documented constants covered by a round-trip test on a fixture encrypted under the old domain, and change only together with a re-encryption migration.
- ADR 0020 keeps its text; a new ADR records the rename and the E1 exception.
- Out of scope: databases, env variable names, guards, CI (TASK-369.03); metric names, OTEL, Helm and dashboards (TASK-369.04).

## Capabilities

### New Capabilities

### Modified Capabilities

- `report-routing`: the page title suffix is WeeklyReport instead of CustomReport.
- `ai-provider-configuration`: the credential encryption and fingerprint domains are a stable, versioned contract, independent of the product name.

## Impact

- `packages/shared` (cookie name, auth schema docs), `apps/api` (Redis prefixes, revocation, AI prompt baseline, credential codec constants and test, SAML fixtures), `apps/web` (last-role key, client-logger flag, fallback label), tests and fixtures with `*@customreport.local`, DESIGN.md, READMEs, three spec prose lines, a new ADR.
- Behavior: all users are logged out once; analytics/telemetry/assistant caches start empty; revoked-session entries are dropped; nothing stored in PostgreSQL changes.
