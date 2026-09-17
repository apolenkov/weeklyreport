## 1. Deterministic scenario and outcome inventory

- [x] 1.1 Extend the focused tests to extract every normative `THEN` and following `AND` outcome with a stable within-scenario identity and fingerprint; verify mixed browser/internal scenarios produce separate outcomes.
- [x] 1.2 Extend the Node-standard-library parser so duplicate outcome text remains distinct and malformed outcomes fail closed; verify the focused test and report both exact denominators for the checked source snapshot.

## 2. Registry and flow contract

- [x] 2.1 Extend the focused tests with missing, unknown, duplicate, stale-fingerprint, unclassified, invalid deterministic evidence, mixed-evidence, empty-proofs, and missing-second-proof cases; verify every fixture produces the exact expected diagnostic.
- [x] 2.2 Update the typed registry validator and normal `--refresh` mode to version 2: `coverage` is `unclassified` or `classified` with a non-empty `proofs` array; refresh accepts version 2 only, preserves unchanged proof arrays, resets changed outcomes to unclassified, and never infers a proof surface; verify round-trip stability and default rejection of unclassified or empty-proof outcomes.
- [x] 2.3 Extend tests for missing flows, empty intent, invalid assertion locators, action-only and element-presence-only flows, and qualifying `state`/`net`/`signal` consequence assertions; treat `console`/`text` as supplemental and route only through real registered state, then verify the validator resolves each locator against `.reticle/flows/<project-id>/*.json` and fails closed on unknown shapes.
- [x] 2.4 Wire `tsx scripts/gates/reticle-spec-coverage-cli.ts` after strict OpenSpec validation in `pnpm spec:check`; verify a focused mutated fixture makes the gate fail before restoring the task-owned fixture.

## 3. Complete classification

- [x] 3.1 Perform the one-time v1-to-v2 migration by mechanically wrapping each existing single classification in a one-proof array without claiming semantic review and without adding a legacy adapter; generate version 2 `.reticle/spec-coverage.json` from the current corpus with exactly one source entry per structured normative outcome, leaving every new outcome explicitly unclassified; verify both derived denominators equal their registry denominators without splitting a source `THEN`/`AND` outcome.
- [ ] 3.2 Review every outcome in bounded domain batches and classify it with a non-empty required-proof array containing Reticle and/or concrete deterministic proofs; the static gate must finish with unclassified=0, missing=0, unknown=0, duplicate=0, stale=0, and no empty proof arrays.
- [ ] 3.3 Independently review every required proof and every many-outcomes-to-one-flow group; reject browser mappings that do not prove their sub-guarantee, deterministic mappings that acknowledge an applicable browser consequence, and proof arrays that silently drop a sibling guarantee, then re-run the static gate.

## 4. Reticle flow coverage

- [ ] 4.1 Reconcile the existing saved flows with mapped scenarios; retain flows with business intent and qualifying state/network/signal assertions, use console/text only as supplemental evidence and route only through real registered state, and strengthen or replace the presence-only Head flow before mapping it.
- [ ] 4.2 Record the minimum additional read-only flows needed for uncovered routes, roles, responsive states, accessibility behavior, and projections; each action must declare its consequence before execution and produce `verified: yes` before its flow is saved with intent.
- [ ] 4.3 For applicable write scenarios, inspect the handler and pre-state first, use only known synthetic records in exact local `customreport_e2e`, and serialize one browser/fixture owner; require a successful replay and exact authorized recovery after each bounded lifecycle flow.
- [ ] 4.4 Replay every distinct mapped flow and every required Reticle proof with native Reticle verification, then run the Reticle affected-flow gate; accept only `verified: yes` plus replay pass, and report `unknown`, `no-fault`, skipped, stale, or failed results as incomplete without reclassifying them.

## 5. Acceptance and review

- [ ] 5.1 Run the focused proof-array cases (including missing second proof flow, empty proofs, and refresh preserve/reset), `pnpm exec vitest run scripts/gates/reticle-spec-coverage.test.ts`, `pnpm spec:check`, targeted Prettier/ESLint, and applicable TypeScript checks; record any unrelated dirty-tree failures as exclusions rather than changing neighboring work.
- [ ] 5.2 Bind the final static and live denominators to the tested commit plus hashes of task-owned uncommitted files, report outcome counts once with overlapping Reticle/deterministic, mixed-outcome, and total-proof counts, confirm runtime receipts contain no tracked secrets or volatile payloads, and remove only task-created processes and temporary artifacts.
- [ ] 5.3 Run one fresh primary-owned immutable-artifact review through `task-orchestration`; resolve each P0/P1/P2 once, re-run invalidated checks, and verify the final change still preserves `behavioral-ui-regression-gate`, period dual-state, role-procedure coverage, and the destructive database guard.

## 6. Narrowed mandatory coverage

- [x] 6.1 Add the owner-signed exclusion declaration `.reticle/spec-coverage-exclusions.json` with per-spec and per-outcome entries, reasons, and a decision reference; keep every unlisted outcome mandatory and fail closed on unknown, duplicated, or stale declarations.
- [x] 6.2 Validate registry identity, fingerprints, and outcome text for every outcome while requiring valid proofs only for mandatory outcomes, and report `excludedOutcomes` separately in the gate summary.
- [x] 6.3 Remove `spec:reticle` from the blocking `spec:check` chain and run it as a separate non-blocking CI step; verify `pnpm spec:check` and `pnpm test:reticle` are green without weakening the validator.
- [ ] 6.4 Grow the mandatory core by adding real deterministic references or accepted flows and deleting each matching exclusion entry; retire the non-blocking CI step once the declared core covers the product's critical surface. Current status (2026-09-17): the floor was raised from 6 to 20 outcomes with references verified against passing tests (`audit-target-coverage`, `manual-publish-telemetry`, `section-save-payload-bounds`, `search-contract-precision`, and two of three `published-section-order-determinism` outcomes); the gate reports `mandatoryOutcomes: 20`, `excludedOutcomes: 3104`. The core still does not cover the product's critical surface, so the step stays non-blocking.
- [x] 6.5 Keep `design.md`'s four-key deterministic proof contract as the single normative description so a refresh can never regenerate the pre-`reference` shape. Verified: `design.md` describes the `{kind, surface, reference, detail}` contract, and a refresh after a corpus change now fails on the declaration count instead of regenerating proofs without a reference.
