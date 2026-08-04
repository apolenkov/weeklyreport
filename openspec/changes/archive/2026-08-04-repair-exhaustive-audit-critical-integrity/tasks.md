## 1. Shared lifecycle contracts

- [x] 1.1 Add a strict shared current-lifecycle schema that requires and cross-validates every canonical, legacy, audit, and timestamp field; add table-driven valid-tuple tests. (`PERIOD-SCHEMA-DUAL-STATE-OPTIONAL-001`)
- [x] 1.2 Replace optional/defaulted lifecycle fields in `reportPeriodSchema` and `periodReadModelSchema` with the strict contract; add omission and every contradictory-tuple negative fixture. (`PERIOD-SCHEMA-DUAL-STATE-OPTIONAL-001`)
- [x] 1.3 Add an explicitly versioned legacy snapshot decoder that normalizes each supported historical shape into the strict schema and rejects ambiguous/unsupported versions. (`PERIOD-SCHEMA-DUAL-STATE-OPTIONAL-001`)
- [x] 1.4 Update shared consumers and fixtures to construct complete lifecycle values without casts, fallbacks, or duplicated tuple literals.

## 2. API lifecycle reads and selection

- [x] 2.1 Replace `narrowDraftState` coercion with an exhaustive scheduled/open parser and direct corrupted-state tests for published, archived, null, and contradictory rows. (`PERIOD-FACTORY-STATE-COERCION-001`)
- [x] 2.2 Tighten the current-period factory lookup to the complete live tuple and add archived-draft, contradictory-row, valid-scheduled, and valid-open repository tests. (`PERIOD-FACTORY-ARCHIVED-001`)
- [x] 2.3 Tighten both `resolveActiveWorkspace` query paths to the complete live tuple; test lead, head, admin, and viewer behavior with newer archived and contradictory drafts. (`AUTH-ACTIVE-WORKSPACE-LIFECYCLE-001`)
- [x] 2.4 Narrow manual period creation input to scheduled/open at both type and runtime boundaries; add direct service/repository probes for published, archived, and widened string inputs. (`ADMIN-PERIOD-STATE-COERCION-001`)
- [x] 2.5 Map new lifecycle integrity failures through the existing domain/tRPC error boundary without leaking persisted values.

## 3. API atomic write ownership

- [x] 3.1 Convert `unarchivePeriod` to a full-tuple guarded compare-and-set in one transaction; require exactly one affected row and preserve typed overlap classification. (`UNARCHIVE-CAS-001`)
- [x] 3.2 Add deterministic unarchive interleaving tests for publish, reopen, archive, second-unarchive, deletion, and scheduling-boundary collision. (`UNARCHIVE-CAS-001`)
- [x] 3.3 Move report-section editable-state proof into the draft-save transaction and fail closed on null, deleted, published, archived, or contradictory reports before child replacement. (`SECTION-PERIOD-STATUS-NULL-001`)
- [x] 3.4 Apply the same in-transaction lifecycle predicate to submit and add null/deleted/published/reopened plus concurrent transition probes for both write paths. (`SECTION-PERIOD-STATUS-NULL-001`)
- [x] 3.5 Choose and implement one owned serializable transaction runner with bounded retry and typed exhaustion for project-activity mutations.
- [x] 3.6 Move project-activity group-change validation and update into that transaction; test an attachment committing at every validation/write boundary. (`PROJECT-ACTIVITY-GROUP-CAS-001`)
- [x] 3.7 Move lead-group validation and attachment insert into that transaction; test a group move committing at every validation/write boundary. (`PROJECT-ACTIVITY-GROUP-CAS-001`)
- [x] 3.8 Add integration assertions that no committed database state can contain a cross-group project-activity lead edge after either race. (`PROJECT-ACTIVITY-GROUP-CAS-001`)

## 4. Web report-generation ownership

- [x] 4.1 Replace `loadedContextRef` handoff with current-render loaded context and a report/section generation key passed into `useLeadFormEditing`. (`STATE-STALE-001`)
- [x] 4.2 Key or reset quick-add/modal transient state when the generation changes and reject stale captured callbacks before draft mutation or autosave. (`STATE-STALE-001`)
- [x] 4.3 Add a real LeadForm navigation test that opens quick add on report A, loads report B, attempts save, and proves neither report receives mixed item arrays. (`STATE-STALE-001`)
- [x] 4.4 Add first-loaded-render and direct stale-callback tests proving every editing consumer observes the same current generation without an effect window. (`STATE-STALE-001`)

## 5. Executable authentication and PDF evidence

- [x] 5.1 Repair the SAML assertion-minting harness and replace the valid-signature TODO with an executable production-parser integration test using the checked-in test IdP. (`SECURITY-SAML-001`)
- [x] 5.2 Replace the mutated-signature TODO and add wrong-certificate and replay integration cases; assert rejection occurs before provisioning and emits the required audit/metric evidence. (`SECURITY-SAML-001`)
- [x] 5.3 Add a guard proving the committed SAML certificates have explicit test subjects/fingerprints and no production certificate or private key is used by the harness.
- [x] 5.4 Remove the PDF integration `test.fixme`, wait on job/render-ready state instead of `networkidle`, and assert ready status, persisted owner-scoped artifact URL, and readable non-empty PDF. (`E2E-001`)
- [x] 5.5 Add PDF render/worker terminal-failure coverage proving no success artifact is persisted and no unrelated open browser connection can block completion. (`E2E-001`)

## 6. Mechanical critical-integrity ratchets

- [x] 6.1 Redesign the lifecycle write gate around TypeScript-resolved delegate/data provenance and a sanctioned transition owner; unresolved governed writes must fail closed. (`LIFECYCLE-GATE-BYPASS-001`)
- [x] 6.2 Plant direct, delegate-alias, computed-access, data-variable, helper-return, conditional, and spread lifecycle-write negatives plus valid sanctioned controls. (`LIFECYCLE-GATE-BYPASS-001`)
- [x] 6.3 Reject unknown, unreferenced, malformed, and out-of-owner lifecycle exemptions; add exact positive and negative exemption fixtures. (`LIFECYCLE-GATE-BYPASS-001`)
- [x] 6.4 Add a critical-test marker gate that rejects todo, skip, fixme, focused, and conditional bypasses in every manifest-owned SAML/PDF/lifecycle/concurrency/lead-state/restore test. (`E2E-001`, `SECURITY-SAML-001`)

## 7. Destructive restore guard

- [x] 7.1 Refactor `deploy/postgres/restore.sh` to validate and canonicalize environment, host, port, and database without logging credentials. (`RESTORE-CONFIRM-TARGET-001`)
- [x] 7.2 Require an exact full-target confirmation token and the existing production-destructive consent for production targets before any `pg_restore` invocation. (`RESTORE-CONFIRM-TARGET-001`)
- [x] 7.3 Add shell tests with a fake `pg_restore` proving wrong host, wrong port, wrong database, missing environment, malformed consent, and production-without-consent execute zero destructive commands. (`RESTORE-CONFIRM-TARGET-001`)
- [x] 7.4 Add exact non-production and fully consented production controls proving archive validation precedes the single-transaction restore command. (`RESTORE-CONFIRM-TARGET-001`)

## 8. Evidence manifest and verification

- [x] 8.1 Add the machine-readable P0 evidence manifest with exactly the 13 accepted ids, unique owners, governing specs, direct tests, planted negatives, and canonical commands.
- [x] 8.2 Add a verifier that fails missing/duplicate ids, absent paths, advisory tests, unreferenced probes, unresolved findings, or commands without captured passing evidence.
- [x] 8.3 Run and record the focused shared schema, period/auth/admin/report-section/project-activity, LeadForm, SAML, PDF, lifecycle-gate, and restore test commands named by the manifest.
- [x] 8.4 Run `pnpm exec openspec validate repair-exhaustive-audit-critical-integrity --strict` and `pnpm exec openspec validate --all --strict`.
- [x] 8.5 Run `pnpm typecheck`, `pnpm lint`, forced tracked-file `pnpm exec prettier --check --ignore-path /dev/null` over supported maintained files, and `pnpm test`; require zero errors and zero warnings.
- [x] 8.6 Run `pnpm build`, the canonical API integration lane, `pnpm test:e2e:integration`, and the P0 evidence verifier; record any environment-unavailable lane as unverified rather than passing.
- [x] 8.7 Re-run the exhaustive ledger against final blobs, perform an adversarial review of every P0 diff and negative probe, and keep `pending=0` with all 13 P0 entries resolved by direct evidence.
- [x] 8.8 Update archive `REPORT.md`, `HANDOFF.md`, `consolidation.json`, roadmap, and final HTML; verify every rendered Mermaid diagram and report exact local/server-CI status without inference.
