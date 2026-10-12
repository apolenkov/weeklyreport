# Tasks

## 1. Names and text (layer B)

- [ ] 1.1 Rename test domains `*@customreport.local`, `customreport.test`, `customreport.example.com` in owned tests and fixtures
- [ ] 1.2 Rename visible text and prose (fallback department label, document title suffix, DESIGN.md, READMEs, spec prose) and update their tests
- [ ] 1.3 Change SAML test certificate CN text only; do not regenerate keys

## 2. Runtime namespaces (layer C)

- [ ] 2.1 Rename the session cookie in `packages/shared` and its literals in tests
- [ ] 2.2 Rename Redis prefixes (analytics, telemetry, assistant resource, revocation, AI runtime failure) and browser keys with their tests
- [ ] 2.3 E1: extract the credential encryption and fingerprint domains into documented constants; add the round-trip test on a fixture under the old domain
- [ ] 2.4 Change the AI search-planner prompt text; update catalog golden/hash tests deliberately

## 3. Documents (layer D)

- [ ] 3.1 Add the rename ADR (ADR 0020 unchanged); record decisions in the Backlog document
- [ ] 3.2 Validate and archive this OpenSpec change after the layers land

## 4. Verification per layer

- [ ] 4.1 `pnpm format:check lint typecheck test build spec:check`
- [ ] 4.2 `git grep -i customreport` over owned files shows only E1, ADR 0020 and documented exceptions
